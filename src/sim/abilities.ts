import {
  BUILDING_DEFS,
  CYBER_POWERS,
  UNIT_DEFS,
  type BuildingId,
  type CyberPowerId,
  type UnitId,
} from '../data/defs';
import { getOpponentId, hasBuildingDef, nextId, pushAlert, spawnUnit } from './helpers';
import { findPath } from './pathfinding';
import { nextFloat } from './prng';
import type { Entity, GameState } from './types';

export function updateAbilitiesAndSuperweapons(state: GameState, dt: number): void {
  // 1. Decay global timers & zones
  if (state.kesslerTimer > 0) {
    state.kesslerTimer = Math.max(0, state.kesslerTimer - dt);
    if (state.kesslerTimer === 0) {
      state.kesslerOwnerId = null;
      pushAlert(state, 'Orbital satellite link restored.', 'info');
    }
  }

  state.poisonZones = state.poisonZones.filter((z) => {
    z.life -= dt;
    return z.life > 0;
  });

  state.spoofBlips = state.spoofBlips.filter((b) => {
    b.life -= dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    return b.life > 0;
  });

  state.prometheusBeams = state.prometheusBeams.filter((pb) => {
    pb.life -= dt;
    return pb.life > 0;
  });

  // 2. Refresh Fiber-Optic Tether Anchors from EW Sappers
  state.tetherAnchors = [];
  for (const id of state.entityOrder) {
    const e = state.entities[id];
    if (!e || e.kind !== 'unit') continue;
    const def = UNIT_DEFS[e.defId as UnitId];
    if (def.canDeployTether && !e.safeMode) {
      state.tetherAnchors.push({
        ownerId: e.ownerId,
        sourceId: e.id,
        x: e.x,
        y: e.y,
        radius: 220,
      });
    }
  }

  // 3. Per-player Q-Day Decryption, Cyber Cooldowns, Superweapon Charge & Zero-Day Implants
  for (const pid of Object.keys(state.players)) {
    const p = state.players[pid];
    if (pid === 'neutral' || p.defeated) continue;

    for (const key of Object.keys(p.cyberCooldowns) as CyberPowerId[]) {
      p.cyberCooldowns[key] = Math.max(0, p.cyberCooldowns[key] - dt);
    }
    p.ransomwareTimer = Math.max(0, p.ransomwareTimer - dt);
    p.chokepointTimer = Math.max(0, p.chokepointTimer - dt);

    // Quantum Cryo-Core drives Q-Day decryption
    const cryoCount = state.entityOrder.filter((id) => {
      const e = state.entities[id];
      return e && e.kind === 'building' && e.ownerId === pid && e.defId === 'cryo_core';
    }).length;

    if (cryoCount > 0 && p.powerRatio >= 0.8) {
      const rate = 2.4 * cryoCount * (p.overclock ? 1.35 : 1.0);
      const prevQ = p.qDayActive;
      p.qDayProgress = Math.min(100, p.qDayProgress + rate * dt);
      if (p.qDayProgress >= 100) {
        p.qDayActive = true;
        if (!prevQ && pid === 'p1') {
          pushAlert(state, 'Q-DAY ACHIEVED: Enemy queues, waypoints & False Orders unlocked!', 'info');
        }
      }
    } else if (cryoCount === 0 && p.qDayProgress > 0) {
      p.qDayProgress = Math.max(0, p.qDayProgress - 1.5 * dt);
      if (p.qDayProgress < 100) p.qDayActive = false;
    }

    // Superweapon charging (~87s per facility)
    const swId: BuildingId =
      p.faction === 'alliance'
        ? 'prometheus_uplink'
        : p.faction === 'pact'
        ? 'kessler_silo'
        : 'chokepoint_hub';
    if (hasBuildingDef(state, pid, swId) && p.powerRatio >= 1.0) {
      const prevReady = p.superweaponCharge >= 100;
      p.superweaponCharge = Math.min(100, p.superweaponCharge + 1.15 * dt);
      if (!prevReady && p.superweaponCharge >= 100 && pid === 'p1') {
        pushAlert(state, `${BUILDING_DEFS[swId].shortName} SUPERWEAPON READY!`, 'warn');
      }
    }
  }

  // 4. Entity Tether flags, Poison Zones, EMP Stun, Unit 8200 Implants & Project Prometheus conversion
  for (const id of state.entityOrder) {
    const ent = state.entities[id];
    if (!ent) continue;

    ent.poisonTimer = Math.max(0, ent.poisonTimer - dt);
    ent.empStunTimer = Math.max(0, ent.empStunTimer - dt);
    ent.siloOpenTimer = Math.max(0, ent.siloOpenTimer - dt);
    ent.launchCooldown = Math.max(0, ent.launchCooldown - dt);

    // Fiber Tether immunity check
    ent.tethered = false;
    if (ent.kind === 'unit' && UNIT_DEFS[ent.defId as UnitId].tags.includes('AUTONOMOUS')) {
      for (const anchor of state.tetherAnchors) {
        if (
          anchor.ownerId === ent.ownerId &&
          Math.hypot(ent.x - anchor.x, ent.y - anchor.y) <= anchor.radius
        ) {
          ent.tethered = true;
          break;
        }
      }
    }

    const isHuman =
      ent.kind === 'unit' && UNIT_DEFS[ent.defId as UnitId].tags.includes('HUMAN');
    const isImmuneToCyber = isHuman || ent.tethered;

    // Adversarial Data Poisoning zones
    if (ent.ownerId !== 'neutral' && !isImmuneToCyber) {
      const isAutoTurretOrBot =
        (ent.kind === 'unit' && UNIT_DEFS[ent.defId as UnitId].tags.includes('AUTONOMOUS')) ||
        (ent.kind === 'building' && BUILDING_DEFS[ent.defId as BuildingId].attackRange > 0);
      if (isAutoTurretOrBot) {
        for (const pz of state.poisonZones) {
          if (pz.ownerId !== ent.ownerId && Math.hypot(ent.x - pz.x, ent.y - pz.y) <= pz.radius) {
            ent.poisonTimer = Math.max(ent.poisonTimer, 1.5);
          }
        }
      }
    }

    // Unit 8200 Zero-Day Hardware Implant auto-execution
    if (ent.kind === 'unit' && ent.defId === 'unit_8200' && !ent.safeMode) {
      const enemyId = getOpponentId(ent.ownerId);
      for (const bid of state.entityOrder) {
        const farm = state.entities[bid];
        if (
          !farm ||
          farm.kind !== 'building' ||
          farm.ownerId !== enemyId ||
          farm.defId !== 'server_farm' ||
          farm.implantedBy === ent.ownerId
        ) {
          continue;
        }
        if (Math.hypot(farm.x - ent.x, farm.y - ent.y) <= 68) {
          farm.implantedBy = ent.ownerId;
          if (ent.ownerId === 'p1') {
            pushAlert(state, 'Zero-Day Implant planted! Siphoning +12 FLOPS & vision.', 'info');
          }
          break;
        }
      }
    }

    // Project Prometheus Orbital Conversion Beams
    let insideBeam = false;
    if (ent.ownerId !== 'neutral' && !isImmuneToCyber) {
      const eligible =
        (ent.kind === 'unit' && UNIT_DEFS[ent.defId as UnitId].tags.includes('AUTONOMOUS')) ||
        (ent.kind === 'building' && BUILDING_DEFS[ent.defId as BuildingId].attackRange > 0);
      if (eligible) {
        for (const beam of state.prometheusBeams) {
          if (beam.ownerId !== ent.ownerId && Math.hypot(ent.x - beam.x, ent.y - beam.y) <= beam.radius) {
            insideBeam = true;
            ent.convertingBy = beam.ownerId;
            ent.conversionProgress += 42 * dt;
            if (ent.conversionProgress >= 100) {
              ent.ownerId = beam.ownerId;
              ent.conversionProgress = 0;
              ent.convertingBy = undefined;
              ent.order = { type: 'idle', targetX: ent.x, targetY: ent.y };
              ent.path = [];
            }
            break;
          }
        }
      }
    }
    if (!insideBeam) {
      ent.conversionProgress = Math.max(0, ent.conversionProgress - 20 * dt);
    }

    // Deepfake Spoof Blips: auto-expose when enemy unit/building has close optical LOS (110px)
    // Handled below
  }

  for (const blip of state.spoofBlips) {
    for (const id of state.entityOrder) {
      const ent = state.entities[id];
      if (!ent || ent.ownerId === 'neutral' || ent.ownerId === blip.ownerId) continue;
      if (Math.hypot(ent.x - blip.x, ent.y - blip.y) <= 115) {
        blip.life = 0;
        break;
      }
    }
  }
}

