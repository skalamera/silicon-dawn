import type { PlayableFactionId } from './defs';
import { spawnBuilding, spawnUnit } from '../sim/helpers';
import type { DifficultyId, GameState, MapId } from '../sim/types';

export interface MissionDef {
  id: string;
  codeName: string;
  title: string;
  faction: PlayableFactionId;
  enemyFaction: PlayableFactionId;
  mapId: MapId;
  difficulty: DifficultyId;
  isTutorial?: boolean;
  briefing: string;
  objectives: string[];
  startingSilicon: number;
  setup: (state: GameState) => void;
}

function getBaseAnchor(state: GameState, ownerId: string): { tx: number; ty: number; x: number; y: number } {
  for (const id of state.entityOrder) {
    const e = state.entities[id];
    if (e && e.kind === 'building' && e.ownerId === ownerId && e.defId === 'conyard') {
      return {
        tx: e.tileX ?? Math.floor(e.x / state.map.tileSize),
        ty: e.tileY ?? Math.floor(e.y / state.map.tileSize),
        x: e.x,
        y: e.y,
      };
    }
  }
  return { tx: 8, ty: 44, x: 400, y: 2100 };
}

export const MISSIONS: MissionDef[] = [
  {
    id: 'boot_sequence',
    codeName: 'OP-00',
    title: 'Boot Sequence (Tutorial)',
    faction: 'alliance',
    enemyFaction: 'pact',
    mapId: 'peninsula_grid',
    difficulty: 'recruit',
    isTutorial: true,
    briefing:
      'Welcome to AUTOWARCOM. Establish compute & power capacity, inspect the Electromagnetic Spectrum overlay, and neutralize the Pact outpost across the ridge.',
    objectives: [
      'Construct a Tactical Foundry or Compute Server Farm',
      'Inspect the EM Spectrum overlay (Tab or EM button)',
      'Capture a neutral node or train a combat unit',
      'Neutralize all Eurasian Pact command structures',
    ],
    startingSilicon: 2200,
    setup: (state) => {
      state.players.p1.silicon = 2200;
    },
  },
  {
    id: 'alliance_01',
    codeName: 'WA-01',
    title: 'Iron Curtain 2.0',
    faction: 'alliance',
    enemyFaction: 'pact',
    mapId: 'peninsula_grid',
    difficulty: 'commander',
    briefing:
      'Eurasian Pact armored columns are probing the central peninsula behind Krasukha-Q jamming domes. Hold the line with Iron Beam turrets and M1E4 Trophy APS armor.',
    objectives: [
      'Defend forward Iron Beam turret & keep MW grid above 100%',
      'Destroy all Eurasian Pact bases and MCVs',
    ],
    startingSilicon: 2100,
    setup: (state) => {
      const p1 = getBaseAnchor(state, 'p1');
      const ai = getBaseAnchor(state, 'ai1');
      spawnBuilding(state, 'p1', 'barracks', p1.tx + 3, p1.ty + 2);
      spawnBuilding(state, 'p1', 'iron_beam', p1.tx + 6, p1.ty - 2);
      spawnUnit(state, 'p1', 'm1e4', p1.x + 140, p1.y - 110);
      spawnUnit(state, 'p1', 'quantum_loiter', p1.x + 100, p1.y - 80);
      spawnUnit(state, 'ai1', 'krasukha_q', ai.x - 140, ai.y + 110);
      spawnUnit(state, 'ai1', 'type_99x', ai.x - 180, ai.y + 140);
    },
  },
  {
    id: 'alliance_02',
    codeName: 'WA-02',
    title: 'Zero-Day Dawn',
    faction: 'alliance',
    enemyFaction: 'pact',
    mapId: 'arctic_cryo',
    difficulty: 'commander',
    briefing:
      'Pact Dark Factories in the Arctic Cryo-Basin rely on heavy compute clusters. Infiltrate their Server Farms with Unit 8200 spies, reach Q-Day, and take over their armor with Project Prometheus.',
    objectives: [
      'Plant a Zero-Day Implant on an enemy Server Farm',
      'Reach Q-Day (100%) or crush the Pact Arctic hub',
    ],
    startingSilicon: 2400,
    setup: (state) => {
      const p1 = getBaseAnchor(state, 'p1');
      spawnBuilding(state, 'p1', 'barracks', p1.tx + 3, p1.ty + 2);
      spawnBuilding(state, 'p1', 'war_factory', p1.tx + 3, p1.ty - 3);
      spawnBuilding(state, 'p1', 'cryo_core', p1.tx - 3, p1.ty + 3);
      spawnUnit(state, 'p1', 'unit_8200', p1.x + 120, p1.y - 90);
      spawnUnit(state, 'p1', 'loyal_wingman', p1.x + 160, p1.y - 120);
    },
  },
  {
    id: 'pact_01',
    codeName: 'EP-01',
    title: 'Dark Assembly',
    faction: 'pact',
    enemyFaction: 'alliance',
    mapId: 'fab_corridor',
    difficulty: 'commander',
    briefing:
      'Mass-produce unmanned Type-99X armor 50% faster from Dark Factories. Pair EW Fiber-Tether Sappers with your tanks to render Western cyber hacks useless.',
    objectives: [
      'Keep autonomous tanks tethered inside EW Sapper spools',
      'Overwhelm the Western Alliance corridor base',
    ],
    startingSilicon: 2200,
    setup: (state) => {
      const p1 = getBaseAnchor(state, 'p1');
      spawnBuilding(state, 'p1', 'barracks', p1.tx + 3, p1.ty + 2);
      spawnBuilding(state, 'p1', 'war_factory', p1.tx + 3, p1.ty - 3);
      spawnUnit(state, 'p1', 'ew_sapper', p1.x + 130, p1.y - 80);
      spawnUnit(state, 'p1', 'type_99x', p1.x + 170, p1.y - 80);
      spawnUnit(state, 'p1', 'type_99x', p1.x + 200, p1.y - 50);
    },
  },
  {
    id: 'pact_02',
    codeName: 'EP-02',
    title: 'Kessler Midnight',
    faction: 'pact',
    enemyFaction: 'alliance',
    mapId: 'megacity_grid',
    difficulty: 'commander',
    briefing:
      'Alliance sensors dominate the Megacity avenues. Capture a Legacy Analog Radar Bunker so your own forces stay blind-proof, then detonate the Kessler Cascade orbital EMP!',
    objectives: [
      'Capture a Legacy Analog Radar Bunker',
      'Detonate Kessler Cascade & eliminate Alliance forces',
    ],
    startingSilicon: 2400,
    setup: (state) => {
      const p1 = getBaseAnchor(state, 'p1');
      spawnBuilding(state, 'p1', 'barracks', p1.tx + 3, p1.ty + 2);
      spawnBuilding(state, 'p1', 'war_factory', p1.tx + 3, p1.ty - 3);
      spawnBuilding(state, 'p1', 'cryo_core', p1.tx - 3, p1.ty + 3);
      spawnBuilding(state, 'p1', 'kessler_silo', p1.tx - 4, p1.ty - 3);
      state.players.p1.superweaponCharge = 65;
      spawnUnit(state, 'p1', 'shock_trooper', p1.x + 120, p1.y - 100);
      spawnUnit(state, 'p1', 'tos_3', p1.x + 165, p1.y - 75);
    },
  },
  {
    id: 'axis_01',
    codeName: 'AX-01',
    title: 'Ghost Tunnel',
    faction: 'axis',
    enemyFaction: 'alliance',
    mapId: 'megacity_grid',
    difficulty: 'commander',
    briefing:
      'Western Iron Beams shred frontal assaults. Bait their targeting with Decoy Batteries, burrow Tunnel-Borers beneath city blocks, and saturate lasers with Shahed-X swarms.',
    objectives: [
      'Use Tunnel-Borers & Shahed-X swarms to bypass defenses',
      'Destroy the Western Alliance Megacity command',
    ],
    startingSilicon: 2200,
    setup: (state) => {
      const p1 = getBaseAnchor(state, 'p1');
      spawnBuilding(state, 'p1', 'barracks', p1.tx + 3, p1.ty + 2);
      spawnBuilding(state, 'p1', 'decoy_battery', p1.tx + 7, p1.ty - 2);
      spawnUnit(state, 'p1', 'tunnel_crawler', p1.x + 120, p1.y - 90);
      spawnUnit(state, 'p1', 'shahed_launcher', p1.x + 160, p1.y - 60);
      spawnUnit(state, 'p1', 'ied_crawler', p1.x + 100, p1.y - 45);
    },
  },
  {
    id: 'axis_02',
    codeName: 'AX-02',
    title: 'Strait Closure',
    faction: 'axis',
    enemyFaction: 'pact',
    mapId: 'strait_chokepoint',
    difficulty: 'commander',
    briefing:
      'Lock down the central sea strait! Deploy Swarming FAC speedboats from your Naval Yard, conceal Pop-Up Silos along the coast, and trigger Strait Chokepoint supply collapse.',
    objectives: [
      'Control the Strait Chokepoint littoral lanes with FAC Boats',
      'Break the Eurasian Pact coastal foothold',
    ],
    startingSilicon: 2400,
    setup: (state) => {
      const p1 = getBaseAnchor(state, 'p1');
      spawnBuilding(state, 'p1', 'smr', p1.tx - 3, p1.ty - 3);
      spawnBuilding(state, 'p1', 'popup_silo', p1.tx + 7, p1.ty - 3);
      spawnBuilding(state, 'p1', 'cryo_core', p1.tx - 3, p1.ty + 3);
      spawnUnit(state, 'p1', 'shahed_launcher', p1.x + 150, p1.y - 90);
      spawnUnit(state, 'p1', 'teleop_militia', p1.x + 110, p1.y - 65);
    },
  },
];

export function getMissionById(id: string | null | undefined): MissionDef | undefined {
  if (!id) return undefined;
  return MISSIONS.find((m) => m.id === id);
}
