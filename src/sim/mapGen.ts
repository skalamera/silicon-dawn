import type { BuildingId } from '../data/defs';
import type { MapBiome, MapData, MapId, TileKind } from './types';

export const MAP_WIDTH = 112;
export const MAP_HEIGHT = 84;
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
    description: 'Massive 112×84 coastal peninsula with split ridges, flanking corridors, LNG Terminals & Subsea Fiber.',
  },
  {
    id: 'strait_chokepoint',
    name: 'Strait Chokepoint',
    biome: 'arid',
    description: 'Vast 112×84 central sea strait spanned by 3 concrete causeways; built for fortified defense and naval warfare.',
  },
  {
    id: 'arctic_cryo',
    name: 'Arctic Cryo-Basin',
    biome: 'arctic',
    description: 'Glacial 112×84 cooling rivers (+25% cooling), 4 bridges, Subsea Fiber Stations & Legacy Analog Radar.',
  },
  {
    id: 'megacity_grid',
    name: 'Megacity Grid',
    biome: 'urban',
    description: 'Sprawling 112×84 urban avenue blocks favoring Valkyries, Tunnel-Borers, Chokepoint Turrets & Seismic Sensors.',
  },
  {
    id: 'fab_corridor',
    name: 'Wafer Fab Corridor',
    biome: 'arid',
    description: 'Expansive 112×84 central Silicon valley with 8 high-yield clusters for prolonged armored campaigns.',
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

  const p1Spawn = { tileX: 10, tileY: 72 };
  const aiSpawn = { tileX: 98, tileY: 10 };

  const ensureBasePads = () => {
    paintRect(tiles, w, h, 3, 63, 25, 80, 'concrete');
    paintRect(tiles, w, h, 86, 3, 108, 20, 'concrete');
  };

  if (mapId === 'peninsula_grid') {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (x + y < 22) tiles[y * w + x] = 'water';
        if (w - 1 - x + (h - 1 - y) < 22) tiles[y * w + x] = 'water';
        if (y <= 4 && x < 64) tiles[y * w + x] = 'water';
        if (y >= h - 5 && x >= 48) tiles[y * w + x] = 'water';
      }
    }
    ensureBasePads();
    // Wide multi-lane central ridge plateaus & flanking terrain choke ridges
    paintRect(tiles, w, h, 50, 16, 58, 33, 'ridge');
    paintRect(tiles, w, h, 50, 34, 58, 34, 'cliff');
    paintRect(tiles, w, h, 52, 48, 60, 65, 'ridge');
    paintRect(tiles, w, h, 52, 66, 60, 66, 'cliff');
    paintRect(tiles, w, h, 42, 39, 68, 43, 'concrete');

    paintRect(tiles, w, h, 30, 26, 33, 37, 'ridge');
    paintRect(tiles, w, h, 30, 38, 33, 38, 'cliff');
    paintRect(tiles, w, h, 78, 44, 81, 55, 'ridge');
    paintRect(tiles, w, h, 78, 56, 81, 56, 'cliff');

    return {
      map: { id: mapId, name: meta.name, biome: meta.biome, width: w, height: h, tileSize: TILE_SIZE, tiles },
      siliconNodes: [
        { tileX: 8, tileY: 57, amount: 11000 },
        { tileX: 21, tileY: 74, amount: 10500 },
        { tileX: 99, tileY: 25, amount: 11000 },
        { tileX: 87, tileY: 7, amount: 10500 },
        { tileX: 38, tileY: 16, amount: 13000 },
        { tileX: 70, tileY: 64, amount: 13000 },
        { tileX: 46, tileY: 44, amount: 15000 },
        { tileX: 64, tileY: 36, amount: 15000 },
      ],
      neutralBuildings: [
        { defId: 'lng_terminal', tileX: 28, tileY: 72 },
        { defId: 'lng_terminal', tileX: 80, tileY: 9 },
        { defId: 'fiber_station', tileX: 32, tileY: 9 },
        { defId: 'fiber_station', tileX: 76, tileY: 72 },
        { defId: 'analog_radar', tileX: 54, tileY: 40 },
      ],
      p1Spawn,
      aiSpawn,
    };
  }

  if (mapId === 'strait_chokepoint') {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const diag = x * 0.72 + y;
        if (diag > 73 && diag < 87) tiles[y * w + x] = 'water';
      }
    }
    ensureBasePads();
    paintRect(tiles, w, h, 22, 52, 40, 56, 'concrete');
    paintRect(tiles, w, h, 48, 38, 63, 42, 'concrete');
    paintRect(tiles, w, h, 72, 23, 89, 27, 'concrete');
    paintRect(tiles, w, h, 40, 16, 45, 25, 'ridge');
    paintRect(tiles, w, h, 66, 58, 71, 67, 'ridge');

    return {
      map: { id: mapId, name: meta.name, biome: meta.biome, width: w, height: h, tileSize: TILE_SIZE, tiles },
      siliconNodes: [
        { tileX: 9, tileY: 56, amount: 11000 },
        { tileX: 22, tileY: 74, amount: 10500 },
        { tileX: 98, tileY: 26, amount: 11000 },
        { tileX: 86, tileY: 8, amount: 10500 },
        { tileX: 28, tileY: 20, amount: 13500 },
        { tileX: 80, tileY: 60, amount: 13500 },
        { tileX: 53, tileY: 40, amount: 14500 },
      ],
      neutralBuildings: [
        { defId: 'lng_terminal', tileX: 30, tileY: 70 },
        { defId: 'lng_terminal', tileX: 78, tileY: 11 },
        { defId: 'analog_radar', tileX: 54, tileY: 39 },
        { defId: 'fiber_station', tileX: 31, tileY: 53 },
        { defId: 'fiber_station', tileX: 79, tileY: 24 },
      ],
      p1Spawn,
      aiSpawn,
    };
  }

  if (mapId === 'arctic_cryo') {
    paintRect(tiles, w, h, 0, 36, 111, 45, 'water');
    paintRect(tiles, w, h, 14, 36, 20, 45, 'concrete');
    paintRect(tiles, w, h, 38, 36, 44, 45, 'concrete');
    paintRect(tiles, w, h, 64, 36, 70, 45, 'concrete');
    paintRect(tiles, w, h, 88, 36, 94, 45, 'concrete');
    ensureBasePads();
    paintRect(tiles, w, h, 36, 16, 42, 24, 'ridge');
    paintRect(tiles, w, h, 68, 56, 74, 64, 'ridge');

    return {
      map: { id: mapId, name: meta.name, biome: meta.biome, width: w, height: h, tileSize: TILE_SIZE, tiles },
      siliconNodes: [
        { tileX: 10, tileY: 56, amount: 11000 },
        { tileX: 24, tileY: 74, amount: 10500 },
        { tileX: 98, tileY: 26, amount: 11000 },
        { tileX: 84, tileY: 8, amount: 10500 },
        { tileX: 50, tileY: 14, amount: 13500 },
        { tileX: 56, tileY: 66, amount: 13500 },
        { tileX: 28, tileY: 50, amount: 12000 },
        { tileX: 80, tileY: 30, amount: 12000 },
      ],
      neutralBuildings: [
        { defId: 'fiber_station', tileX: 14, tileY: 31 },
        { defId: 'fiber_station', tileX: 92, tileY: 48 },
        { defId: 'analog_radar', tileX: 54, tileY: 29 },
        { defId: 'analog_radar', tileX: 54, tileY: 50 },
        { defId: 'lng_terminal', tileX: 30, tileY: 70 },
        { defId: 'lng_terminal', tileX: 78, tileY: 11 },
      ],
      p1Spawn,
      aiSpawn,
    };
  }

  if (mapId === 'megacity_grid') {
    paintRect(tiles, w, h, 0, 0, 111, 83, 'concrete');
    paintRect(tiles, w, h, 0, 0, 12, 12, 'water');
    paintRect(tiles, w, h, 99, 71, 111, 83, 'water');
    ensureBasePads();
    const blocks = [
      [34, 20, 42, 26],
      [68, 20, 76, 26],
      [34, 54, 42, 60],
      [68, 54, 76, 60],
      [50, 36, 60, 44],
      [20, 36, 26, 44],
      [84, 36, 90, 44],
    ];
    for (const [x1, y1, x2, y2] of blocks) {
      paintRect(tiles, w, h, x1, y1, x2, y2 - 1, 'ridge');
      paintRect(tiles, w, h, x1, y2, x2, y2, 'cliff');
    }

    return {
      map: { id: mapId, name: meta.name, biome: meta.biome, width: w, height: h, tileSize: TILE_SIZE, tiles },
      siliconNodes: [
        { tileX: 10, tileY: 56, amount: 11000 },
        { tileX: 23, tileY: 74, amount: 10500 },
        { tileX: 98, tileY: 26, amount: 11000 },
        { tileX: 85, tileY: 8, amount: 10500 },
        { tileX: 53, tileY: 14, amount: 13500 },
        { tileX: 55, tileY: 66, amount: 13500 },
        { tileX: 44, tileY: 39, amount: 14500 },
        { tileX: 65, tileY: 39, amount: 14500 },
      ],
      neutralBuildings: [
        { defId: 'analog_radar', tileX: 36, tileY: 39 },
        { defId: 'analog_radar', tileX: 72, tileY: 39 },
        { defId: 'lng_terminal', tileX: 53, tileY: 5 },
        { defId: 'lng_terminal', tileX: 55, tileY: 75 },
        { defId: 'fiber_station', tileX: 30, tileY: 7 },
      ],
      p1Spawn,
      aiSpawn,
    };
  }

  // 'fab_corridor'
  paintRect(tiles, w, h, 0, 0, 11, 11, 'water');
  paintRect(tiles, w, h, 100, 72, 111, 83, 'water');
  ensureBasePads();
  paintRect(tiles, w, h, 42, 37, 68, 43, 'concrete');
  paintRect(tiles, w, h, 36, 22, 41, 28, 'ridge');
  paintRect(tiles, w, h, 68, 52, 73, 58, 'ridge');

  return {
    map: { id: 'fab_corridor', name: meta.name, biome: meta.biome, width: w, height: h, tileSize: TILE_SIZE, tiles },
    siliconNodes: [
      { tileX: 9, tileY: 56, amount: 11000 },
      { tileX: 23, tileY: 74, amount: 10500 },
      { tileX: 98, tileY: 26, amount: 11000 },
      { tileX: 85, tileY: 8, amount: 10500 },
      { tileX: 48, tileY: 16, amount: 14000 },
      { tileX: 60, tileY: 64, amount: 14000 },
      { tileX: 32, tileY: 38, amount: 13000 },
      { tileX: 76, tileY: 42, amount: 13000 },
    ],
    neutralBuildings: [
      { defId: 'lng_terminal', tileX: 30, tileY: 70 },
      { defId: 'lng_terminal', tileX: 78, tileY: 11 },
      { defId: 'fiber_station', tileX: 54, tileY: 5 },
      { defId: 'fiber_station', tileX: 54, tileY: 75 },
      { defId: 'analog_radar', tileX: 54, tileY: 39 },
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