export function launchSwarmFromUnit(
  state: GameState,
  launcher: Entity,
  targetX?: number,
  targetY?: number
): void {
  if (launcher.launchCooldown > 0 || launcher.safeMode) return;
  launcher.launchCooldown = 14;
  const swarmId = nextId(state, 'swarm');
  const count = launcher.defId === 'drone_mothership' ? 5 : 6;
  const enemyId = getOpponentId(launcher.ownerId);

  let tx = targetX;
  let ty = targetY;
  if (tx === undefined || ty === undefined) {
    const enemyTarget = state.entityOrder
      .map((id) => state.entities[id])
      .find((e) => e && e.ownerId === enemyId);
    tx = enemyTarget?.x ?? launcher.x + (launcher.ownerId === 'p1' ? 400 : -400);
    ty = enemyTarget?.y ?? launcher.y;
  }

  for (let i = 0; i < count; i++) {
    const angleOff = (i - (count - 1) / 2) * 24;
    const drone = spawnUnit(
      state,
      launcher.ownerId,
      'shahed_drone',
      launcher.x + (nextFloat(state.rng) - 0.5) * 26,
      launcher.y + (nextFloat(state.rng) - 0.5) * 26
    );
    drone.swarmId = swarmId;
    drone.swarmSplitBias = angleOff;
    drone.swarmSplitActive = false;
    drone.order = { type: 'attackMove', targetX: tx, targetY: ty };
    drone.path = [{ x: tx, y: ty }];
  }

  if (launcher.ownerId === 'p1') {
    pushAlert(state, `Shahed-X hive-mind swarm (${count} drones) airborne!`, 'info');
  }
}

