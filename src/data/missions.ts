import type { PlayableFactionId } from './defs';
import { spawnBuilding, spawnUnit } from '../sim/helpers';
import type { DifficultyId, GameState, MapId, OverlayMode } from '../sim/types';

export interface MissionObjectiveDef {
  label: string;
  check: (state: GameState, ctx: { emVisited: boolean; overlayMode: OverlayMode }) => boolean;
}

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
  intelNote: string;
  graceWindowLabel: string;
  objectives: string[];
  objectiveDefs: MissionObjectiveDef[];
  bonusObjective: MissionObjectiveDef;
  startingSilicon: number;
  setup: (state: GameState) => void;
}

function getBaseAnchor(
  state: GameState,
  ownerId: string
): { tx: number; ty: number; x: number; y: number } {
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
  return { tx: 10, ty: 72, x: 480, y: 3456 };
}

function getPlayerEntities(state: GameState, ownerId: string) {
  const list = [];
  for (const id of state.entityOrder) {
    const e = state.entities[id];
    if (e && e.ownerId === ownerId) list.push(e);
  }
  return list;
}

const rawMissions: Array<Omit<MissionDef, 'objectives'>> = [
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
      'Welcome to AUTOWARCOM. Establish compute & power capacity, fortify your perimeter ridges, inspect the Electromagnetic Spectrum overlay, and neutralize the Pact outpost across the peninsula.',
    intelNote:
      'Enemy invasion waves hold for 6 full minutes while you learn base building and turret placement.',
    graceWindowLabel: '~6 min safe build-up',
    objectiveDefs: [
      {
        label: 'Construct a Tactical Foundry or Compute Server Farm',
        check: (s) =>
          getPlayerEntities(s, 'p1').some(
            (e) => e.defId === 'barracks' || e.defId === 'war_factory' || e.defId === 'server_farm'
          ),
      },
      {
        label: 'Inspect the EM Spectrum overlay (Tab or EM button)',
        check: (_s, ctx) => ctx.emVisited || ctx.overlayMode === 'em',
      },
      {
        label: 'Deploy an Iron Beam turret or capture a neutral node',
        check: (s) =>
          getPlayerEntities(s, 'p1').some(
            (e) => e.defId === 'iron_beam' || e.defId === 'lng_terminal' || e.defId === 'fiber_station'
          ),
      },
      {
        label: 'Neutralize all Eurasian Pact command structures',
        check: (s) => s.winnerId === 'p1',
      },
    ],
    bonusObjective: {
      label: 'Bonus: Field at least 6 combat units before pushing the bridge (+600 Si)',
      check: (s) =>
        getPlayerEntities(s, 'p1').filter(
          (e) => e.kind === 'unit' && e.defId !== 'relay_crawler' && e.defId !== 'mcv'
        ).length >= 6,
    },
    startingSilicon: 2800,
    setup: (state) => {
      const ts = state.map.tileSize;
      // Distant mid-map Pact recon outpost across the central bridge (far from Player 1)
      spawnBuilding(state, 'ai1', 'analog_radar', 65, 39);
      spawnUnit(state, 'ai1', 'shock_trooper', 64 * ts, 41 * ts);
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
      'Eurasian Pact armored columns are fortifying the central peninsula behind Krasukha-Q jamming domes. Expand your base defenses across the 112×84 peninsula and push through with Iron Beam turrets and M1E4 Trophy APS armor.',
    intelNote:
      'Pact Krasukha-Q probes begin mobilizing after ~4.5 minutes. Fortify the ridge approaches first.',
    graceWindowLabel: '~4.5 min build-up window',
    objectiveDefs: [
      {
        label: 'Maintain 2+ Iron Beam turrets & 100%+ Reactor Power Grid',
        check: (s) =>
          getPlayerEntities(s, 'p1').filter((e) => e.defId === 'iron_beam').length >= 2 &&
          s.players.p1.powerRatio >= 1.0,
      },
      {
        label: 'Construct a Heavy Robotics Factory for M1E4 reinforcements',
        check: (s) => getPlayerEntities(s, 'p1').some((e) => e.defId === 'war_factory'),
      },
      {
        label: 'Destroy all Eurasian Pact bases and MCVs',
        check: (s) => s.winnerId === 'p1',
      },
    ],
    bonusObjective: {
      label: 'Bonus: Capture the central Analog Radar or Subsea Fiber Station (+600 Si)',
      check: (s) =>
        getPlayerEntities(s, 'p1').some(
          (e) => e.defId === 'analog_radar' || e.defId === 'fiber_station'
        ),
    },
    startingSilicon: 2600,
    setup: (state) => {
      const p1 = getBaseAnchor(state, 'p1');
      const ai = getBaseAnchor(state, 'ai1');
      const ts = state.map.tileSize;
      spawnBuilding(state, 'p1', 'barracks', p1.tx + 3, p1.ty + 2);
      spawnBuilding(state, 'p1', 'iron_beam', p1.tx + 7, p1.ty - 3);
      spawnUnit(state, 'p1', 'm1e4', p1.x + 150, p1.y - 110);
      spawnUnit(state, 'p1', 'quantum_loiter', p1.x + 110, p1.y - 80);
      // Forward Pact ridge outpost (distant NE crossing)
      spawnBuilding(state, 'ai1', 'hpm_tower', 64, 40);
      spawnUnit(state, 'ai1', 'krasukha_q', ai.x - 160, ai.y + 110);
      spawnUnit(state, 'ai1', 'type_99x', ai.x - 200, ai.y + 140);
      spawnUnit(state, 'ai1', 'wolf_pack', 63 * ts, 41 * ts);
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
      'Pact Dark Factories in the sprawling Arctic Cryo-Basin rely on dense Server Farm clusters. Secure the glacial river bridges, infiltrate enemy compute clusters with Unit 8200 spies, reach Q-Day, and seize their armor with Project Prometheus.',
    intelNote:
      'Glacial water boosts Cryo cooling by +25%. Hold the southern bridgehead while charging Q-Day.',
    graceWindowLabel: '~4.5 min build-up window',
    objectiveDefs: [
      {
        label: 'Plant a Zero-Day Implant or reach 50%+ Q-Day progress',
        check: (s) => s.players.p1.implantedFlopsBonus > 0 || s.players.p1.qDayProgress >= 50,
      },
      {
        label: 'Build Project Prometheus Orbital Uplink or reach Q-Day (100%)',
        check: (s) =>
          s.players.p1.qDayActive ||
          getPlayerEntities(s, 'p1').some((e) => e.defId === 'prometheus_uplink'),
      },
      {
        label: 'Crush the Pact Arctic command hub across the river',
        check: (s) => s.winnerId === 'p1',
      },
    ],
    bonusObjective: {
      label: 'Bonus: Capture 2 neutral nodes in the Arctic basin (+600 Si)',
      check: (s) =>
        getPlayerEntities(s, 'p1').filter(
          (e) => e.defId === 'lng_terminal' || e.defId === 'fiber_station' || e.defId === 'analog_radar'
        ).length >= 2,
    },
    startingSilicon: 2800,
    setup: (state) => {
      const p1 = getBaseAnchor(state, 'p1');
      const ts = state.map.tileSize;
      spawnBuilding(state, 'p1', 'barracks', p1.tx + 3, p1.ty + 2);
      spawnBuilding(state, 'p1', 'war_factory', p1.tx + 3, p1.ty - 3);
      spawnBuilding(state, 'p1', 'cryo_core', p1.tx - 3, p1.ty + 3);
      spawnUnit(state, 'p1', 'unit_8200', p1.x + 130, p1.y - 95);
      spawnUnit(state, 'p1', 'loyal_wingman', p1.x + 170, p1.y - 125);
      // Pact northern river guard outpost
      spawnBuilding(state, 'ai1', 'server_farm', 66, 28);
      spawnBuilding(state, 'ai1', 'hpm_tower', 68, 30);
      spawnUnit(state, 'ai1', 'shock_trooper', 66 * ts, 32 * ts);
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
      'Mass-produce autonomous Type-99X armor 50% faster from Eurasian Dark Factories along the 112×84 Wafer Corridor. Pair EW Fiber-Tether Sappers with heavy armor so Western cyber warfare bounces harmlessly off.',
    intelNote:
      'Dark Factories stamp out units at overdrive speed—pair them with SMR Reactors and HPM Towers.',
    graceWindowLabel: '~4.5 min build-up window',
    objectiveDefs: [
      {
        label: 'Field 4+ Type-99X autonomous tanks supported by EW Sappers',
        check: (s) => {
          const ents = getPlayerEntities(s, 'p1');
          return (
            ents.filter((e) => e.defId === 'type_99x').length >= 4 &&
            ents.some((e) => e.defId === 'ew_sapper')
          );
        },
      },
      {
        label: 'Construct an HPM Defense Tower & Krasukha-Q Jammer',
        check: (s) => {
          const ents = getPlayerEntities(s, 'p1');
          return (
            ents.some((e) => e.defId === 'hpm_tower') &&
            ents.some((e) => e.defId === 'krasukha_q')
          );
        },
      },
      {
        label: 'Overwhelm the Western Alliance corridor base',
        check: (s) => s.winnerId === 'p1',
      },
    ],
    bonusObjective: {
      label: 'Bonus: Capture an LNG Terminal in the Silicon Corridor (+600 Si)',
      check: (s) => getPlayerEntities(s, 'p1').some((e) => e.defId === 'lng_terminal'),
    },
    startingSilicon: 2700,
    setup: (state) => {
      const p1 = getBaseAnchor(state, 'p1');
      const ts = state.map.tileSize;
      spawnBuilding(state, 'p1', 'barracks', p1.tx + 3, p1.ty + 2);
      spawnBuilding(state, 'p1', 'war_factory', p1.tx + 3, p1.ty - 3);
      spawnUnit(state, 'p1', 'ew_sapper', p1.x + 135, p1.y - 85);
      spawnUnit(state, 'p1', 'type_99x', p1.x + 175, p1.y - 85);
      spawnUnit(state, 'p1', 'type_99x', p1.x + 210, p1.y - 50);
      // Alliance central corridor forward bunker
      spawnBuilding(state, 'ai1', 'iron_beam', 66, 39);
      spawnBuilding(state, 'ai1', 'server_farm', 68, 41);
      spawnUnit(state, 'ai1', 'm1e4', 65 * ts, 41 * ts);
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
      'Alliance sensors dominate the Megacity avenues. Capture a Legacy Analog Radar Bunker so your own forces stay blind-proof, hold your sectors, and detonate the Kessler Cascade orbital EMP!',
    intelNote:
      'Analog Radar vacuum tubes are immune to Kessler EMP. Grab one before triggering orbital blackout!',
    graceWindowLabel: '~4.5 min build-up window',
    objectiveDefs: [
      {
        label: 'Capture a Legacy Analog Radar Bunker in the Megacity',
        check: (s) => getPlayerEntities(s, 'p1').some((e) => e.defId === 'analog_radar'),
      },
      {
        label: 'Detonate the Kessler Cascade orbital EMP',
        check: (s) => s.kesslerTimer > 0 || s.kesslerOwnerId === 'p1',
      },
      {
        label: 'Eliminate all Western Alliance forces in the Megacity',
        check: (s) => s.winnerId === 'p1',
      },
    ],
    bonusObjective: {
      label: 'Bonus: Field 2+ TOS-3 Thermobaric Launchers simultaneously (+600 Si)',
      check: (s) => getPlayerEntities(s, 'p1').filter((e) => e.defId === 'tos_3').length >= 2,
    },
    startingSilicon: 2900,
    setup: (state) => {
      const p1 = getBaseAnchor(state, 'p1');
      const ts = state.map.tileSize;
      spawnBuilding(state, 'p1', 'barracks', p1.tx + 3, p1.ty + 2);
      spawnBuilding(state, 'p1', 'war_factory', p1.tx + 3, p1.ty - 3);
      spawnBuilding(state, 'p1', 'cryo_core', p1.tx - 3, p1.ty + 3);
      spawnBuilding(state, 'p1', 'kessler_silo', p1.tx - 4, p1.ty - 3);
      state.players.p1.superweaponCharge = 65;
      spawnUnit(state, 'p1', 'shock_trooper', p1.x + 125, p1.y - 105);
      spawnUnit(state, 'p1', 'tos_3', p1.x + 170, p1.y - 75);
      // Alliance NE urban sensor bastion
      spawnBuilding(state, 'ai1', 'iron_beam', 66, 30);
      spawnBuilding(state, 'ai1', 'seismic_sensor', 68, 32);
      spawnUnit(state, 'ai1', 'forward_controller', 65 * ts, 32 * ts);
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
      'Western Iron Beams shred frontal assaults. Bait their targeting with holographic Decoy Batteries, burrow Tunnel-Borers beneath urban avenues, and overwhelm laser domes with Shahed-X swarms.',
    intelNote:
      'Keep Tunnel-Borers burrowed while crossing the Megacity blocks to bypass Iron Beam fire.',
    graceWindowLabel: '~4.5 min build-up window',
    objectiveDefs: [
      {
        label: 'Establish 2+ Decoy or Pop-Up Silo defensive positions',
        check: (s) =>
          getPlayerEntities(s, 'p1').filter(
            (e) => e.defId === 'decoy_battery' || e.defId === 'popup_silo'
          ).length >= 2,
      },
      {
        label: 'Operate a Heavy Vehicle Depot & 2+ Shahed-X Launchers',
        check: (s) => {
          const ents = getPlayerEntities(s, 'p1');
          return (
            ents.some((e) => e.defId === 'war_factory') &&
            ents.filter((e) => e.defId === 'shahed_launcher').length >= 2
          );
        },
      },
      {
        label: 'Destroy the Western Alliance Megacity command',
        check: (s) => s.winnerId === 'p1',
      },
    ],
    bonusObjective: {
      label: 'Bonus: Field 2+ Tunnel-Borers simultaneously (+600 Si)',
      check: (s) =>
        getPlayerEntities(s, 'p1').filter((e) => e.defId === 'tunnel_crawler').length >= 2,
    },
    startingSilicon: 2700,
    setup: (state) => {
      const p1 = getBaseAnchor(state, 'p1');
      const ts = state.map.tileSize;
      spawnBuilding(state, 'p1', 'barracks', p1.tx + 3, p1.ty + 2);
      spawnBuilding(state, 'p1', 'decoy_battery', p1.tx + 7, p1.ty - 2);
      spawnUnit(state, 'p1', 'tunnel_crawler', p1.x + 125, p1.y - 95);
      spawnUnit(state, 'p1', 'shahed_launcher', p1.x + 165, p1.y - 60);
      spawnUnit(state, 'p1', 'ied_crawler', p1.x + 105, p1.y - 45);
      // Alliance NE avenue checkpoint
      spawnBuilding(state, 'ai1', 'iron_beam', 66, 31);
      spawnUnit(state, 'ai1', 'valkyrie', 65 * ts, 33 * ts);
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
      'Lock down the central littoral strait across the 112×84 theater! Guard the three causeways with concealed Pop-Up Silos, flood the strait with explosive FAC speedboats, and trigger Strait Chokepoint supply collapse.',
    intelNote:
      'Three concrete causeways cross the diagonal sea strait—fortify your south approach early!',
    graceWindowLabel: '~4.5 min build-up window',
    objectiveDefs: [
      {
        label: 'Construct a Littoral Naval Dock & Concealed Pop-Up Silos (2+)',
        check: (s) => {
          const ents = getPlayerEntities(s, 'p1');
          return (
            ents.some((e) => e.defId === 'naval_dock') &&
            ents.filter((e) => e.defId === 'popup_silo').length >= 2
          );
        },
      },
      {
        label: 'Build a Choke-Net Control Hub or trigger Strait Chokepoint',
        check: (s) =>
          s.players.ai1.chokepointTimer > 0 ||
          getPlayerEntities(s, 'p1').some((e) => e.defId === 'chokepoint_hub'),
      },
      {
        label: 'Break the Eurasian Pact coastal foothold',
        check: (s) => s.winnerId === 'p1',
      },
    ],
    bonusObjective: {
      label: 'Bonus: Build 3+ Pop-Up Silos along the southern strait cliffs (+600 Si)',
      check: (s) =>
        getPlayerEntities(s, 'p1').filter((e) => e.defId === 'popup_silo').length >= 3,
    },
    startingSilicon: 2900,
    setup: (state) => {
      const p1 = getBaseAnchor(state, 'p1');
      const ts = state.map.tileSize;
      spawnBuilding(state, 'p1', 'smr', p1.tx - 3, p1.ty - 3);
      spawnBuilding(state, 'p1', 'popup_silo', p1.tx + 7, p1.ty - 3);
      spawnBuilding(state, 'p1', 'cryo_core', p1.tx - 3, p1.ty + 3);
      spawnUnit(state, 'p1', 'shahed_launcher', p1.x + 155, p1.y - 95);
      spawnUnit(state, 'p1', 'teleop_militia', p1.x + 115, p1.y - 65);
      // Pact northern causeway guard outpost
      spawnBuilding(state, 'ai1', 'hpm_tower', 80, 25);
      spawnUnit(state, 'ai1', 'shock_trooper', 79 * ts, 27 * ts);
    },
  },
];

export const MISSIONS: MissionDef[] = rawMissions.map((m) => ({
  ...m,
  objectives: m.objectiveDefs.map((o) => o.label),
}));

export function getMissionById(id: string | null | undefined): MissionDef | undefined {
  if (!id) return undefined;
  return MISSIONS.find((m) => m.id === id);
}
