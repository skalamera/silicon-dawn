import { BUILDING_DEFS, type BuildingId } from '../data/defs';
import type { Entity, GameState } from './types';
import { isTilePassable, isWaterTile } from './mapGen';

export type PathMode = 'ground' | 'naval' | 'burrowed' | 'air';

export function buildBlockedGrid(
  state: GameState,
  mode: Exclude<PathMode, 'air'> = 'ground',
  ignoreEntityId?: string
): Uint8Array {
  const { width, height, tiles } = state.map;
  const blocked = new Uint8Array(width * height);
  for (let i = 0; i < tiles.length; i++) {
    if (mode === 'naval') {
      if (tiles[i] !== 'water') blocked[i] = 1;
    } else if (mode === 'burrowed') {
      if (tiles[i] === 'water') blocked[i] = 1;
    } else {
      if (tiles[i] !== 'sand' && tiles[i] !== 'concrete') blocked[i] = 1;
    }
  }

  if (mode !== 'burrowed') {
    for (const id of state.entityOrder) {
      if (id === ignoreEntityId) continue;
      const ent = state.entities[id];
      if (!ent || ent.kind !== 'building') continue;
      const def = BUILDING_DEFS[ent.defId as BuildingId];
      const tx = ent.tileX ?? 0;
      const ty = ent.tileY ?? 0;
      for (let dy = 0; dy < def.footprintH; dy++) {
        for (let dx = 0; dx < def.footprintW; dx++) {
          const gx = tx + dx;
          const gy = ty + dy;
          if (gx >= 0 && gy >= 0 && gx < width && gy < height) {
            blocked[gy * width + gx] = 1;
          }
        }
      }
    }
  }
  return blocked;
}

function findNearestPassableTile(
  blocked: Uint8Array,
  w: number,
  h: number,
  startX: number,
  startY: number
): { tx: number; ty: number } {
  const cx = Math.max(0, Math.min(w - 1, startX));
  const cy = Math.max(0, Math.min(h - 1, startY));
  if (blocked[cy * w + cx] === 0) return { tx: cx, ty: cy };

  for (let r = 1; r <= 10; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx >= 0 && ny >= 0 && nx < w && ny < h && blocked[ny * w + nx] === 0) {
          return { tx: nx, ty: ny };
        }
      }
    }
  }
  return { tx: cx, ty: cy };
}

export function findPath(
  state: GameState,
  startX: number,
  startY: number,
  goalX: number,
  goalY: number,
  mode: PathMode = 'ground'
): Array<{ x: number; y: number }> {
  if (mode === 'air') {
    return [{ x: goalX, y: goalY }];
  }

  const { width: w, height: h, tileSize } = state.map;
  const blocked = buildBlockedGrid(state, mode);

  const st = findNearestPassableTile(
    blocked,
    w,
    h,
    Math.floor(startX / tileSize),
    Math.floor(startY / tileSize)
  );
  const gl = findNearestPassableTile(
    blocked,
    w,
    h,
    Math.floor(goalX / tileSize),
    Math.floor(goalY / tileSize)
  );

  if (st.tx === gl.tx && st.ty === gl.ty) {
    return [{ x: goalX, y: goalY }];
  }

  const total = w * h;
  const gScore = new Float32Array(total).fill(Infinity);
  const fScore = new Float32Array(total).fill(Infinity);
  const cameFrom = new Int32Array(total).fill(-1);
  const closed = new Uint8Array(total);
  const openList: number[] = [];

  const startIdx = st.ty * w + st.tx;
  const goalIdx = gl.ty * w + gl.tx;

  gScore[startIdx] = 0;
  fScore[startIdx] = Math.hypot(gl.tx - st.tx, gl.ty - st.ty);
  openList.push(startIdx);

  const dirs = [
    [1, 0, 1],
    [-1, 0, 1],
    [0, 1, 1],
    [0, -1, 1],
    [1, 1, 1.414],
    [-1, 1, 1.414],
    [1, -1, 1.414],
    [-1, -1, 1.414],
  ];

  let iterations = 0;
  const maxIter = 2400;

  while (openList.length > 0 && iterations < maxIter) {
    iterations++;
    let bestPos = 0;
    let bestF = fScore[openList[0]];
    for (let i = 1; i < openList.length; i++) {
      const f = fScore[openList[i]];
      if (f < bestF) {
        bestF = f;
        bestPos = i;
      }
    }
    const current = openList[bestPos];
    openList[bestPos] = openList[openList.length - 1];
    openList.pop();

    if (current === goalIdx) {
      const waypoints: Array<{ x: number; y: number }> = [];
      let cur = current;
      while (cur !== -1 && cur !== startIdx) {
        const cx = cur % w;
        const cy = Math.floor(cur / w);
        waypoints.push({
          x: cx * tileSize + tileSize * 0.5,
          y: cy * tileSize + tileSize * 0.5,
        });
        cur = cameFrom[cur];
      }
      waypoints.reverse();
      if (
        waypoints.length > 0 &&
        mode === 'ground' &&
        isTilePassable(state.map, Math.floor(goalX / tileSize), Math.floor(goalY / tileSize))
      ) {
        waypoints[waypoints.length - 1] = { x: goalX, y: goalY };
      }
      return waypoints;
    }

    closed[current] = 1;
    const cx = current % w;
    const cy = Math.floor(current / w);

    for (const [dx, dy, cost] of dirs) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const nIdx = ny * w + nx;
      if (closed[nIdx] || blocked[nIdx]) continue;
      if (dx !== 0 && dy !== 0) {
        if (blocked[cy * w + nx] || blocked[ny * w + cx]) continue;
      }
      const tentativeG = gScore[current] + cost;
      if (tentativeG < gScore[nIdx]) {
        cameFrom[nIdx] = current;
        gScore[nIdx] = tentativeG;
        fScore[nIdx] = tentativeG + Math.hypot(gl.tx - nx, gl.ty - ny);
        if (!openList.includes(nIdx)) {
          openList.push(nIdx);
        }
      }
    }
  }

  return [{ x: goalX, y: goalY }];
}

