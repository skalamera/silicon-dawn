import {
  BUILDING_DEFS,
  isAvailableForFaction,
  UNIT_DEFS,
  type BuildingId,
  type FactionId,
  type UnitId,
} from '../data/defs';
import { getMissionById } from '../data/missions';
import {
  executeCyberPower,
  executeSuperweapon,
  launchSwarmFromUnit,
  updateAbilitiesAndSuperweapons,
} from './abilities';
import { updateAiCommander } from './ai';
import { updateCampaignEvents } from './campaignEvents';
import { updateCombatAndMovement, updateFogOfWar } from './combat';
import { updateGridAndEconomy } from './economy';
import { hasBuildingDef, nextId, pushAlert, spawnBuilding, spawnUnit } from './helpers';
import { createMapById } from './mapGen';
import { canPlaceBuilding, findPath, type PathMode } from './pathfinding';
import { createRngState } from './prng';
import type { GameState, MatchConfig, PlayerState, SimCommand } from './types';

function factionLabel(faction: FactionId): string {
  if (faction === 'alliance') return 'Western Alliance';
  if (faction === 'pact') return 'Eurasian Pact';
  if (faction === 'axis') return 'Asymmetric Axis';
  return 'Neutral';
}

function createPlayer(
  id: string,
  name: string,
  faction: FactionId,
  isAi: boolean,
  difficulty: MatchConfig['aiDifficulty']
): PlayerState {
  return {
    id,
    name,
    faction,
    isAi,
    aiDifficulty: difficulty,
    silicon: faction === 'neutral' ? 0 : 1900,
    powerProduced: 0,
    powerConsumed: 0,
    powerRatio: 1.5,
    flopsCap: 0,
    flopsUsed: 0,
    latencyFactor: 1.0,
    overclock: false,
    thermalLoad: 0,
    coolingCapacity: 1.0,
    buildingQueue: null,
    readyBuildingDefId: null,
    unitQueue: [],
    rallyPoint: null,
    aiTimer: 2.0,
    aiWaveTimer: difficulty === 'commander' ? 210 : 300,
    defeated: false,
    qDayProgress: 0,
    qDayActive: false,
    cyberCooldowns: {
      data_poison: 0,
      deepfake_spoof: 0,
      ransomware: 0,
      false_orders: 0,
    },
    ransomwareTimer: 0,
    superweaponCharge: 0,
    chokepointTimer: 0,
    implantedFlopsBonus: 0,
  };
}

export function createInitialState(config: MatchConfig): GameState {
  const { map, siliconNodes, neutralBuildings, p1Spawn, aiSpawn } = createMapById(
    config.mapId ?? 'peninsula_grid'
  );
  const fogSize = map.width * map.height;

  const state: GameState = {
    schemaVersion: 2,
    tick: 0,
    tickRate: 20,
    elapsedSeconds: 0,
    config,
    rng: createRngState(config.seed),
    nextEntitySeq: 1,
    map,
    players: {
      p1: createPlayer('p1', factionLabel(config.playerFaction), config.playerFaction, false, config.aiDifficulty),
      ai1: createPlayer('ai1', `${factionLabel(config.aiFaction)} (AI)`, config.aiFaction, true, config.aiDifficulty),
      neutral: createPlayer('neutral', 'Neutral', 'neutral', false, config.aiDifficulty),
    },
    entities: {},
    entityOrder: [],
    projectiles: [],
    beams: [],
    smokeClouds: [],
    explosions: [],
    scorchMarks: [],
    jamDomes: [],
    tetherAnchors: [],
    poisonZones: [],
    spoofBlips: [],
    prometheusBeams: [],
    kesslerTimer: 0,
    kesslerOwnerId: null,
    missionId: config.missionId ?? null,
    missionStep: 0,
    fog: {
      p1: new Array(fogSize).fill(0),
      ai1: new Array(fogSize).fill(0),
    },
    winnerId: null,
    alerts: [
      {
        id: 'init_1',
        text: `${factionLabel(config.playerFaction)} Uplink online on ${map.name}.`,
        tone: 'info',
        ttl: 6,
      },
    ],
  };

  for (const node of siliconNodes) {
    const ent = spawnBuilding(state, 'neutral', 'silicon_node', node.tileX, node.tileY);
    ent.siliconRemaining = node.amount;
  }
  for (const nb of neutralBuildings) {
    spawnBuilding(state, 'neutral', nb.defId, nb.tileX, nb.tileY);
  }

  spawnStarterBase(state, 'p1', config.playerFaction, p1Spawn.tileX, p1Spawn.tileY, 1);
  spawnStarterBase(state, 'ai1', config.aiFaction, aiSpawn.tileX, aiSpawn.tileY, -1);

  const mission = getMissionById(config.missionId);
  if (mission) {
    state.players.p1.silicon = mission.startingSilicon;
    mission.setup(state);
  }

  updateAbilitiesAndSuperweapons(state, 0);
  updateGridAndEconomy(state, 0);
  updateFogOfWar(state);
  return state;
}

