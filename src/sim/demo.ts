import { executeCyberPower, executeSuperweapon, launchSwarmFromUnit } from './abilities';
import { createInitialState, dispatchCommand } from './engine';
import { spawnBuilding, spawnUnit } from './helpers';
import type { GameState, OverlayMode } from './types';

export interface DemoChapter {
  id: string;
  title: string;
  summary: string;
  cameraX: number;
  cameraY: number;
  cameraZoom: number;
  overlayMode: OverlayMode;
}

export const DEMO_CHAPTERS: DemoChapter[] = [
  {
    id: 'economy_overclock',
    title: '1. Silicon Relays, Power Grid & Overclock 150%',
    summary:
      'Data-Relay Crawlers stream Silicon via fiber links while Server Farms supply FLOPS. Overclock boosts speed 150% — watch thermal load!',
    cameraX: 620,
    cameraY: 3340,
    cameraZoom: 0.88,
    overlayMode: 'power',
  },
  {
    id: 'hel_vs_swarm',
    title: '2. Iron Beam HEL vs. Shahed-X Hive Swarm & Smoke',
    summary:
      'Iron Beam lasers shred incoming Shahed-X drones (remaining drones dynamically split angles), while Aerosol Smoke cuts laser damage by 80%.',
    cameraX: 1960,
    cameraY: 2640,
    cameraZoom: 0.92,
    overlayMode: 'tactical',
  },
  {
    id: 'ew_tethers',
    title: '3. EM Spectrum: Krasukha-Q Jamming & Fiber Tethers',
    summary:
      'Krasukha-Q trucks project crimson GPS-denied hex domes that crash wireless drones, while EW Sappers tether Type-99X tanks via physical fiber.',
    cameraX: 3160,
    cameraY: 1340,
    cameraZoom: 0.9,
    overlayMode: 'em',
  },
  {
    id: 'aps_tunnels',
    title: '4. Trophy APS, Seismic Sensors & Tunnel-Borers',
    summary:
      'M1E4 tanks intercept rockets with Trophy APS while Seismic Sensors expose burrowed Axis Tunnel-Borers to TOS-3 Thermobaric blasts.',
    cameraX: 2300,
    cameraY: 1930,
    cameraZoom: 0.9,
    overlayMode: 'tactical',
  },
  {
    id: 'cyber_qday',
    title: '5. Q-Day Decryption, Data Poisoning & Zero-Day',
    summary:
      'Cryo-Cores crack Q-Day (revealing enemy queues/waypoints), Unit 8200 implants siphon FLOPS, and Data Poisoning triggers friendly fire.',
    cameraX: 4220,
    cameraY: 800,
    cameraZoom: 0.88,
    overlayMode: 'em',
  },
  {
    id: 'superweapons',
    title: '6. Superweapons: Project Prometheus & Kessler EMP',
    summary:
      'Alliance Project Prometheus fires an orbital conversion beam to hijack enemy bots, followed by a Kessler Cascade EMP orbital blackout.',
    cameraX: 4000,
    cameraY: 1050,
    cameraZoom: 0.85,
    overlayMode: 'tactical',
  },
];