export function executeCyberPower(
  state: GameState,
  playerId: string,
  powerId: CyberPowerId,
  x: number,
  y: number
): void {
  const player = state.players[playerId];
  if (!player || !hasBuildingDef(state, playerId, 'cryo_core')) return;
  const def = CYBER_POWERS[powerId];
  if (player.cyberCooldowns[powerId] > 0) return;
  if (def.requiresQDay && !player.qDayActive) {
    if (playerId === 'p1') pushAlert(state, 'False Order Injection requires 100% Q-Day!', 'warn');
    return;
  }

  player.cyberCooldowns[powerId] = def.cooldown;
  const enemyId = getOpponentId(playerId);

  if (powerId === 'data_poison') {
    state.poisonZones.push({
      id: nextId(state, 'pz'),
      ownerId: playerId,
      x,
      y,
      radius: def.radius,
      life: def.duration,
      maxLife: def.duration,
    });
    if (playerId === 'p1') pushAlert(state, 'Adversarial Data Poisoning deployed!', 'info');
  } else if (powerId === 'deepfake_spoof') {
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2;
      state.spoofBlips.push({
        id: nextId(state, 'spoof'),
        ownerId: playerId,
        x: x + Math.cos(ang) * 35,
        y: y + Math.sin(ang) * 35,
        vx: Math.cos(ang) * 18,
        vy: Math.sin(ang) * 18,
        life: def.duration,
      });
    }
    if (playerId === 'p1') pushAlert(state, 'Deepfake Comms Spoof active on enemy radar!', 'info');
  } else if (powerId === 'ransomware') {
    const enemy = state.players[enemyId];
    if (enemy) {
      enemy.ransomwareTimer = def.duration;
      if (enemyId === 'p1') {
        pushAlert(state, 'RANSOMWARE LOCK: Factories frozen 30s — pay 350 Si to unlock!', 'danger');
      } else if (playerId === 'p1') {
        pushAlert(state, 'Ransomware encrypted enemy production lines!', 'info');
      }
    }
  } else if (powerId === 'false_orders') {
    const divertX = playerId === 'p1' ? 200 : state.map.width * state.map.tileSize - 200;
    const divertY = playerId === 'p1' ? 200 : state.map.height * state.map.tileSize - 200;
    let diverted = 0;
    for (const id of state.entityOrder) {
      const e = state.entities[id];
      if (!e || e.kind !== 'unit' || e.ownerId !== enemyId || e.tethered) continue;
      if (!UNIT_DEFS[e.defId as UnitId].tags.includes('AUTONOMOUS')) continue;
      if (Math.hypot(e.x - x, e.y - y) <= def.radius) {
        e.order = { type: 'move', targetX: divertX, targetY: divertY };
        e.path = findPath(state, e.x, e.y, divertX, divertY);
        diverted++;
      }
    }
    if (playerId === 'p1') {
      pushAlert(state, `Q-Day False Orders injected (${diverted} squads diverted)!`, 'info');
    }
  }
}