function spawnStarterBase(
  state: GameState,
  ownerId: string,
  faction: 'alliance' | 'pact' | 'axis',
  tx: number,
  ty: number,
  dir: 1 | -1
): void {
  const ts = state.map.tileSize;
  spawnBuilding(state, ownerId, 'conyard', tx, ty);
  spawnBuilding(state, ownerId, 'smr', tx - 3 * dir, ty);
  spawnBuilding(state, ownerId, 'server_farm', tx, ty + 3 * dir);
  spawnBuilding(state, ownerId, 'relay_hub', tx + 4 * dir, ty);

  const hubX = (tx + 4 * dir + 1.5) * ts;
  const hubY = (ty + 1) * ts;
  spawnUnit(state, ownerId, 'relay_crawler', hubX, hubY + 48 * dir);

  const squadX = (tx + 2 * dir) * ts;
  const squadY = (ty - 2 * dir) * ts;
  if (faction === 'alliance') {
    spawnUnit(state, ownerId, 'forward_controller', squadX, squadY);
    spawnUnit(state, ownerId, 'valkyrie', squadX + 34, squadY);
    spawnUnit(state, ownerId, 'm1e4', squadX + 68, squadY + 24);
  } else if (faction === 'pact') {
    spawnUnit(state, ownerId, 'shock_trooper', squadX, squadY);
    spawnUnit(state, ownerId, 'ew_sapper', squadX - 24, squadY + 22);
    spawnUnit(state, ownerId, 'wolf_pack', squadX - 42, squadY);
    spawnUnit(state, ownerId, 'type_99x', squadX - 70, squadY - 24);
  } else {
    spawnUnit(state, ownerId, 'teleop_militia', squadX, squadY);
    spawnUnit(state, ownerId, 'ied_crawler', squadX + 30, squadY + 18);
    spawnUnit(state, ownerId, 'shahed_launcher', squadX + 62, squadY - 12);
    spawnUnit(state, ownerId, 'tunnel_crawler', squadX + 36, squadY - 36);
  }
}

function getPathModeForEntity(ent: { defId: string; burrowed: boolean }): PathMode {
  const def = UNIT_DEFS[ent.defId as UnitId];
  if (def.tags.includes('AIR')) return 'air';
  if (def.tags.includes('NAVAL')) return 'naval';
  if (ent.burrowed) return 'burrowed';
  return 'ground';
}

