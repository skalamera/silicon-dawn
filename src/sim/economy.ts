import { BUILDING_DEFS, UNIT_DEFS, type BuildingId, type UnitId } from '../data/defs';
import { computeLatencyFactor, nextId, pushAlert, spawnUnit } from './helpers';
import { isWaterTile } from './mapGen';
import { findPath, type PathMode } from './pathfinding';
import { nextInt } from './prng';
import type { Entity, GameState } from './types';

export function updateGridAndEconomy(state: GameState, dt: number): void {
  for (const pid of Object.keys(state.players)) {
    const p = state.players[pid];
    if (pid === 'neutral') continue;
    p.powerProduced = 0;
    p.powerConsumed = 0;
    p.flopsCap = 0;
    p.flopsUsed = 0;
    p.coolingCapacity = 1.0;
    p.implantedFlopsBonus = 0;
  }

  const serverFarmsByPlayer: Record<string, Entity[]> = {};
  const relayHubsByPlayer: Record<string, Entity[]> = {};
  const humanAurasByPlayer: Record<string, Array<{ x: number; y: number; r: number }>> = {};

  for (const id of state.entityOrder) {
    const ent = state.entities[id];
    if (!ent) continue;
    const p = state.players[ent.ownerId];
    if (!p || ent.ownerId === 'neutral') continue;

    if (ent.kind === 'building') {
      const def = BUILDING_DEFS[ent.defId as BuildingId];
      if (def.powerDelta >= 0) p.powerProduced += def.powerDelta;
      else p.powerConsumed += -def.powerDelta;

      let flopsAdd = def.flopsDelta;
      // Zero-Day Hardware Implant siphons 12 FLOPS to infiltrator's owner
      if (ent.implantedBy && state.players[ent.implantedBy]) {
        const thief = state.players[ent.implantedBy];
        const stolen = Math.min(12, flopsAdd);
        flopsAdd -= stolen;
        thief.implantedFlopsBonus += stolen;
      }
      p.flopsCap += flopsAdd;

      if (ent.waterCooled) {
        p.coolingCapacity += 0.25;
      }
      if (ent.defId === 'server_farm') {
        (serverFarmsByPlayer[ent.ownerId] ??= []).push(ent);
      }
      if (ent.defId === 'relay_hub') {
        (relayHubsByPlayer[ent.ownerId] ??= []).push(ent);
      }
      if (def.siliconPassiveRate && def.siliconPassiveRate > 0) {
        const incomeMult = p.chokepointTimer > 0 ? 0.25 : 1.0;
        p.silicon += def.siliconPassiveRate * incomeMult * dt;
      }
    } else {
      const def = UNIT_DEFS[ent.defId as UnitId];
      p.flopsUsed += def.flopsCost;
      if (def.auraRadius && def.tags.includes('HUMAN')) {
        (humanAurasByPlayer[ent.ownerId] ??= []).push({
          x: ent.x,
          y: ent.y,
          r: def.auraRadius,
        });
      }
    }
  }

  // Apply siphoned FLOPS bonuses & compute powerRatio / latency / Safe Mode
  for (const pid of Object.keys(state.players)) {
    const p = state.players[pid];
    if (pid === 'neutral') continue;

    p.flopsCap += p.implantedFlopsBonus;
    const prevPowerLow = p.powerRatio < 1.0;
    p.powerRatio = p.powerConsumed <= 0 ? 2.0 : p.powerProduced / p.powerConsumed;
    p.latencyFactor = computeLatencyFactor(p.flopsUsed, p.flopsCap);

    if (pid === 'p1' && !prevPowerLow && p.powerRatio < 1.0) {
      pushAlert(state, 'LOW POWER: Unshielded AI units entering Safe Mode!', 'danger');
    }

    if (p.overclock) {
      p.thermalLoad = Math.min(100, p.thermalLoad + 11 * dt);
      if (p.thermalLoad >= 100) {
        p.overclock = false;
        p.thermalLoad = 78;
        const farms = serverFarmsByPlayer[pid] ?? [];
        if (farms.length > 0) {
          const idx = nextInt(state.rng, 0, farms.length - 1);
          const victim = farms[idx];
          victim.hp = Math.max(0, victim.hp - 220);
          state.explosions.push({
            id: nextId(state, 'exp'),
            x: victim.x,
            y: victim.y,
            radius: 38,
            color: '#f97316',
            life: 0.65,
            maxLife: 0.65,
          });
        }
        if (pid === 'p1') {
          pushAlert(state, 'THERMAL MELTDOWN: Server Farm damaged, Overclock tripped!', 'danger');
        }
      }
    } else {
      p.thermalLoad = Math.max(0, p.thermalLoad - 6.5 * p.coolingCapacity * dt);
    }
  }

  // Mark Safe Mode / Human Override on units (including Kessler EMP stun!)
  for (const id of state.entityOrder) {
    const ent = state.entities[id];
    if (!ent || ent.kind !== 'unit') continue;
    const p = state.players[ent.ownerId];
    if (!p) continue;
    const def = UNIT_DEFS[ent.defId as UnitId];

    const auras = humanAurasByPlayer[ent.ownerId] ?? [];
    let hasOverride = false;
    for (const a of auras) {
      if (Math.hypot(ent.x - a.x, ent.y - a.y) <= a.r) {
        hasOverride = true;
        break;
      }
    }
    ent.humanOverride = hasOverride;

    const isAutonomous = def.tags.includes('AUTONOMOUS');
    const isHardened = def.tags.includes('HARDENED');
    const powerTripped = isAutonomous && !isHardened && p.powerRatio < 1.0 && !hasOverride;
    const empTripped = ent.empStunTimer > 0 && !ent.tethered && !isHardened && !hasOverride;
    ent.safeMode = powerTripped || empTripped;
  }

  updateHarvestersAndCaptures(state, dt, relayHubsByPlayer);

  // Advance Production Queues (paused if Ransomware Grid Lock is active!)
  for (const pid of Object.keys(state.players)) {
    const p = state.players[pid];
    if (pid === 'neutral' || p.defeated || p.ransomwareTimer > 0) continue;

    const powerSpeed = p.powerRatio >= 1.0 ? 1.0 : Math.max(0.45, p.powerRatio * 0.75);
    const ocMult = p.overclock ? 1.5 : 1.0;

    if (p.buildingQueue) {
      p.buildingQueue.progress += dt * powerSpeed * ocMult;
      if (p.buildingQueue.progress >= p.buildingQueue.totalTime) {
        p.readyBuildingDefId = p.buildingQueue.defId as BuildingId;
        p.buildingQueue = null;
        if (pid === 'p1') {
          const bName = BUILDING_DEFS[p.readyBuildingDefId].shortName;
          pushAlert(state, `${bName} ready — click map to deploy.`, 'info');
        }
      }
    }

    if (p.unitQueue.length > 0) {
      const item = p.unitQueue[0];
      const uDef = UNIT_DEFS[item.defId as UnitId];
      const pactDarkBonus =
        p.faction === 'pact' &&
        uDef.producedBy === 'war_factory' &&
        uDef.tags.includes('AUTONOMOUS')
          ? 1.5
          : 1.0;

      item.progress += dt * powerSpeed * ocMult * pactDarkBonus;
      if (item.progress >= item.totalTime) {
        p.unitQueue.shift();
        spawnCompletedUnit(state, pid, uDef.id);
      }
    }
  }
}

