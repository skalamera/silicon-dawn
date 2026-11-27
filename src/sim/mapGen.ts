import type { BuildingId } from '../data/defs';
import type { MapBiome, MapData, MapId, TileKind } from './types';

export const MAP_WIDTH = 72;
export const MAP_HEIGHT = 54;
export const TILE_SIZE = 48;

export interface MapMeta {
  id: MapId;
  name: string;
  biome: MapBiome;
  description: string;
}

export interface GeneratedMapBundle {
  map: MapData;
  siliconNodes: Array<{ tileX: number; tileY: number; amount: number }>;
  neutralBuildings: Array<{ defId: BuildingId; tileX: number; tileY: number }>;
  p1Spawn: { tileX: number; tileY: number };
  aiSpawn: { tileX: number; tileY: number };
}

export const MAP_CATALOG: MapMeta[] = [
  {
    id: 'peninsula_grid',
    name: 'Peninsula Grid',
    biome: 'arid',
    description: 'Large 72×54 coastal peninsula with split central ridges, LNG Terminals & Subsea Fiber.',
  },
  {
    id: 'strait_chokepoint',
    name: 'Strait Chokepoint',
    biome: 'arid',
    description: 'Wide central littoral sea strait bridged by 2 concrete causeways; prime naval ambush terrain.',
  },
  {
    id: 'arctic_cryo',
    name: 'Arctic Cryo-Basin',
    biome: 'arctic',
    description: 'Glacial cooling rivers (+25% cooling), 2 Subsea Fiber Stations & Legacy Analog Radar.',
  },
  {
    id: 'megacity_grid',
    name: 'Megacity Grid',
    biome: 'urban',
    description: 'Sprawling urban avenue grid favoring Valkyries, Tunnel-Borers & Seismic Sensors.',
  },
  {
    id: 'fab_corridor',
    name: 'Wafer Fab Corridor',
    biome: 'arid',
    description: 'Expansive central Silicon valley with 6 high-yield clusters for large armored clashes.',
  },
];

function paintRect(
  tiles: TileKind[],
  w: number,
  h: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  kind: TileKind
): void {
  for (let y = Math.max(0, y1); y <= Math.min(h - 1, y2); y++) {
    for (let x = Math.max(0, x1); x <= Math.min(w - 1, x2); x++) {
      tiles[y * w + x] = kind;
    }
  }
}

