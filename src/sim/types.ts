import type {
  BuildingId,
  CyberPowerId,
  FactionId,
  PlayableFactionId,
  UnitId,
  WeaponType,
} from '../data/defs';

export type TileKind = 'sand' | 'concrete' | 'ridge' | 'water' | 'cliff';

export type MapId =
  | 'peninsula_grid'
  | 'strait_chokepoint'
  | 'arctic_cryo'
  | 'megacity_grid'
  | 'fab_corridor';

export type MapBiome = 'arid' | 'arctic' | 'urban';

export type DifficultyId = 'recruit' | 'commander';

export type OverlayMode = 'tactical' | 'em' | 'power';

export interface MatchConfig {
  seed: number;
  playerFaction: PlayableFactionId;
  aiFaction: PlayableFactionId;
  aiDifficulty: DifficultyId;
  mapId?: MapId;
  missionId?: string;
  isDemo?: boolean;
}

export interface RngState {
  s0: number;
  s1: number;
  s2: number;
  s3: number;
}

export interface BuildQueueItem {
  kind: 'building' | 'unit';
  defId: BuildingId | UnitId;
  progress: number;
  totalTime: number;
  cost: number;
}

export interface PlayerState {
  id: string;
  name: string;
  faction: FactionId;
  isAi: boolean;
  aiDifficulty: DifficultyId;
  silicon: number;
  powerProduced: number;
  powerConsumed: number;
  powerRatio: number;
  flopsCap: number;
  flopsUsed: number;
  latencyFactor: number;
  overclock: boolean;
  thermalLoad: number;
  coolingCapacity: number;
  buildingQueue: BuildQueueItem | null;
  readyBuildingDefId: BuildingId | null;
  unitQueue: BuildQueueItem[];
  rallyPoint: { x: number; y: number } | null;
  aiTimer: number;
  aiWaveTimer: number;
  defeated: boolean;
  // Phase 2 & 3 Cryptography, Cyber & Superweapons
  qDayProgress: number; // 0..100
  qDayActive: boolean;
  cyberCooldowns: Record<CyberPowerId, number>;
  ransomwareTimer: number;
  superweaponCharge: number; // 0..100
  chokepointTimer: number;
  implantedFlopsBonus: number;
}

export interface UnitOrder {
  type: 'idle' | 'move' | 'attackMove' | 'attackTarget' | 'harvest' | 'capture' | 'implant';
  targetX: number;
  targetY: number;
  targetEntityId?: string;
}

export interface Entity {
  id: string;
  kind: 'unit' | 'building';
  defId: BuildingId | UnitId;
  ownerId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  turretAngle: number;
  hp: number;
  maxHp: number;
  kills: number;
  veterancy: 0 | 1 | 2;
  cooldown: number;
  apsCooldown: number;
  smokeCooldown: number;
  slowTimer: number;
  safeMode: boolean;
  humanOverride: boolean;
  jammed: boolean;
  tethered: boolean;
  poisonTimer: number;
  empStunTimer: number;
  burrowed: boolean;
  siloOpenTimer: number;
  implantedBy?: string;
  swarmId?: string;
  swarmSplitBias?: number;
  swarmSplitActive?: boolean;
  launchCooldown: number;
  conversionProgress: number;
  convertingBy?: string;
  isRevealed: boolean;
  waterCooled: boolean;
  repairing: boolean;
  tileX?: number;
  tileY?: number;
  siliconRemaining?: number;
  linkedNodeId?: string;
  linkedHubId?: string;
  captureProgress?: number;
  capturingOwnerId?: string;
  order: UnitOrder;
  path: Array<{ x: number; y: number }>;
  pathAge: number;
}

export interface Projectile {
  id: string;
  ownerId: string;
  sourceId: string;
  x: number;
  y: number;
  tx: number;
  ty: number;
  targetId?: string;
  speed: number;
  damage: number;
  weaponType: WeaponType;
  isRocket: boolean;
  fromJammed: boolean;
  aoeRadius?: number;
  life: number;
}

export interface BeamEffect {
  id: string;
  ownerId: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  scatteredBySmoke: boolean;
  kind: 'laser_hel' | 'hpm_cone' | 'weld' | 'aps_intercept';
  life: number;
  maxLife: number;
}