function updateHarvestersAndCaptures(
  state: GameState,
  dt: number,
  relayHubsByPlayer: Record<string, Entity[]>
): void {
  const siliconNodes: Entity[] = [];
  const neutralLngs: Entity[] = [];
  for (const id of state.entityOrder) {
    const e = state.entities[id];
    if (!e || e.kind !== 'building') continue;
    if (e.defId === 'silicon_node' && (e.siliconRemaining ?? 0) > 0) {
      siliconNodes.push(e);
    } else if (BUILDING_DEFS[e.defId as BuildingId]?.isNeutralCapture && e.ownerId === 'neutral') {
      neutralLngs.push(e);
    }
  }

  for (const id of state.entityOrder) {
    const crawler = state.entities[id];
    if (!crawler || crawler.kind !== 'unit') continue;
    const def = UNIT_DEFS[crawler.defId as UnitId];
    if (!def.canHarvest) continue;

    crawler.linkedNodeId = undefined;
    crawler.linkedHubId = undefined;

    if (crawler.safeMode) continue;

    const hubs = relayHubsByPlayer[crawler.ownerId] ?? [];
    if (hubs.length === 0) continue;

    if (crawler.order.type === 'idle' && siliconNodes.length > 0) {
      let bestNode = siliconNodes[0];
      let bestDist = Infinity;
      for (const n of siliconNodes) {
        const d = Math.hypot(n.x - crawler.x, n.y - crawler.y);
        if (d < bestDist) {
          bestDist = d;
          bestNode = n;
        }
      }
      crawler.order = {
        type: 'harvest',
        targetX: bestNode.x,
        targetY: bestNode.y,
        targetEntityId: bestNode.id,
      };
      crawler.path = findPath(state, crawler.x, crawler.y, bestNode.x, bestNode.y);
    }

    if (crawler.order.type === 'harvest' && crawler.order.targetEntityId) {
      const node = state.entities[crawler.order.targetEntityId];
      if (!node || (node.siliconRemaining ?? 0) <= 0) {
        crawler.order = { type: 'idle', targetX: crawler.x, targetY: crawler.y };
        continue;
      }

      const distToNode = Math.hypot(node.x - crawler.x, node.y - crawler.y);
      if (distToNode <= 78) {
        let closestHub = hubs[0];
        let hubDist = Infinity;
        for (const h of hubs) {
          const d = Math.hypot(h.x - crawler.x, h.y - crawler.y);
          if (d < hubDist) {
            hubDist = d;
            closestHub = h;
          }
        }
        const player = state.players[crawler.ownerId];
        if (player) {
          const chokeMult = player.chokepointTimer > 0 ? 0.25 : 1.0;
          const rate = 28 * player.latencyFactor * (player.overclock ? 1.25 : 1.0) * chokeMult;
          const harvested = Math.min(node.siliconRemaining ?? 0, rate * dt);
          node.siliconRemaining = (node.siliconRemaining ?? 0) - harvested;
          player.silicon += harvested;
          crawler.linkedNodeId = node.id;
          crawler.linkedHubId = closestHub.id;
          crawler.path = [];
        }
      }
    }
  }

  for (const lng of neutralLngs) {
    const contenders = new Set<string>();
    for (const id of state.entityOrder) {
      const u = state.entities[id];
      if (!u || u.kind !== 'unit' || u.ownerId === 'neutral' || u.safeMode) continue;
      if (Math.hypot(u.x - lng.x, u.y - lng.y) <= 92) {
        contenders.add(u.ownerId);
      }
    }
    if (contenders.size === 1) {
      const [capturerId] = Array.from(contenders);
      if (lng.capturingOwnerId !== capturerId) {
        lng.capturingOwnerId = capturerId;
        lng.captureProgress = 0;
      }
      lng.captureProgress = Math.min(1, (lng.captureProgress ?? 0) + dt / 4.0);
      if (lng.captureProgress >= 1) {
        lng.ownerId = capturerId;
        lng.capturingOwnerId = undefined;
        lng.captureProgress = 1;
        if (capturerId === 'p1') {
          const capDef = BUILDING_DEFS[lng.defId as BuildingId];
          pushAlert(state, `${capDef.shortName} captured!`, 'info');
        }
      }
    } else if (contenders.size === 0) {
      lng.captureProgress = Math.max(0, (lng.captureProgress ?? 0) - dt * 0.25);
    }
  }
}

