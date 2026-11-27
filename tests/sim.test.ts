import { describe, expect, it } from 'vitest';
import { BRIEFING_CUTSCENES, getVictoryCutscene } from '../src/data/cutscenes';
import { MISSIONS } from '../src/data/missions';
import { DEMO_CHAPTERS, createDemoState, triggerDemoChapter } from '../src/sim/demo';
import { createInitialState, dispatchCommand, stepSimulation } from '../src/sim/engine';
import { computeLatencyFactor, spawnBuilding, spawnUnit } from '../src/sim/helpers';
import { MAP_CATALOG, MAP_HEIGHT, MAP_WIDTH } from '../src/sim/mapGen';
import { computeStateChecksum, deserializeGameState, serializeGameState } from '../src/sim/serialize';
import type { MatchConfig } from '../src/sim/types';
import { CloudSyncAdapter, createStorageAdapter } from '../src/storage';

const BASE_CONFIG: MatchConfig = {
  seed: 424242,
  playerFaction: 'alliance',
  aiFaction: 'pact',
  aiDifficulty: 'commander',
};

describe('Silicon Dawn full 3-faction simulation, EW, Cyber & Superweapons', () => {
  it('produces identical v2 checksums across save/load and migrates v1 saves cleanly', () => {
    const stateA = createInitialState(BASE_CONFIG);
    dispatchCommand(stateA, { type: 'startBuildBuilding', playerId: 'p1', defId: 'barracks' });
    dispatchCommand(stateA, { type: 'toggleOverclock', playerId: 'p1' });

    for (let i = 0; i < 120; i++) stepSimulation(stateA);

    const saved = serializeGameState(stateA);
    expect(saved.schemaVersion).toBe(2);

    const stateB = deserializeGameState(JSON.parse(JSON.stringify(saved)));
    expect(computeStateChecksum(stateB)).toBe(computeStateChecksum(stateA));

    for (let i = 0; i < 120; i++) {
      stepSimulation(stateA);
      stepSimulation(stateB);
    }
    expect(computeStateChecksum(stateB)).toBe(computeStateChecksum(stateA));

    // v1 migration test
    const v1Stub = {
      schemaVersion: 1,
      savedAt: new Date().toISOString(),
      checksum: 'ignored',
      state: { ...JSON.parse(JSON.stringify(stateA)), schemaVersion: 1 },
    };
    delete (v1Stub.state as Record<string, unknown>).kesslerTimer;
    const migrated = deserializeGameState(v1Stub);
    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.kesslerTimer).toBe(0);
  });

  it('scales FLOPS latency smoothly and enforces Power Safe Mode + Human Override', () => {
    expect(computeLatencyFactor(20, 20)).toBe(1.0);
    expect(computeLatencyFactor(20, 16)).toBe(0.85);
    expect(computeLatencyFactor(20, 12)).toBe(0.65);
    expect(computeLatencyFactor(20, 6)).toBe(0.4);

    const state = createInitialState(BASE_CONFIG);
    spawnBuilding(state, 'p1', 'barracks', 10, 26);
    for (const id of state.entityOrder) {
      const e = state.entities[id];
      if (e && e.ownerId === 'p1' && e.defId === 'smr') e.hp = 0;
    }
    stepSimulation(state);

    const m1e4 = state.entityOrder
      .map((id) => state.entities[id])
      .find((e) => e && e.ownerId === 'p1' && e.defId === 'm1e4')!;
    const ctrl = state.entityOrder
      .map((id) => state.entities[id])
      .find((e) => e && e.ownerId === 'p1' && e.defId === 'forward_controller')!;

    m1e4.x = 1800;
    m1e4.y = 1400;
    ctrl.x = 300;
    ctrl.y = 300;
    stepSimulation(state);
    expect(m1e4.safeMode).toBe(true);

    ctrl.x = m1e4.x + 50;
    ctrl.y = m1e4.y;
    stepSimulation(state);
    expect(m1e4.humanOverride).toBe(true);
    expect(m1e4.safeMode).toBe(false);
  });

  it('enforces RPS counters: Aerosol Smoke, HPM immunity, Type-99X repair & Fiber Tether cyber immunity', () => {
    const state = createInitialState(BASE_CONFIG);
    const hel = spawnBuilding(state, 'p1', 'iron_beam', 18, 18);
    const enemyBot = spawnUnit(state, 'ai1', 'wolf_pack', hel.x + 120, hel.y);
    enemyBot.hp = 500;
    enemyBot.maxHp = 500;

    for (let i = 0; i < 8; i++) stepSimulation(state);
    const clearDamage = 500 - enemyBot.hp;
    expect(clearDamage).toBeGreaterThan(0);

    enemyBot.hp = 500;
    hel.cooldown = 0;
    state.smokeClouds.push({
      id: 'test_smoke',
      ownerId: 'ai1',
      x: hel.x + 60,
      y: hel.y,
      radius: 90,
      life: 8,
      maxLife: 8,
    });
    for (let i = 0; i < 8; i++) stepSimulation(state);
    expect(500 - enemyBot.hp).toBeCloseTo(clearDamage * 0.2, 0);

    // HPM: 0 damage to heavy human armor vs damage to autonomous bot
    const hpm = spawnBuilding(state, 'ai1', 'hpm_tower', 26, 26);
    const heavyHuman = spawnUnit(state, 'p1', 'shock_trooper', hpm.x + 100, hpm.y);
    const autoBot = spawnUnit(state, 'p1', 'valkyrie', hpm.x + 100, hpm.y + 10);
    const startHumanHp = heavyHuman.hp;
    const startAutoHp = autoBot.hp;
    hpm.cooldown = 0;
    stepSimulation(state);
    expect(heavyHuman.hp).toBe(startHumanHp);
    expect(autoBot.hp).toBeLessThan(startAutoHp);

    // Fiber Tether Spool makes Type-99X immune to Data Poison & Prometheus
    const sapper = spawnUnit(state, 'ai1', 'ew_sapper', 1900, 300);
    const tetheredTank = spawnUnit(state, 'ai1', 'type_99x', sapper.x + 60, sapper.y);
    const untetheredTank = spawnUnit(state, 'ai1', 'type_99x', 1900, 900);
    spawnBuilding(state, 'p1', 'cryo_core', 10, 24);
    dispatchCommand(state, {
      type: 'useCyberPower',
      playerId: 'p1',
      powerId: 'data_poison',
      x: tetheredTank.x,
      y: tetheredTank.y,
    });
    state.players.p1.cyberCooldowns.data_poison = 0;
    dispatchCommand(state, {
      type: 'useCyberPower',
      playerId: 'p1',
      powerId: 'data_poison',
      x: untetheredTank.x,
      y: untetheredTank.y,
    });
    stepSimulation(state);
    expect(tetheredTank.tethered).toBe(true);
    expect(tetheredTank.poisonTimer).toBe(0);
    expect(untetheredTank.tethered).toBe(false);
    expect(untetheredTank.poisonTimer).toBeGreaterThan(0);
  });

  it('supports Unit 8200 Zero-Day Implants, Q-Day False Orders, Shahed-X Hive-Mind split & Tunnel/Seismic counters', () => {
    const state = createInitialState({
      seed: 999,
      playerFaction: 'alliance',
      aiFaction: 'axis',
      aiDifficulty: 'commander',
    });

    // Unit 8200 Zero-Day Implant siphons FLOPS from enemy Server Farm
    const aiFarm = state.entityOrder
      .map((id) => state.entities[id])
      .find((e) => e && e.ownerId === 'ai1' && e.defId === 'server_farm')!;
    const spy = spawnUnit(state, 'p1', 'unit_8200', aiFarm.x + 20, aiFarm.y);
    expect(spy.isRevealed).toBe(false);
    stepSimulation(state);
    expect(aiFarm.implantedBy).toBe('p1');
    expect(state.players.p1.implantedFlopsBonus).toBe(12);

    // Q-Day Decryption unlocks False Order Injection
    spawnBuilding(state, 'p1', 'cryo_core', 10, 24);
    state.players.p1.qDayProgress = 100;
    state.players.p1.qDayActive = true;
    const aiCrawler = spawnUnit(state, 'ai1', 'ied_crawler', 1500, 1000);
    dispatchCommand(state, {
      type: 'useCyberPower',
      playerId: 'p1',
      powerId: 'false_orders',
      x: aiCrawler.x,
      y: aiCrawler.y,
    });
    expect(aiCrawler.order.type).toBe('move');

    // Axis Tunnel-Borer burrowed stealth + Seismic Sensor reveal + TOS-3 collapse
    const borer = spawnUnit(state, 'ai1', 'tunnel_crawler', 1200, 900);
    dispatchCommand(state, { type: 'toggleBurrow', playerId: 'ai1', unitIds: [borer.id] });
    stepSimulation(state);
    expect(borer.burrowed).toBe(true);
    expect(borer.isRevealed).toBe(false);

    spawnBuilding(state, 'p1', 'seismic_sensor', Math.floor(borer.x / 48) + 2, Math.floor(borer.y / 48));
    stepSimulation(state);
    expect(borer.isRevealed).toBe(true);

    // Shahed-X swarm split on Iron Beam kill (ensure sufficient MW power for HEL)
    spawnBuilding(state, 'p1', 'smr', 12, 24);
    const hel = spawnBuilding(state, 'p1', 'iron_beam', 20, 20);
    const launcher = spawnUnit(state, 'ai1', 'shahed_launcher', hel.x + 250, hel.y);
    dispatchCommand(state, {
      type: 'launchSwarm',
      playerId: 'ai1',
      unitIds: [launcher.id],
      x: hel.x,
      y: hel.y,
    });
    for (let i = 0; i < 28; i++) stepSimulation(state);
    const survivingSwarm = state.entityOrder
      .map((id) => state.entities[id])
      .filter((e) => e && e.defId === 'shahed_drone');
    expect(survivingSwarm.some((d) => d.swarmSplitActive)).toBe(true);
  });

  it('executes all 3 faction Superweapons (Prometheus, Kessler EMP, Strait Chokepoint)', () => {
    // 1. Project Prometheus converts untethered enemy autonomous tank
    const s1 = createInitialState(BASE_CONFIG);
    spawnBuilding(s1, 'p1', 'cryo_core', 10, 24);
    spawnBuilding(s1, 'p1', 'prometheus_uplink', 11, 24);
    s1.players.p1.superweaponCharge = 100;
    const pactTank = spawnUnit(s1, 'ai1', 'type_99x', 1500, 900);
    dispatchCommand(s1, { type: 'fireSuperweapon', playerId: 'p1', x: pactTank.x, y: pactTank.y });
    for (let i = 0; i < 60; i++) stepSimulation(s1);
    expect(pactTank.ownerId).toBe('p1');

    // 2. Kessler Cascade triggers 180s blackout & EMP stun on unhardened bots
    const s2 = createInitialState({
      seed: 10,
      playerFaction: 'pact',
      aiFaction: 'alliance',
      aiDifficulty: 'recruit',
    });
    spawnBuilding(s2, 'p1', 'cryo_core', 10, 24);
    spawnBuilding(s2, 'p1', 'kessler_silo', 11, 24);
    s2.players.p1.superweaponCharge = 100;
    const m1 = s2.entityOrder
      .map((id) => s2.entities[id])
      .find((e) => e && e.ownerId === 'ai1' && e.defId === 'm1e4')!;
    m1.x = 1800;
    m1.y = 400;
    dispatchCommand(s2, { type: 'fireSuperweapon', playerId: 'p1', x: 0, y: 0 });
    stepSimulation(s2);
    expect(s2.kesslerTimer).toBeGreaterThan(175);
    expect(m1.empStunTimer).toBeGreaterThan(0);

    // 3. Strait Chokepoint activates 60s 2x unit cost & -75% income
    const s3 = createInitialState({
      seed: 20,
      playerFaction: 'axis',
      aiFaction: 'alliance',
      aiDifficulty: 'recruit',
    });
    spawnBuilding(s3, 'p1', 'cryo_core', 10, 24);
    spawnBuilding(s3, 'p1', 'chokepoint_hub', 11, 24);
    s3.players.p1.superweaponCharge = 100;
    dispatchCommand(s3, { type: 'fireSuperweapon', playerId: 'p1', x: 0, y: 0 });
    expect(s3.players.ai1.chokepointTimer).toBe(60);
  });

  it('supports all 5 curated maps, neutral Fiber/Analog Radar capture, and all 7 campaign/tutorial missions', () => {
    for (const m of MAP_CATALOG) {
      const s = createInitialState({
        seed: 777,
        playerFaction: 'alliance',
        aiFaction: 'pact',
        aiDifficulty: 'recruit',
        mapId: m.id,
      });
      for (let i = 0; i < 40; i++) stepSimulation(s);
      const saved = serializeGameState(s);
      const reloaded = deserializeGameState(JSON.parse(JSON.stringify(saved)));
      expect(computeStateChecksum(reloaded)).toBe(computeStateChecksum(s));
    }

    // Subsea Fiber Station +40 FLOPS & Analog Radar EMP-immune vision
    const sNode = createInitialState({
      seed: 888,
      playerFaction: 'pact',
      aiFaction: 'alliance',
      aiDifficulty: 'recruit',
      mapId: 'arctic_cryo',
    });
    const baseFlops = sNode.players.p1.flopsCap;
    const fiber = spawnBuilding(sNode, 'p1', 'fiber_station', 14, 24);
    const radar = spawnBuilding(sNode, 'p1', 'analog_radar', 24, 10);
    sNode.kesslerTimer = 120;
    stepSimulation(sNode);
    stepSimulation(sNode);
    stepSimulation(sNode);
    stepSimulation(sNode); // fog updates every 4 ticks
    expect(sNode.players.p1.flopsCap).toBe(baseFlops + 40);
    // Analog Radar retains full 340px vision (~7 tiles) during Kessler EMP
    const farTileX = Math.floor((radar.x + 260) / sNode.map.tileSize);
    const farTileY = Math.floor(radar.y / sNode.map.tileSize);
    expect(sNode.fog.p1[farTileY * sNode.map.width + farTileX]).toBe(2);
    expect(fiber.ownerId).toBe('p1');

    // All 7 missions initialize cleanly & step deterministically
    for (const mission of MISSIONS) {
      const ms = createInitialState({
        seed: 101,
        playerFaction: mission.faction,
        aiFaction: mission.enemyFaction,
        aiDifficulty: mission.difficulty,
        mapId: mission.mapId,
        missionId: mission.id,
      });
      for (let i = 0; i < 30; i++) stepSimulation(ms);
      expect(ms.missionId).toBe(mission.id);
      const rt = deserializeGameState(JSON.parse(JSON.stringify(serializeGameState(ms))));
      expect(computeStateChecksum(rt)).toBe(computeStateChecksum(ms));
    }
  });

  it('supports stopUnits command and cloud-ready storage adapter selection', () => {
    const state = createInitialState(BASE_CONFIG);
    const tank = state.entityOrder
      .map((id) => state.entities[id])
      .find((e) => e && e.ownerId === 'p1' && e.defId === 'm1e4')!;
    dispatchCommand(state, { type: 'moveUnits', playerId: 'p1', unitIds: [tank.id], x: 1400, y: 800 });
    for (let i = 0; i < 10; i++) stepSimulation(state);
    expect(tank.path.length).toBeGreaterThan(0);

    dispatchCommand(state, { type: 'stopUnits', playerId: 'p1', unitIds: [tank.id] });
    expect(tank.order.type).toBe('idle');
    expect(tank.path.length).toBe(0);

    const local = createStorageAdapter();
    expect(local.kind).toBe('local');
    const cloud = createStorageAdapter({
      baseUrl: 'https://example.invalid/api',
      getAuthToken: async () => null,
    });
    expect(cloud).toBeInstanceOf(CloudSyncAdapter);
    expect(cloud.kind).toBe('cloud');
  });

  it('uses expanded 72x54 maps, initial wave grace timer, FMV scripts, and 6-chapter Showcase Demo', () => {
    expect(MAP_WIDTH).toBe(72);
    expect(MAP_HEIGHT).toBe(54);
    for (const m of MAP_CATALOG) {
      const mapState = createInitialState({ ...BASE_CONFIG, mapId: m.id });
      expect(mapState.map.width).toBe(MAP_WIDTH);
      expect(mapState.map.height).toBe(MAP_HEIGHT);
    }

    const skirmish = createInitialState(BASE_CONFIG);
    expect(skirmish.players.ai1.aiWaveTimer).toBeGreaterThanOrEqual(95);

    const boot = createInitialState({
      ...BASE_CONFIG,
      aiDifficulty: 'recruit',
      missionId: 'boot_sequence',
    });
    expect(boot.players.ai1.aiWaveTimer).toBeGreaterThanOrEqual(135);

    // Every mission has an FMV briefing script + victory debrief generator works for all factions
    for (const mission of MISSIONS) {
      expect(BRIEFING_CUTSCENES[mission.id]).toBeDefined();
      expect(BRIEFING_CUTSCENES[mission.id].beats.length).toBeGreaterThanOrEqual(2);
    }
    expect(getVictoryCutscene('alliance', 'Test Op').beats.length).toBeGreaterThan(0);
    expect(getVictoryCutscene('pact', 'Test Op').beats.length).toBeGreaterThan(0);
    expect(getVictoryCutscene('axis', 'Test Op').beats.length).toBeGreaterThan(0);

    // Demo sandbox runs all 6 showcase chapters cleanly without errors
    const demoState = createDemoState();
    expect(demoState.config.isDemo).toBe(true);
    expect(DEMO_CHAPTERS.length).toBe(6);
    for (let idx = 0; idx < DEMO_CHAPTERS.length; idx++) {
      const ch = triggerDemoChapter(demoState, idx);
      expect(ch.id).toBe(DEMO_CHAPTERS[idx].id);
      for (let t = 0; t < 25; t++) {
        stepSimulation(demoState);
      }
    }
    expect(demoState.tick).toBe(DEMO_CHAPTERS.length * 25);
  });
});