export interface SmokeCloud {
  id: string;
  ownerId: string;
  x: number;
  y: number;
  radius: number;
  life: number;
  maxLife: number;
}

export interface ExplosionEffect {
  id: string;
  x: number;
  y: number;
  radius: number;
  color: string;
  life: number;
  maxLife: number;
}

export interface JamDome {
  ownerId: string;
  sourceId: string;
  x: number;
  y: number;
  radius: number;
}

export interface TetherAnchor {
  ownerId: string;
  sourceId: string;
  x: number;
  y: number;
  radius: number;
}

export interface PoisonZone {
  id: string;
  ownerId: string;
  x: number;
  y: number;
  radius: number;
  life: number;
  maxLife: number;
}

export interface SpoofBlip {
  id: string;
  ownerId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

export interface PrometheusBeam {
  id: string;
  ownerId: string;
  x: number;
  y: number;
  radius: number;
  life: number;
  maxLife: number;
}

export interface MapData {
  id: MapId;
  name: string;
  biome: MapBiome;
  width: number;
  height: number;
  tileSize: number;
  tiles: TileKind[];
}

export interface GameState {
  schemaVersion: 2;
  tick: number;
  tickRate: 20;
  elapsedSeconds: number;
  config: MatchConfig;
  rng: RngState;
  nextEntitySeq: number;
  map: MapData;
  players: Record<string, PlayerState>;
  entities: Record<string, Entity>;
  entityOrder: string[];
  projectiles: Projectile[];
  beams: BeamEffect[];
  smokeClouds: SmokeCloud[];
  explosions: ExplosionEffect[];
  scorchMarks: Array<{ x: number; y: number; r: number }>;
  jamDomes: JamDome[];
  tetherAnchors: TetherAnchor[];
  poisonZones: PoisonZone[];
  spoofBlips: SpoofBlip[];
  prometheusBeams: PrometheusBeam[];
  kesslerTimer: number;
  kesslerOwnerId: string | null;
  missionId: string | null;
  missionStep: number;
  fog: Record<string, number[]>;
  winnerId: string | null;
  alerts: Array<{ id: string; text: string; tone: 'info' | 'warn' | 'danger'; ttl: number }>;
}

export type SimCommand =
  | { type: 'startBuildBuilding'; playerId: string; defId: BuildingId }
  | { type: 'cancelBuildBuilding'; playerId: string }
  | { type: 'placeBuilding'; playerId: string; defId: BuildingId; tileX: number; tileY: number }
  | { type: 'queueUnit'; playerId: string; defId: UnitId }
  | { type: 'cancelUnit'; playerId: string; index: number }
  | { type: 'moveUnits'; playerId: string; unitIds: string[]; x: number; y: number; attackMove?: boolean }
  | { type: 'stopUnits'; playerId: string; unitIds: string[] }
  | { type: 'attackEntity'; playerId: string; unitIds: string[]; targetId: string }
  | { type: 'harvestNode'; playerId: string; unitIds: string[]; nodeId: string }
  | { type: 'captureBuilding'; playerId: string; unitIds: string[]; targetId: string }
  | { type: 'plantImplant'; playerId: string; unitIds: string[]; targetId: string }
  | { type: 'deployMcv'; playerId: string; unitId: string }
  | { type: 'deploySmoke'; playerId: string; unitIds: string[] }
  | { type: 'deployTether'; playerId: string; unitIds: string[] }
  | { type: 'toggleBurrow'; playerId: string; unitIds: string[] }
  | { type: 'launchSwarm'; playerId: string; unitIds: string[]; x?: number; y?: number }
  | { type: 'toggleOverclock'; playerId: string }
  | { type: 'useCyberPower'; playerId: string; powerId: CyberPowerId; x: number; y: number }
  | { type: 'payRansom'; playerId: string }
  | { type: 'fireSuperweapon'; playerId: string; x: number; y: number }
  | { type: 'setRallyPoint'; playerId: string; x: number; y: number }
  | { type: 'sellBuilding'; playerId: string; buildingId: string };
