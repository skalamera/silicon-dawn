import { BUILDING_DEFS, type BuildingId, type UnitId } from '../data/defs';
import { getOpponentId, getPlayerBuildings, hasBuildingDef } from './helpers';
import { canPlaceBuilding } from './pathfinding';
import { nextInt } from './prng';
import type { GameState, SimCommand } from './types';

export function updateAiCommander(
  state: GameState,
  dt: number,
  dispatch: (state: GameState, cmd: SimCommand) => void
): void {
  if (state.config.isDemo) return;
  for (const pid of Object.keys(state.players)) {
    const ai = state.players[pid];
    if (!ai.isAi || ai.defeated || pid === 'neutral') continue;

    ai.aiTimer -= dt;
    ai.aiWaveTimer -= dt;

    if (ai.aiTimer > 0) continue;
    ai.aiTimer = ai.aiDifficulty === 'commander' ? 1.4 : 2.6;

    // Pay ransomware automatically on Commander if wealthy
    if (ai.ransomwareTimer > 0 && ai.silicon >= 500 && ai.aiDifficulty === 'commander') {
      dispatch(state, { type: 'payRansom', playerId: pid });
    }

    if (ai.readyBuildingDefId) {
      const placed = tryPlaceAiBuilding(state, pid, ai.readyBuildingDefId, dispatch);
      if (!placed) {
        dispatch(state, { type: 'cancelBuildBuilding', playerId: pid });
      }
      continue;
    }

    // 1. Structure Expansion (including Cryo-Core & Superweapon in longer matches)
    if (!ai.buildingQueue) {
      const buildings = getPlayerBuildings(state, pid);
      const conyard = buildings.find((b) => b.defId === 'conyard');
      if (conyard) {
        const hasRelay = hasBuildingDef(state, pid, 'relay_hub');
        const hasBarracks = hasBuildingDef(state, pid, 'barracks');
        const hasFactory = hasBuildingDef(state, pid, 'war_factory');
        const hasCryo = hasBuildingDef(state, pid, 'cryo_core');
        const hasSeismic = hasBuildingDef(state, pid, 'seismic_sensor');
        const defenseId: BuildingId =
          ai.faction === 'alliance'
            ? 'iron_beam'
            : ai.faction === 'pact'
            ? 'hpm_tower'
            : 'popup_silo';
        const defenseCount = buildings.filter((b) => b.defId === defenseId).length;

        let desired: BuildingId | null = null;
        if (ai.powerRatio < 1.18) {
          desired = 'smr';
        } else if (!hasRelay) {
          desired = 'relay_hub';
        } else if (!hasBarracks) {
          desired = 'barracks';
        } else if (ai.flopsUsed > ai.flopsCap * 0.76) {
          desired = 'server_farm';
        } else if (!hasFactory) {
          desired = 'war_factory';
        } else if (!hasSeismic && ai.aiDifficulty === 'commander') {
          desired = 'seismic_sensor';
        } else if (defenseCount < 2) {
          desired = defenseId;
        } else if (!hasCryo && ai.silicon >= 1300) {
          desired = 'cryo_core';
        }

        if (desired && ai.silicon >= BUILDING_DEFS[desired].cost) {
          dispatch(state, { type: 'startBuildBuilding', playerId: pid, defId: desired });
        }
      }
    }

    // 2. Queue Units for Alliance / Pact / Axis
    if (ai.unitQueue.length < 3) {
      const hasBarracks = hasBuildingDef(state, pid, 'barracks');
      const hasFactory = hasBuildingDef(state, pid, 'war_factory');
      const crawlers = state.entityOrder.filter((id) => {
        const e = state.entities[id];
        return e && e.ownerId === pid && e.defId === 'relay_crawler';
      }).length;

      let unitToBuild: UnitId | null = null;
      if (hasFactory && crawlers < 2) {
        unitToBuild = 'relay_crawler';
      } else if (ai.faction === 'pact') {
        if (hasFactory && ai.silicon >= 650) {
          const r = nextInt(state.rng, 0, 4);
          unitToBuild = r === 0 ? 'krasukha_q' : r === 1 && ai.silicon >= 1050 ? 'tos_3' : 'type_99x';
        } else if (hasBarracks && ai.silicon >= 350) {
          const r = nextInt(state.rng, 0, 2);
          unitToBuild = r === 0 ? 'wolf_pack' : r === 1 ? 'ew_sapper' : 'shock_trooper';
        }
      } else if (ai.faction === 'axis') {
        if (hasFactory && ai.silicon >= 760) {
          unitToBuild = nextInt(state.rng, 0, 2) === 0 ? 'tunnel_crawler' : 'shahed_launcher';
        } else if (hasBarracks && ai.silicon >= 240) {
          unitToBuild = nextInt(state.rng, 0, 1) === 0 ? 'teleop_militia' : 'ied_crawler';
        }
      } else {
        if (hasFactory && ai.silicon >= 850) {
          const r = nextInt(state.rng, 0, 3);
          unitToBuild = r === 0 ? 'smoke_carrier' : r === 1 ? 'loyal_wingman' : 'm1e4';
        } else if (hasBarracks && ai.silicon >= 340) {
          const r = nextInt(state.rng, 0, 2);
          unitToBuild = r === 0 ? 'forward_controller' : r === 1 ? 'quantum_loiter' : 'valkyrie';
        }
      }

      if (unitToBuild) {
        dispatch(state, { type: 'queueUnit', playerId: pid, defId: unitToBuild });
      }
    }

    // 3. Use Cyber Powers (only after early-game defense build window) & Launch Graduated Waves
    const enemyId = getOpponentId(pid);
    const enemyBuildings = getPlayerBuildings(state, enemyId);
    if (
      state.elapsedSeconds >= 240 &&
      hasBuildingDef(state, pid, 'cryo_core') &&
      enemyBuildings.length > 0
    ) {
      if (ai.cyberCooldowns.ransomware <= 0 && ai.aiDifficulty === 'commander') {
        dispatch(state, { type: 'useCyberPower', playerId: pid, powerId: 'ransomware', x: 0, y: 0 });
      } else if (ai.cyberCooldowns.data_poison <= 0) {
        const tgt = enemyBuildings[0];
        dispatch(state, {
          type: 'useCyberPower',
          playerId: pid,
          powerId: 'data_poison',
          x: tgt.x,
          y: tgt.y,
        });
      }
    }

    if (ai.aiWaveTimer <= 0) {
      ai.aiWaveTimer = ai.aiDifficulty === 'commander' ? 75 : 105;
      // Give Boot Sequence tutorial players a peaceful 6-minute build window
      if (state.missionId === 'boot_sequence' && state.elapsedSeconds < 360) {
        continue;
      }
      const combatIds: string[] = [];
      for (const id of state.entityOrder) {
        const e = state.entities[id];
        if (
          e &&
          e.kind === 'unit' &&
          e.ownerId === pid &&
          e.defId !== 'relay_crawler' &&
          e.defId !== 'mcv'
        ) {
          combatIds.push(id);
        }
      }

      const minWave = ai.aiDifficulty === 'commander' ? 4 : 6;
      if (combatIds.length >= minWave && enemyBuildings.length > 0) {
        // Graduated escalation: early probe -> mid escalation -> late full assault
        const waveSlice =
          state.elapsedSeconds < 340
            ? combatIds.slice(0, 3)
            : state.elapsedSeconds < 520
            ? combatIds.slice(0, Math.max(5, Math.ceil(combatIds.length * 0.6)))
            : combatIds;

        // AI gets fooled by Deepfake Spoof Blips or Decoy Batteries if present!
        const decoy = enemyBuildings.find((b) => b.defId === 'decoy_battery');
        const spoof = state.spoofBlips.find((s) => s.ownerId === enemyId);
        const target = spoof
          ? { x: spoof.x, y: spoof.y }
          : decoy && nextInt(state.rng, 0, 2) === 0
          ? decoy
          : enemyBuildings[nextInt(state.rng, 0, enemyBuildings.length - 1)];

        dispatch(state, {
          type: 'moveUnits',
          playerId: pid,
          unitIds: waveSlice,
          x: target.x,
          y: target.y,
          attackMove: true,
        });
      }
    }
  }
}

function tryPlaceAiBuilding(
  state: GameState,
  playerId: string,
  defId: BuildingId,
  dispatch: (state: GameState, cmd: SimCommand) => void
): boolean {
  const buildings = getPlayerBuildings(state, playerId);
  const anchor = buildings.find((b) => b.defId === 'conyard') ?? buildings[0];
  if (!anchor) return false;

  const ax = anchor.tileX ?? Math.floor(anchor.x / state.map.tileSize);
  const ay = anchor.tileY ?? Math.floor(anchor.y / state.map.tileSize);

  for (let r = 2; r <= 7; r++) {
    for (let attempt = 0; attempt < 16; attempt++) {
      const tx = ax + nextInt(state.rng, -r, r);
      const ty = ay + nextInt(state.rng, -r, r);
      if (canPlaceBuilding(state, playerId, defId, tx, ty).ok) {
        dispatch(state, { type: 'placeBuilding', playerId, defId, tileX: tx, tileY: ty });
        return true;
      }
    }
  }
  return false;
}
