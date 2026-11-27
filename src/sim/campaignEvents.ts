import { getMissionById } from '../data/missions';
import { pushAlert, spawnUnit } from './helpers';
import type { GameState } from './types';

function findFriendlyConyard(state: GameState) {
  for (const id of state.entityOrder) {
    const e = state.entities[id];
    if (e && e.ownerId === 'p1' && e.kind === 'building' && e.defId === 'conyard') {
      return e;
    }
  }
  return null;
}

/**
 * Deterministic campaign narrative drops, early-warning recon alerts, and
 * bonus-objective rewards tracked cleanly inside state.missionStep bit flags.
 */
export function updateCampaignEvents(state: GameState): void {
  if (!state.missionId || state.config.isDemo) return;
  const mission = getMissionById(state.missionId);
  if (!mission) return;

  const stage = state.missionStep & 7;
  const bonusPaid = (state.missionStep & 8) !== 0;

  // Stage 1: Tactical supply & unit reinforcement drop (~1:45 in)
  if (stage < 1 && state.elapsedSeconds >= 105) {
    state.missionStep = (state.missionStep & ~7) | 1;
    state.players.p1.silicon += 450;
    const cy = findFriendlyConyard(state);
    if (cy) {
      const dropX = cy.x + 150;
      const dropY = cy.y - 110;
      if (state.players.p1.faction === 'alliance') {
        spawnUnit(state, 'p1', 'valkyrie', dropX, dropY);
        spawnUnit(state, 'p1', 'quantum_loiter', dropX + 36, dropY - 24);
      } else if (state.players.p1.faction === 'pact') {
        spawnUnit(state, 'p1', 'shock_trooper', dropX, dropY);
        spawnUnit(state, 'p1', 'ew_sapper', dropX + 36, dropY - 24);
      } else {
        spawnUnit(state, 'p1', 'teleop_militia', dropX, dropY);
        spawnUnit(state, 'p1', 'ied_crawler', dropX + 36, dropY - 24);
      }
    }
    pushAlert(
      state,
      'REINFORCEMENTS ARRIVED: +450 Si supply drop and forward support squad deployed at base.',
      'info'
    );
  }

  // Stage 2: Early-warning recon alert ahead of the first AI probe wave
  const warnAt = state.players.ai1.aiDifficulty === 'commander' ? 190 : 270;
  if ((state.missionStep & 7) < 2 && state.elapsedSeconds >= warnAt) {
    state.missionStep = (state.missionStep & ~7) | 2;
    pushAlert(
      state,
      'RECON ALERT: Hostile advance column mobilizing in the northeast — finish perimeter turrets!',
      'warn'
    );
  }

  // Bonus Objective War-Chest Reward (+600 Si once when met)
  if (!bonusPaid && mission.bonusObjective.check(state, { emVisited: true, overlayMode: 'tactical' })) {
    state.missionStep |= 8;
    state.players.p1.silicon += 600;
    pushAlert(
      state,
      'BONUS OBJECTIVE COMPLETE: +600 Silicon war-chest grant awarded!',
      'info'
    );
  }
}
