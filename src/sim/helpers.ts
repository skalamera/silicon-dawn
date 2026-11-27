import { BUILDING_DEFS, UNIT_DEFS, type BuildingId, type UnitId } from '../data/defs';
import type { Entity, GameState } from './types';
import { isWaterTile } from './mapGen';

export function nextId(state: GameState, prefix: string): string {
  state.nextEntitySeq += 1;
  return `${prefix}_${state.nextEntitySeq}`;
}

export function pushAlert(
  state: GameState,
  text: string,
  tone: 'info' | 'warn' | 'danger' = 'info'
): void {
  if (state.alerts.some((a) => a.text === text && a.ttl > 1.5)) return;
  state.alerts.unshift({
    id: nextId(state, 'alert'),
    text,
    tone,
    ttl: 4.5,
  });
  if (state.alerts.length > 4) {
    state.alerts.length = 4;
  }
}

export function isBuildingAdjacentToWater(
  state: GameState,
  tileX: number,
  tileY: number,
  w: number,
  h: number
): boolean {
  for (let dy = -1; dy <= h; dy++) {
    for (let dx = -1; dx <= w; dx++) {
      if (isWaterTile(state.map, tileX + dx, tileY + dy)) {
        return true;
      }
    }
  }
  return false;
}

export function spawnBuilding(
  state: GameState,
  ownerId: string,
  defId: BuildingId,
  tileX: number,
  tileY: number
): Entity {
  const def = BUILDING_DEFS[defId];
  const { tileSize } = state.map;
  const id = nextId(state, 'bld');
  const ent: Entity = {
    id,
    kind: 'building',
    defId,
    ownerId,
    x: (tileX + def.footprintW * 0.5) * tileSize,
    y: (tileY + def.footprintH * 0.5) * tileSize,
    vx: 0,
    vy: 0,
    angle: 0,
    turretAngle: 0,
    hp: def.hp,
    maxHp: def.hp,
    kills: 0,
    veterancy: 0,
    cooldown: 0,
    apsCooldown: 0,
    smokeCooldown: 0,
    slowTimer: 0,
    safeMode: false,
    humanOverride: false,
    jammed: false,
    tethered: false,
    poisonTimer: 0,
    empStunTimer: 0,
    burrowed: false,
    siloOpenTimer: 0,
    launchCooldown: 0,
    conversionProgress: 0,
    isRevealed: true,
    waterCooled: Boolean(
      def.waterCoolingBonus &&
        isBuildingAdjacentToWater(state, tileX, tileY, def.footprintW, def.footprintH)
    ),
    repairing: false,
    tileX,
    tileY,
    siliconRemaining: def.isResourceNode ? 9500 : undefined,
    captureProgress: def.isNeutralCapture ? 0 : undefined,
    order: { type: 'idle', targetX: 0, targetY: 0 },
    path: [],
    pathAge: 0,
  };
  state.entities[id] = ent;
  state.entityOrder.push(id);
  return ent;
}

export function spawnUnit(
  state: GameState,
  ownerId: string,
  defId: UnitId,
  x: number,
  y: number
): Entity {
  const def = UNIT_DEFS[defId];
  const id = nextId(state, 'unit');
  const ent: Entity = {
    id,
    kind: 'unit',
    defId,
    ownerId,
    x,
    y,
    vx: 0,
    vy: 0,
    angle: ownerId === 'p1' ? -Math.PI * 0.25 : Math.PI * 0.75,
    turretAngle: ownerId === 'p1' ? -Math.PI * 0.25 : Math.PI * 0.75,
    hp: def.hp,
    maxHp: def.hp,
    kills: 0,
    veterancy: 0,
    cooldown: 0,
    apsCooldown: 0,
    smokeCooldown: 0,
    slowTimer: 0,
    safeMode: false,
    humanOverride: false,
    jammed: false,
    tethered: false,
    poisonTimer: 0,
    empStunTimer: 0,
    burrowed: false,
    siloOpenTimer: 0,
    launchCooldown: 0,
    conversionProgress: 0,
    isRevealed: !def.tags.includes('STEALTH'),
    waterCooled: false,
    repairing: false,
    order: { type: 'idle', targetX: x, targetY: y },
    path: [],
    pathAge: 0,
  };
  state.entities[id] = ent;
  state.entityOrder.push(id);
  return ent;
}

export function getPlayerBuildings(state: GameState, playerId: string): Entity[] {
  const list: Entity[] = [];
  for (const id of state.entityOrder) {
    const e = state.entities[id];
    if (e && e.kind === 'building' && e.ownerId === playerId) list.push(e);
  }
  return list;
}

export function hasBuildingDef(state: GameState, playerId: string, defId: BuildingId): boolean {
  for (const id of state.entityOrder) {
    const e = state.entities[id];
    if (e && e.kind === 'building' && e.ownerId === playerId && e.defId === defId) {
      return true;
    }
  }
  return false;
}

export function computeLatencyFactor(flopsUsed: number, flopsCap: number): number {
  if (flopsUsed <= 0) return 1.0;
  if (flopsCap <= 0) return 0.4;
  const ratio = flopsCap / flopsUsed;
  if (ratio >= 1.0) return 1.0;
  if (ratio >= 0.75) return 0.85;
  if (ratio >= 0.5) return 0.65;
  return 0.4;
}

export function getOpponentId(playerId: string): string {
  return playerId === 'p1' ? 'ai1' : 'p1';
}