export function spawnCompletedUnit(state: GameState, playerId: string, defId: UnitId): void {
  const def = UNIT_DEFS[defId];
  let producer: Entity | null = null;
  for (const id of state.entityOrder) {
    const b = state.entities[id];
    if (b && b.kind === 'building' && b.ownerId === playerId && b.defId === def.producedBy) {
      producer = b;
      break;
    }
  }
  if (!producer) {
    for (const id of state.entityOrder) {
      const b = state.entities[id];
      if (b && b.kind === 'building' && b.ownerId === playerId && b.defId === 'conyard') {
        producer = b;
        break;
      }
    }
  }
  if (!producer) return;

  const player = state.players[playerId];
  const isNaval = def.tags.includes('NAVAL');
  let baseSpawnX = producer.x + (playerId === 'p1' ? 56 : -56);
  let baseSpawnY = producer.y + 52;

  // For naval yards, pick an adjacent water tile center
  if (isNaval && producer.tileX !== undefined && producer.tileY !== undefined) {
    const { tileSize } = state.map;
    let foundWater = false;
    for (let dy = -2; dy <= 3 && !foundWater; dy++) {
      for (let dx = -2; dx <= 3 && !foundWater; dx++) {
        const wx = producer.tileX + dx;
        const wy = producer.tileY + dy;
        if (isWaterTile(state.map, wx, wy)) {
          baseSpawnX = (wx + 0.5) * tileSize;
          baseSpawnY = (wy + 0.5) * tileSize;
          foundWater = true;
        }
      }
    }
  }

  const mode: PathMode = def.tags.includes('AIR')
    ? 'air'
    : isNaval
    ? 'naval'
    : 'ground';

  for (let i = 0; i < def.spawnCount; i++) {
    const offsetX = (i - (def.spawnCount - 1) / 2) * 26;
    const unit = spawnUnit(state, playerId, defId, baseSpawnX + offsetX, baseSpawnY);
    if (player?.rallyPoint && !isNaval) {
      const rx = player.rallyPoint.x + offsetX;
      const ry = player.rallyPoint.y;
      unit.order = { type: 'move', targetX: rx, targetY: ry };
      unit.path = findPath(state, unit.x, unit.y, rx, ry, mode);
    }
  }
}