export function createMapById(mapId: MapId = 'peninsula_grid'): GeneratedMapBundle {
  const w = MAP_WIDTH;
  const h = MAP_HEIGHT;
  const tiles: TileKind[] = new Array(w * h).fill('sand');
  const meta = MAP_CATALOG.find((m) => m.id === mapId) ?? MAP_CATALOG[0];

  const p1Spawn = { tileX: 8, tileY: 44 };
  const aiSpawn = { tileX: 61, tileY: 8 };

  const ensureBasePads = () => {
    paintRect(tiles, w, h, 3, 40, 17, 50, 'concrete');
    paintRect(tiles, w, h, 54, 3, 68, 13, 'concrete');
  };

  if (mapId === 'peninsula_grid') {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (x + y < 14) tiles[y * w + x] = 'water';
        if (w - 1 - x + (h - 1 - y) < 14) tiles[y * w + x] = 'water';
        if (y <= 3 && x < 42) tiles[y * w + x] = 'water';
        if (y >= h - 4 && x >= 30) tiles[y * w + x] = 'water';
      }
    }
    ensureBasePads();
    // Split central rocky ridge with North, Center, and South corridors
    paintRect(tiles, w, h, 32, 11, 38, 21, 'ridge');
    paintRect(tiles, w, h, 32, 22, 38, 22, 'cliff');
    paintRect(tiles, w, h, 33, 30, 39, 39, 'ridge');
    paintRect(tiles, w, h, 33, 40, 39, 40, 'cliff');
    paintRect(tiles, w, h, 26, 25, 45, 27, 'concrete');
    // Flank tactical ridges
    paintRect(tiles, w, h, 20, 18, 21, 24, 'ridge');
    paintRect(tiles, w, h, 20, 25, 21, 25, 'cliff');
    paintRect(tiles, w, h, 50, 28, 51, 34, 'ridge');
    paintRect(tiles, w, h, 50, 35, 51, 35, 'cliff');

    return {
      map: { id: mapId, name: meta.name, biome: meta.biome, width: w, height: h, tileSize: TILE_SIZE, tiles },
      siliconNodes: [
        { tileX: 6, tileY: 33, amount: 9500 },
        { tileX: 62, tileY: 18, amount: 9500 },
        { tileX: 25, tileY: 11, amount: 11500 },
        { tileX: 44, tileY: 40, amount: 11500 },
      ],
      neutralBuildings: [
        { defId: 'lng_terminal', tileX: 22, tileY: 45 },
        { defId: 'lng_terminal', tileX: 48, tileY: 6 },
        { defId: 'fiber_station', tileX: 22, tileY: 5 },
      ],
      p1Spawn,
      aiSpawn,
    };
  }

  if (mapId === 'strait_chokepoint') {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const diag = x * 0.72 + y;
        if (diag > 46 && diag < 56) tiles[y * w + x] = 'water';
      }
    }
    ensureBasePads();
    paintRect(tiles, w, h, 18, 30, 32, 34, 'concrete');
    paintRect(tiles, w, h, 40, 18, 53, 22, 'concrete');
    paintRect(tiles, w, h, 26, 12, 29, 17, 'ridge');
    paintRect(tiles, w, h, 42, 36, 45, 41, 'ridge');

    return {
      map: { id: mapId, name: meta.name, biome: meta.biome, width: w, height: h, tileSize: TILE_SIZE, tiles },
      siliconNodes: [
        { tileX: 6, tileY: 31, amount: 9500 },
        { tileX: 62, tileY: 20, amount: 9500 },
        { tileX: 19, tileY: 14, amount: 11000 },
        { tileX: 50, tileY: 38, amount: 11000 },
      ],
      neutralBuildings: [
        { defId: 'lng_terminal', tileX: 24, tileY: 43 },
        { defId: 'lng_terminal', tileX: 45, tileY: 8 },
        { defId: 'analog_radar', tileX: 34, tileY: 25 },
      ],
      p1Spawn,
      aiSpawn,
    };
  }

  if (mapId === 'arctic_cryo') {
    paintRect(tiles, w, h, 0, 23, 71, 29, 'water');
    paintRect(tiles, w, h, 12, 23, 17, 29, 'concrete');
    paintRect(tiles, w, h, 33, 23, 38, 29, 'concrete');
    paintRect(tiles, w, h, 54, 23, 59, 29, 'concrete');
    ensureBasePads();
    paintRect(tiles, w, h, 24, 12, 28, 17, 'ridge');
    paintRect(tiles, w, h, 43, 35, 47, 40, 'ridge');

    return {
      map: { id: mapId, name: meta.name, biome: meta.biome, width: w, height: h, tileSize: TILE_SIZE, tiles },
      siliconNodes: [
        { tileX: 20, tileY: 36, amount: 9500 },
        { tileX: 49, tileY: 15, amount: 9500 },
        { tileX: 33, tileY: 9, amount: 11500 },
        { tileX: 36, tileY: 43, amount: 11500 },
      ],
      neutralBuildings: [
        { defId: 'fiber_station', tileX: 7, tileY: 19 },
        { defId: 'fiber_station', tileX: 62, tileY: 32 },
        { defId: 'analog_radar', tileX: 35, tileY: 18 },
      ],
      p1Spawn,
      aiSpawn,
    };
  }

  if (mapId === 'megacity_grid') {
    paintRect(tiles, w, h, 0, 0, 71, 53, 'concrete');
    paintRect(tiles, w, h, 0, 0, 8, 8, 'water');
    paintRect(tiles, w, h, 63, 45, 71, 53, 'water');
    ensureBasePads();
    const blocks = [
      [24, 14, 29, 18],
      [42, 14, 47, 18],
      [24, 34, 29, 38],
      [42, 34, 47, 38],
      [33, 24, 38, 28],
    ];
    for (const [x1, y1, x2, y2] of blocks) {
      paintRect(tiles, w, h, x1, y1, x2, y2 - 1, 'ridge');
      paintRect(tiles, w, h, x1, y2, x2, y2, 'cliff');
    }

    return {
      map: { id: mapId, name: meta.name, biome: meta.biome, width: w, height: h, tileSize: TILE_SIZE, tiles },
      siliconNodes: [
        { tileX: 7, tileY: 32, amount: 9500 },
        { tileX: 62, tileY: 20, amount: 9500 },
        { tileX: 34, tileY: 9, amount: 11500 },
        { tileX: 36, tileY: 43, amount: 11500 },
      ],
      neutralBuildings: [
        { defId: 'analog_radar', tileX: 25, tileY: 25 },
        { defId: 'analog_radar', tileX: 45, tileY: 25 },
        { defId: 'lng_terminal', tileX: 34, tileY: 3 },
      ],
      p1Spawn,
      aiSpawn,
    };
  }

  // 'fab_corridor'
  paintRect(tiles, w, h, 0, 0, 7, 7, 'water');
  paintRect(tiles, w, h, 64, 46, 71, 53, 'water');
  ensureBasePads();
  paintRect(tiles, w, h, 28, 24, 43, 28, 'concrete');
  paintRect(tiles, w, h, 25, 15, 28, 19, 'ridge');
  paintRect(tiles, w, h, 43, 33, 46, 37, 'ridge');

  return {
    map: { id: 'fab_corridor', name: meta.name, biome: meta.biome, width: w, height: h, tileSize: TILE_SIZE, tiles },
    siliconNodes: [
      { tileX: 7, tileY: 32, amount: 9500 },
      { tileX: 62, tileY: 20, amount: 9500 },
      { tileX: 32, tileY: 11, amount: 12000 },
      { tileX: 38, tileY: 40, amount: 12000 },
      { tileX: 21, tileY: 24, amount: 11000 },
      { tileX: 49, tileY: 27, amount: 11000 },
    ],
    neutralBuildings: [
      { defId: 'lng_terminal', tileX: 23, tileY: 44 },
      { defId: 'lng_terminal', tileX: 46, tileY: 7 },
      { defId: 'fiber_station', tileX: 35, tileY: 3 },
    ],
    p1Spawn,
    aiSpawn,
  };
}

export function isTilePassable(map: MapData, tx: number, ty: number): boolean {
  if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) return false;
  const kind = map.tiles[ty * map.width + tx];
  return kind === 'sand' || kind === 'concrete';
}

export function isWaterTile(map: MapData, tx: number, ty: number): boolean {
  if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) return false;
  return map.tiles[ty * map.width + tx] === 'water';
}