export function dispatchCommand(state: GameState, cmd: SimCommand): void {
  const player = state.players[cmd.playerId];
  if (!player || player.defeated || state.winnerId) return;

  switch (cmd.type) {
    case 'startBuildBuilding': {
      const def = BUILDING_DEFS[cmd.defId];
      if (!isAvailableForFaction(def.faction, player.faction)) return;
      if (player.buildingQueue || player.readyBuildingDefId) return;
      if (!hasBuildingDef(state, cmd.playerId, 'conyard')) return;
      if (def.requires?.some((req) => !hasBuildingDef(state, cmd.playerId, req))) return;
      if (player.silicon < def.cost) {
        if (cmd.playerId === 'p1') pushAlert(state, 'Insufficient Silicon reserves.', 'warn');
        return;
      }
      player.silicon -= def.cost;
      player.buildingQueue = {
        kind: 'building',
        defId: def.id,
        progress: 0,
        totalTime: def.buildTime,
        cost: def.cost,
      };
      return;
    }

    case 'cancelBuildBuilding': {
      if (player.buildingQueue) {
        player.silicon += player.buildingQueue.cost;
        player.buildingQueue = null;
      } else if (player.readyBuildingDefId) {
        player.silicon += BUILDING_DEFS[player.readyBuildingDefId].cost;
        player.readyBuildingDefId = null;
      }
      return;
    }

    case 'placeBuilding': {
      if (player.readyBuildingDefId !== cmd.defId) return;
      const check = canPlaceBuilding(state, cmd.playerId, cmd.defId, cmd.tileX, cmd.tileY);
      if (!check.ok) {
        if (cmd.playerId === 'p1') pushAlert(state, check.reason ?? 'Cannot deploy here.', 'warn');
        return;
      }
      const bld = spawnBuilding(state, cmd.playerId, cmd.defId, cmd.tileX, cmd.tileY);
      player.readyBuildingDefId = null;
      if (cmd.defId === 'relay_hub') {
        spawnUnit(state, cmd.playerId, 'relay_crawler', bld.x, bld.y + 56);
      }
      return;
    }

    case 'queueUnit': {
      const def = UNIT_DEFS[cmd.defId];
      if (def.id === 'shahed_drone') return;
      if (!isAvailableForFaction(def.faction, player.faction)) return;
      if (!hasBuildingDef(state, cmd.playerId, def.producedBy)) return;
      if (player.unitQueue.length >= 6) return;
      const effectiveCost = player.chokepointTimer > 0 ? def.cost * 2 : def.cost;
      if (player.silicon < effectiveCost) {
        if (cmd.playerId === 'p1') pushAlert(state, 'Insufficient Silicon for unit.', 'warn');
        return;
      }
      player.silicon -= effectiveCost;
      player.unitQueue.push({
        kind: 'unit',
        defId: def.id,
        progress: 0,
        totalTime: def.buildTime,
        cost: effectiveCost,
      });
      return;
    }

    case 'cancelUnit': {
      if (cmd.index >= 0 && cmd.index < player.unitQueue.length) {
        const [removed] = player.unitQueue.splice(cmd.index, 1);
        player.silicon += removed.cost;
      }
      return;
    }

    case 'moveUnits': {
      const count = cmd.unitIds.length;
      const cols = Math.ceil(Math.sqrt(count));
      cmd.unitIds.forEach((uid, idx) => {
        const u = state.entities[uid];
        if (!u || u.kind !== 'unit' || u.ownerId !== cmd.playerId) return;
        const ox = ((idx % cols) - (cols - 1) / 2) * 30;
        const oy = (Math.floor(idx / cols) - (Math.ceil(count / cols) - 1) / 2) * 30;
        const tx = Math.max(24, Math.min(state.map.width * state.map.tileSize - 24, cmd.x + ox));
        const ty = Math.max(24, Math.min(state.map.height * state.map.tileSize - 24, cmd.y + oy));
        u.order = {
          type: cmd.attackMove ? 'attackMove' : 'move',
          targetX: tx,
          targetY: ty,
        };
        u.path = findPath(state, u.x, u.y, tx, ty, getPathModeForEntity(u));
        u.pathAge = 0;
      });
      return;
    }

    case 'stopUnits': {
      for (const uid of cmd.unitIds) {
        const u = state.entities[uid];
        if (!u || u.kind !== 'unit' || u.ownerId !== cmd.playerId) continue;
        u.order = { type: 'idle', targetX: u.x, targetY: u.y };
        u.path = [];
        u.vx = 0;
        u.vy = 0;
      }
      return;
    }

    case 'attackEntity': {
      const target = state.entities[cmd.targetId];
      if (!target || target.ownerId === cmd.playerId) return;
      for (const uid of cmd.unitIds) {
        const u = state.entities[uid];
        if (!u || u.kind !== 'unit' || u.ownerId !== cmd.playerId) continue;
        u.order = {
          type: 'attackTarget',
          targetX: target.x,
          targetY: target.y,
          targetEntityId: target.id,
        };
        u.path = findPath(state, u.x, u.y, target.x, target.y, getPathModeForEntity(u));
        u.pathAge = 0;
      }
      return;
    }

    case 'harvestNode': {
      const node = state.entities[cmd.nodeId];
      if (!node || node.defId !== 'silicon_node') return;
      for (const uid of cmd.unitIds) {
        const u = state.entities[uid];
        if (!u || u.kind !== 'unit' || u.ownerId !== cmd.playerId) continue;
        if (!UNIT_DEFS[u.defId as UnitId].canHarvest) continue;
        u.order = {
          type: 'harvest',
          targetX: node.x,
          targetY: node.y,
          targetEntityId: node.id,
        };
        u.path = findPath(state, u.x, u.y, node.x, node.y);
        u.pathAge = 0;
      }
      return;
    }

    case 'captureBuilding': {
      const target = state.entities[cmd.targetId];
      if (!target || target.kind !== 'building' || !BUILDING_DEFS[target.defId as BuildingId]?.isNeutralCapture) {
        return;
      }
      for (const uid of cmd.unitIds) {
        const u = state.entities[uid];
        if (!u || u.kind !== 'unit' || u.ownerId !== cmd.playerId) continue;
        u.order = {
          type: 'capture',
          targetX: target.x,
          targetY: target.y,
          targetEntityId: target.id,
        };
        u.path = findPath(state, u.x, u.y, target.x, target.y);
      }
      return;
    }

    case 'plantImplant': {
      const target = state.entities[cmd.targetId];
      if (!target || target.kind !== 'building' || target.defId !== 'server_farm') return;
      for (const uid of cmd.unitIds) {
        const u = state.entities[uid];
        if (!u || u.kind !== 'unit' || u.ownerId !== cmd.playerId || u.defId !== 'unit_8200') continue;
        u.order = {
          type: 'implant',
          targetX: target.x,
          targetY: target.y,
          targetEntityId: target.id,
        };
        u.path = findPath(state, u.x, u.y, target.x, target.y);
      }
      return;
    }

    case 'deployMcv': {
      const mcv = state.entities[cmd.unitId];
      if (!mcv || mcv.kind !== 'unit' || mcv.ownerId !== cmd.playerId || mcv.defId !== 'mcv') return;
      const tx = Math.max(0, Math.floor(mcv.x / state.map.tileSize) - 1);
      const ty = Math.max(0, Math.floor(mcv.y / state.map.tileSize) - 1);
      delete state.entities[mcv.id];
      state.entityOrder = state.entityOrder.filter((id) => id !== mcv.id);
      spawnBuilding(state, cmd.playerId, 'conyard', tx, ty);
      return;
    }

    case 'deploySmoke': {
      for (const uid of cmd.unitIds) {
        const u = state.entities[uid];
        if (!u || u.kind !== 'unit' || u.ownerId !== cmd.playerId || u.safeMode) continue;
        const def = UNIT_DEFS[u.defId as UnitId];
        if (!def.canDeploySmoke || u.smokeCooldown > 0) continue;
        u.smokeCooldown = 14;
        state.smokeClouds.push({
          id: nextId(state, 'smoke'),
          ownerId: cmd.playerId,
          x: u.x,
          y: u.y,
          radius: 115,
          life: 8,
          maxLife: 8,
        });
        if (cmd.playerId === 'p1') {
          pushAlert(state, 'Aerosol Smoke deployed (-80% laser damage).', 'info');
        }
      }
      return;
    }

    case 'deployTether': {
      if (cmd.playerId === 'p1') {
        pushAlert(state, 'Fiber-Optic Tether Spool active around EW Sapper (immune to jam/hack).', 'info');
      }
      return;
    }

    case 'toggleBurrow': {
      for (const uid of cmd.unitIds) {
        const u = state.entities[uid];
        if (!u || u.kind !== 'unit' || u.ownerId !== cmd.playerId) continue;
        if (!UNIT_DEFS[u.defId as UnitId].canBurrow) continue;
        u.burrowed = !u.burrowed;
        u.path = [];
        if (cmd.playerId === 'p1') {
          pushAlert(
            state,
            u.burrowed ? 'Tunnel Borer submerged underground.' : 'Tunnel Borer surfaced!',
            'info'
          );
        }
      }
      return;
    }

    case 'launchSwarm': {
      for (const uid of cmd.unitIds) {
        const u = state.entities[uid];
        if (!u || u.kind !== 'unit' || u.ownerId !== cmd.playerId) continue;
        if (UNIT_DEFS[u.defId as UnitId].canLaunchSwarm) {
          launchSwarmFromUnit(state, u, cmd.x, cmd.y);
        }
      }
      return;
    }

    case 'toggleOverclock': {
      player.overclock = !player.overclock;
      if (cmd.playerId === 'p1') {
        pushAlert(
          state,
          player.overclock ? 'OVERCLOCK ACTIVE: 150% output — monitor thermals!' : 'Overclock disengaged.',
          player.overclock ? 'warn' : 'info'
        );
      }
      return;
    }

    case 'useCyberPower': {
      executeCyberPower(state, cmd.playerId, cmd.powerId, cmd.x, cmd.y);
      return;
    }

    case 'payRansom': {
      if (player.ransomwareTimer > 0 && player.silicon >= 350) {
        player.silicon -= 350;
        player.ransomwareTimer = 0;
        if (cmd.playerId === 'p1') {
          pushAlert(state, 'Ransom paid (-350 Si): Factories unlocked!', 'info');
        }
      }
      return;
    }

    case 'fireSuperweapon': {
      executeSuperweapon(state, cmd.playerId, cmd.x, cmd.y);
      return;
    }

    case 'setRallyPoint': {
      player.rallyPoint = { x: cmd.x, y: cmd.y };
      return;
    }

    case 'sellBuilding': {
      const b = state.entities[cmd.buildingId];
      if (
        !b ||
        b.kind !== 'building' ||
        b.ownerId !== cmd.playerId ||
        BUILDING_DEFS[b.defId as BuildingId]?.isNeutralCapture
      ) {
        return;
      }
      const refund = Math.round(BUILDING_DEFS[b.defId as BuildingId].cost * 0.5);
      player.silicon += refund;
      delete state.entities[b.id];
      state.entityOrder = state.entityOrder.filter((id) => id !== b.id);
      return;
    }

    case 'toggleRepair': {
      const damaged = cmd.entityIds
        .map((id) => state.entities[id])
        .filter(
          (e) =>
            e &&
            e.ownerId === cmd.playerId &&
            e.defId !== 'silicon_node' &&
            e.hp > 0 &&
            e.hp < e.maxHp
        );
      if (damaged.length === 0) return;
      const allActive = damaged.every((e) => Boolean(e.manualRepair));
      if (allActive) {
        for (const e of damaged) e.manualRepair = false;
        return;
      }
      if (player.silicon < 2) {
        if (cmd.playerId === 'p1') {
          pushAlert(state, 'Insufficient Silicon reserves.', 'warn');
        }
        return;
      }
      for (const e of damaged) e.manualRepair = true;
      return;
    }
  }
}

export function stepSimulation(state: GameState): void {
  if (state.winnerId) return;
  const dt = 1 / state.tickRate;
  state.tick += 1;
  state.elapsedSeconds = state.tick * dt;

  updateAbilitiesAndSuperweapons(state, dt);
  updateGridAndEconomy(state, dt);
  updateCampaignEvents(state);
  updateAiCommander(state, dt, dispatchCommand);
  updateCombatAndMovement(state, dt);

  const p1Alive = hasVitalAssets(state, 'p1');
  const aiAlive = hasVitalAssets(state, 'ai1');
  if (!aiAlive && p1Alive) {
    state.players.ai1.defeated = true;
    state.winnerId = 'p1';
  } else if (!p1Alive && aiAlive) {
    state.players.p1.defeated = true;
    state.winnerId = 'ai1';
  }
}

function hasVitalAssets(state: GameState, playerId: string): boolean {
  for (const id of state.entityOrder) {
    const e = state.entities[id];
    if (!e || e.ownerId !== playerId) continue;
    if (e.kind === 'building' && !BUILDING_DEFS[e.defId as BuildingId]?.isNeutralCapture) return true;
    if (e.kind === 'unit' && e.defId === 'mcv') return true;
  }
  return false;
}