export function createDemoState(): GameState {
  const state = createInitialState({
    seed: 202699,
    playerFaction: 'alliance',
    aiFaction: 'pact',
    aiDifficulty: 'recruit',
    mapId: 'peninsula_grid',
    isDemo: true,
  });

  state.players.p1.silicon = 9500;
  state.players.ai1.silicon = 9500;
  state.players.p1.qDayProgress = 100;
  state.players.p1.qDayActive = true;

  // Reveal entire 112x84 map so spectators see every showcase sector cleanly
  if (state.fog.p1) state.fog.p1.fill(2);
  if (state.fog.ai1) state.fog.ai1.fill(2);

  // Sector 1 (SW Base): Extra SMR + Cryo-Core + Prometheus Uplink + 2nd Crawler
  spawnBuilding(state, 'p1', 'smr', 5, 69);
  spawnBuilding(state, 'p1', 'server_farm', 15, 76);
  spawnBuilding(state, 'p1', 'cryo_core', 5, 76);
  spawnBuilding(state, 'p1', 'prometheus_uplink', 17, 68);
  spawnUnit(state, 'p1', 'relay_crawler', 480, 3180);

  // Sector 2 (Mid-South): Iron Beam battery + Smoke Carrier + Shahed-X Launcher
  spawnBuilding(state, 'p1', 'smr', 38, 56);
  spawnBuilding(state, 'p1', 'iron_beam', 39, 54);
  spawnBuilding(state, 'p1', 'iron_beam', 41, 55);
  spawnUnit(state, 'p1', 'smoke_carrier', 1872, 2640);
  spawnUnit(state, 'ai1', 'shahed_launcher', 2160, 2592);

  // Sector 3 (Mid-North): Krasukha-Q Jamming Dome + EW Sapper + Damaged Type-99X welding pair
  spawnUnit(state, 'ai1', 'krasukha_q', 3120, 1344);
  spawnUnit(state, 'ai1', 'ew_sapper', 3180, 1364);
  const tA = spawnUnit(state, 'ai1', 'type_99x', 3220, 1314);
  const tB = spawnUnit(state, 'ai1', 'type_99x', 3265, 1334);
  tA.hp = 310;
  tB.hp = 340;

  // Sector 4 (Center Bridge Corridor): M1E4 + Forward Controller + Seismic Sensor + TOS-3 + Tunnel Borer
  spawnBuilding(state, 'p1', 'seismic_sensor', 48, 41);
  spawnUnit(state, 'p1', 'm1e4', 2208, 1920);
  spawnUnit(state, 'p1', 'forward_controller', 2168, 1940);
  spawnUnit(state, 'p1', 'tos_3', 2496, 1872);
  const borer = spawnUnit(state, 'ai1', 'tunnel_crawler', 2400, 2016);
  borer.burrowed = true;

  // Sector 5 & 6 (NE Sector): Enemy Server Farms + Unit 8200 + Enemy Armor Group
  spawnBuilding(state, 'ai1', 'server_farm', 92, 16);
  spawnUnit(state, 'p1', 'unit_8200', 4272, 720);
  for (let i = 0; i < 4; i++) {
    spawnUnit(state, 'ai1', 'type_99x', 3936 + i * 48, 1056 + (i % 2) * 35);
  }
  spawnUnit(state, 'ai1', 'wolf_pack', 4000, 1120);

  return state;
}

export function triggerDemoChapter(state: GameState, chapterIndex: number): DemoChapter {
  const idx = ((chapterIndex % DEMO_CHAPTERS.length) + DEMO_CHAPTERS.length) % DEMO_CHAPTERS.length;
  const ch = DEMO_CHAPTERS[idx];

  // Ensure fog remains fully visible
  if (state.fog.p1) state.fog.p1.fill(2);

  if (ch.id === 'economy_overclock') {
    state.players.p1.overclock = true;
    state.players.p1.thermalLoad = 28;
  } else {
    state.players.p1.overclock = false;
  }

  if (ch.id === 'hel_vs_swarm') {
    const launcher = state.entityOrder
      .map((id) => state.entities[id])
      .find((e) => e && e.defId === 'shahed_launcher');
    if (launcher) {
      launcher.launchCooldown = 0;
      launchSwarmFromUnit(state, launcher, 1880, 2620);
    }
    const smokeUnit = state.entityOrder
      .map((id) => state.entities[id])
      .find((e) => e && e.defId === 'smoke_carrier');
    if (smokeUnit) {
      smokeUnit.smokeCooldown = 0;
      dispatchCommand(state, { type: 'deploySmoke', playerId: 'p1', unitIds: [smokeUnit.id] });
    }
  } else if (ch.id === 'ew_tethers') {
    // Spawn wireless drones near Krasukha-Q to demonstrate jamming crash
    for (let i = 0; i < 3; i++) {
      const d = spawnUnit(state, 'p1', 'shahed_drone', 3020 + i * 25, 1304);
      d.order = { type: 'attackMove', targetX: 3180, targetY: 1344 };
      d.path = [{ x: 3180, y: 1344 }];
    }
  } else if (ch.id === 'aps_tunnels') {
    const m1 = state.entityOrder
      .map((id) => state.entities[id])
      .find((e) => e && e.defId === 'm1e4');
    if (m1) m1.apsCooldown = 0;
    const wolf = spawnUnit(state, 'ai1', 'wolf_pack', 2380, 1930);
    wolf.order = { type: 'attackMove', targetX: 2208, targetY: 1920 };
    wolf.path = [{ x: 2208, y: 1920 }];
  } else if (ch.id === 'cyber_qday') {
    state.players.p1.cyberCooldowns.data_poison = 0;
    state.players.p1.cyberCooldowns.deepfake_spoof = 0;
    executeCyberPower(state, 'p1', 'data_poison', 4020, 1060);
    executeCyberPower(state, 'p1', 'deepfake_spoof', 4160, 880);
  } else if (ch.id === 'superweapons') {
    state.players.p1.superweaponCharge = 100;
    executeSuperweapon(state, 'p1', 4000, 1060);
    state.kesslerTimer = 18;
  }

  return ch;
}
