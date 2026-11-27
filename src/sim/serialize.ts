import type { Entity, GameState, PlayerState } from './types';

export interface SavePayload {
  schemaVersion: 1 | 2;
  savedAt: string;
  checksum: string;
  state: GameState;
}

function fnv1aUpdate(hash: number, str: string): number {
  let h = hash >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

export function computeStateChecksum(state: GameState): string {
  let h = 0x811c9dc5;
  h = fnv1aUpdate(
    h,
    `${state.tick}|${state.nextEntitySeq}|${state.winnerId ?? ''}|${Math.round(state.kesslerTimer * 10)}`
  );
  h = fnv1aUpdate(h, `${state.rng.s0},${state.rng.s1},${state.rng.s2},${state.rng.s3}`);

  for (const pid of Object.keys(state.players).sort()) {
    const p = state.players[pid];
    h = fnv1aUpdate(
      h,
      `${p.id}:${Math.round(p.silicon * 100)}:${p.powerProduced}:${p.powerConsumed}:${p.flopsCap}:${p.flopsUsed}:${p.overclock ? 1 : 0}:${Math.round(p.thermalLoad * 10)}:${Math.round(p.qDayProgress * 10)}:${p.qDayActive ? 1 : 0}:${Math.round(p.superweaponCharge * 10)}:${Math.round(p.ransomwareTimer * 10)}:${Math.round(p.chokepointTimer * 10)}`
    );
  }

  for (const id of state.entityOrder) {
    const e = state.entities[id];
    if (!e) continue;
    h = fnv1aUpdate(
      h,
      `${e.id}:${e.ownerId}:${e.defId}:${Math.round(e.x * 10)},${Math.round(e.y * 10)}:${Math.round(e.hp * 10)}:${e.safeMode ? 1 : 0}:${e.tethered ? 1 : 0}:${e.burrowed ? 1 : 0}:${Math.round(e.poisonTimer * 10)}:${e.kills}`
    );
  }

  return h.toString(16).padStart(8, '0');
}

export function serializeGameState(state: GameState): SavePayload {
  const cloned = structuredClone(state);
  return {
    schemaVersion: 2,
    savedAt: new Date().toISOString(),
    checksum: computeStateChecksum(cloned),
    state: cloned,
  };
}

function migrateV1ToV2(rawState: Record<string, unknown>): GameState {
  const s = structuredClone(rawState) as unknown as GameState;
  s.schemaVersion = 2;
  s.map.id ??= 'peninsula_grid';
  s.map.biome ??= 'arid';
  s.scorchMarks ??= [];
  s.missionId ??= null;
  s.missionStep ??= 0;
  s.tetherAnchors ??= [];
  s.poisonZones ??= [];
  s.spoofBlips ??= [];
  s.prometheusBeams ??= [];
  s.kesslerTimer ??= 0;
  s.kesslerOwnerId ??= null;

  for (const pid of Object.keys(s.players)) {
    const p = s.players[pid] as PlayerState;
    p.qDayProgress ??= 0;
    p.qDayActive ??= false;
    p.cyberCooldowns ??= {
      data_poison: 0,
      deepfake_spoof: 0,
      ransomware: 0,
      false_orders: 0,
    };
    p.ransomwareTimer ??= 0;
    p.superweaponCharge ??= 0;
    p.chokepointTimer ??= 0;
    p.implantedFlopsBonus ??= 0;
  }

  for (const id of Object.keys(s.entities)) {
    const e = s.entities[id] as Entity;
    e.tethered ??= false;
    e.poisonTimer ??= 0;
    e.empStunTimer ??= 0;
    e.burrowed ??= false;
    e.siloOpenTimer ??= 0;
    e.launchCooldown ??= 0;
    e.conversionProgress ??= 0;
    e.isRevealed ??= true;
  }

  return s;
}

export function deserializeGameState(raw: unknown): GameState {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid save file: expected object');
  }
  const payload = raw as Partial<SavePayload>;
  if ((payload.schemaVersion !== 1 && payload.schemaVersion !== 2) || !payload.state) {
    throw new Error('Unsupported or corrupted save schemaVersion');
  }
  if (payload.schemaVersion === 1) {
    return migrateV1ToV2(payload.state as unknown as Record<string, unknown>);
  }
  const cloned = structuredClone(payload.state);
  cloned.map.id ??= 'peninsula_grid';
  cloned.map.biome ??= 'arid';
  cloned.scorchMarks ??= [];
  cloned.missionId ??= null;
  cloned.missionStep ??= 0;
  if (payload.checksum) {
    const actual = computeStateChecksum(cloned);
    if (actual !== payload.checksum) {
      throw new Error(`Save checksum mismatch (expected ${payload.checksum}, got ${actual})`);
    }
  }
  return cloned;
}