export function canPlaceBuilding(
  state: GameState,
  playerId: string,
  defId: BuildingId,
  tileX: number,
  tileY: number
): { ok: boolean; reason?: string } {
  const def = BUILDING_DEFS[defId];
  const { width, height, tileSize } = state.map;

  if (tileX < 0 || tileY < 0 || tileX + def.footprintW > width || tileY + def.footprintH > height) {
    return { ok: false, reason: 'Out of map bounds' };
  }

  const blocked = buildBlockedGrid(state, 'ground');
  for (let dy = 0; dy < def.footprintH; dy++) {
    for (let dx = 0; dx < def.footprintW; dx++) {
      if (blocked[(tileY + dy) * width + (tileX + dx)] !== 0) {
        return { ok: false, reason: 'Terrain or structure blocked' };
      }
    }
  }

  if (def.mustPlaceOnWaterEdge) {
    let touchesWater = false;
    for (let dy = -1; dy <= def.footprintH; dy++) {
      for (let dx = -1; dx <= def.footprintW; dx++) {
        if (isWaterTile(state.map, tileX + dx, tileY + dy)) {
          touchesWater = true;
          break;
        }
      }
      if (touchesWater) break;
    }
    if (!touchesWater) {
      return { ok: false, reason: 'Naval Yard must border coastal water' };
    }
    return { ok: true };
  }

  const centerX = (tileX + def.footprintW * 0.5) * tileSize;
  const centerY = (tileY + def.footprintH * 0.5) * tileSize;
  let nearBase = false;
  for (const id of state.entityOrder) {
    const ent = state.entities[id];
    if (!ent || ent.kind !== 'building' || ent.ownerId !== playerId) continue;
    const radius = ent.defId === 'conyard' ? 400 : 280;
    if (Math.hypot(ent.x - centerX, ent.y - centerY) <= radius) {
      nearBase = true;
      break;
    }
  }
  if (!nearBase) {
    return { ok: false, reason: 'Too far from base power/command perimeter' };
  }

  return { ok: true };
}

export function computeSeparation(state: GameState, unit: Entity): { sx: number; sy: number } {
  let sx = 0;
  let sy = 0;
  for (const id of state.entityOrder) {
    if (id === unit.id) continue;
    const other = state.entities[id];
    if (!other || other.kind !== 'unit' || other.burrowed !== unit.burrowed) continue;
    const dx = unit.x - other.x;
    const dy = unit.y - other.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 0.01 && dist < 24) {
      const push = (24 - dist) / 24;
      sx += (dx / dist) * push * 45;
      sy += (dy / dist) * push * 45;
    }
  }
  return { sx, sy };
}