export function executeSuperweapon(
  state: GameState,
  playerId: string,
  x: number,
  y: number
): void {
  const player = state.players[playerId];
  if (!player || player.superweaponCharge < 100) return;

  const swId: BuildingId =
    player.faction === 'alliance'
      ? 'prometheus_uplink'
      : player.faction === 'pact'
      ? 'kessler_silo'
      : 'chokepoint_hub';
  if (!hasBuildingDef(state, playerId, swId)) return;

  player.superweaponCharge = 0;
  const enemyId = getOpponentId(playerId);

  if (player.faction === 'alliance') {
    // Project Prometheus: 45s orbital takeover beam
    state.prometheusBeams.push({
      id: nextId(state, 'prom'),
      ownerId: playerId,
      x,
      y,
      radius: 175,
      life: 45,
      maxLife: 45,
    });
    pushAlert(state, 'PROJECT PROMETHEUS: Orbital AGI Takeover Beam active (45s)!', 'danger');
  } else if (player.faction === 'pact') {
    // Kessler Cascade / Orbital EMP: 3 min satellite blackout + stun unhardened electronics
    state.kesslerTimer = 180;
    state.kesslerOwnerId = playerId;
    for (const id of state.entityOrder) {
      const e = state.entities[id];
      if (!e || e.kind !== 'unit' || e.ownerId === 'neutral' || e.tethered) continue;
      const tags = UNIT_DEFS[e.defId as UnitId].tags;
      if (tags.includes('AUTONOMOUS') && !tags.includes('HARDENED')) {
        e.empStunTimer = 12;
      }
    }
    state.explosions.push({
      id: nextId(state, 'kessler'),
      x: (state.map.width * state.map.tileSize) / 2,
      y: (state.map.height * state.map.tileSize) / 2,
      radius: 520,
      color: '#38bdf8',
      life: 1.4,
      maxLife: 1.4,
    });
    pushAlert(state, 'KESSLER CASCADE DETONATED: Satellite recon offline for 3:00!', 'danger');
  } else {
    // Strait Chokepoint / Supply-Chain Collapse: 60s 2x cost, -75% income, naval movement burn
    const enemy = state.players[enemyId];
    if (enemy) {
      enemy.chokepointTimer = 60;
    }
    pushAlert(state, 'STRAIT CHOKEPOINT: Enemy supply collapse (2× cost, -75% income, 60s)!', 'danger');
  }
}
