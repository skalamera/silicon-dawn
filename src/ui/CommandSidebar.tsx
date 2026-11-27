import {
  useEffect,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react';
import {
  BUILDABLE_STRUCTURES,
  BUILDABLE_UNITS,
  BUILDING_DEFS,
  CYBER_POWER_LIST,
  CYBER_POWERS,
  isAvailableForFaction,
  UNIT_DEFS,
  type BuildingId,
  type CyberPowerId,
  type UnitId,
} from '../data/defs';
import type { ArmedTargeting } from '../renderer/CanvasRenderer';
import type { Entity, GameState, SimCommand } from '../sim/types';
import {
  ArrowDownUp,
  Crosshair,
  DollarSign,
  Flame,
  Layers,
  LockKeyhole,
  PanelRightClose,
  PanelRightOpen,
  Radio,
  Rocket,
  ShieldAlert,
  SquareDashedMousePointer,
  Star,
  Wind,
  Wrench,
} from 'lucide-react';
import { getVeterancyLabel } from '../sim/helpers';
import { UnitIcon } from './UnitIcon';

interface CommandSidebarProps {
  state: GameState;
  minimapRef: RefObject<HTMLCanvasElement | null>;
  selectedIds: Set<string>;
  attackMoveArmed: boolean;
  boxSelectMode: boolean;
  armedTargeting: ArmedTargeting;
  onArmTargeting: (target: ArmedTargeting) => void;
  onToggleAttackMove: () => void;
  onToggleBoxSelectMode: () => void;
  onDispatch: (cmd: SimCommand) => void;
  onPanMinimap: (wx: number, wy: number) => void;
  forcedTab?: 'structures' | 'units' | 'cyber' | null;
  forcedMobileOpen?: boolean;
}

export function CommandSidebar({
  state,
  minimapRef,
  selectedIds,
  attackMoveArmed,
  boxSelectMode,
  armedTargeting,
  onArmTargeting,
  onToggleAttackMove,
  onToggleBoxSelectMode,
  onDispatch,
  onPanMinimap,
  forcedTab,
  forcedMobileOpen,
}: CommandSidebarProps) {
  const [tab, setTab] = useState<'structures' | 'units' | 'cyber'>('structures');
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (forcedTab) setTab(forcedTab);
  }, [forcedTab]);

  useEffect(() => {
    if (forcedMobileOpen) setMobileOpen(true);
  }, [forcedMobileOpen]);

  const player = state.players.p1;
  const enemy = state.players.ai1;
  const ownedBuildings = new Set<BuildingId>();
  for (const id of state.entityOrder) {
    const e = state.entities[id];
    if (e && e.kind === 'building' && e.ownerId === 'p1') {
      ownedBuildings.add(e.defId as BuildingId);
    }
  }

  const hasCryoCore = ownedBuildings.has('cryo_core');
  const swId: BuildingId =
    player.faction === 'alliance'
      ? 'prometheus_uplink'
      : player.faction === 'pact'
      ? 'kessler_silo'
      : 'chokepoint_hub';
  const hasSuperweapon = ownedBuildings.has(swId);

  const selectedEntities: Entity[] = Array.from(selectedIds)
    .map((id) => state.entities[id])
    .filter((e): e is Entity => Boolean(e && e.ownerId === 'p1'));
  const damagedSelected = selectedEntities.filter(
    (e) => e.defId !== 'silicon_node' && e.hp > 0 && e.hp < e.maxHp
  );
  const anyManualRepairing = damagedSelected.some((e) => Boolean(e.manualRepair));
  const singleSelected = selectedEntities.length === 1 ? selectedEntities[0] : null;
  const singleSellableBuilding =
    singleSelected &&
    singleSelected.kind === 'building' &&
    !BUILDING_DEFS[singleSelected.defId as BuildingId]?.isNeutralCapture
      ? singleSelected
      : null;
  const singleLabel = singleSelected
    ? singleSelected.kind === 'building'
      ? BUILDING_DEFS[singleSelected.defId as BuildingId].shortName
      : UNIT_DEFS[singleSelected.defId as UnitId].shortName
    : null;
  const highestRank = selectedEntities.reduce<0 | 1 | 2 | 3>(
    (best, e) => (e.veterancy > best ? e.veterancy : best),
    0
  );
  const hasSelectedMcv = selectedEntities.find((e) => e.defId === 'mcv');
  const hasSmokeCarrier = selectedEntities.some((e) => e.defId === 'smoke_carrier');
  const hasTunnelCrawler = selectedEntities.some((e) => e.defId === 'tunnel_crawler');
  const hasSwarmLauncher = selectedEntities.some(
    (e) => e.defId === 'shahed_launcher' || e.defId === 'drone_mothership'
  );

  const handleMinimapPointer = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (e.buttons === 0 && e.type === 'pointermove') return;
    const canvas = minimapRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const nx = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const ny = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    onPanMinimap(nx * state.map.width * state.map.tileSize, ny * state.map.height * state.map.tileSize);
  };

  const structures = BUILDABLE_STRUCTURES.filter((id) =>
    isAvailableForFaction(BUILDING_DEFS[id].faction, player.faction)
  );
  const units = BUILDABLE_UNITS.filter((id) =>
    isAvailableForFaction(UNIT_DEFS[id].faction, player.faction)
  );

  const factionLabel =
    player.faction === 'alliance'
      ? 'ALLIANCE'
      : player.faction === 'pact'
      ? 'EURASIAN PACT'
      : 'ASYMMETRIC AXIS';

  return (
    <>
      <button
        type="button"
        onClick={() => setMobileOpen((v) => !v)}
        className="md:hidden fixed right-2 bottom-16 z-30 flex items-center gap-1.5 rounded-full border border-sky-400/50 bg-slate-950/90 px-3 py-2 text-xs font-semibold text-sky-200 shadow-lg backdrop-blur"
      >
        {mobileOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
        <span>{mobileOpen ? 'Hide' : 'Command'}</span>
      </button>

      <aside
        className={`${
          mobileOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'
        } fixed md:static right-0 top-12 bottom-0 z-20 w-64 sm:w-72 md:w-64 shrink-0 border-l border-sky-500/25 bg-slate-950/95 backdrop-blur-md flex flex-col transition-transform duration-200`}
      >
        {/* Interactive Radar Minimap */}
        <div className="p-2.5 border-b border-slate-800/90">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-1">
            <span>SAT RECON</span>
            <span className="text-sky-400">{factionLabel}</span>
          </div>
          <canvas
            ref={minimapRef}
            width={224}
            height={148}
            onPointerDown={handleMinimapPointer}
            onPointerMove={handleMinimapPointer}
            className="w-full h-32 rounded border border-slate-700/80 bg-slate-950 cursor-crosshair touch-none"
          />
        </div>

        {/* Armed Targeting Banner */}
        {armedTargeting && (
          <div className="mx-2.5 mt-2 rounded border border-purple-400/70 bg-purple-950/70 px-2.5 py-2 text-xs flex items-center justify-between gap-2">
            <div>
              <div className="font-bold text-purple-200">
                {armedTargeting.kind === 'superweapon'
                  ? BUILDING_DEFS[swId].shortName
                  : CYBER_POWERS[armedTargeting.powerId].shortName}
              </div>
              <div className="text-purple-300/80">Click target sector</div>
            </div>
            <button
              type="button"
              onClick={() => onArmTargeting(null)}
              className="rounded border border-purple-400/40 px-2 py-1 text-xs text-purple-100"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Ready-to-Place Banner */}
        {player.readyBuildingDefId && (
          <div className="mx-2.5 mt-2 rounded border border-cyan-400/70 bg-cyan-950/60 px-2.5 py-2 text-xs flex items-center justify-between gap-2">
            <div>
              <div className="font-bold text-cyan-200">
                {BUILDING_DEFS[player.readyBuildingDefId].shortName} READY
              </div>
              <div className="text-cyan-300/80">Click map to deploy</div>
            </div>
            <button
              type="button"
              onClick={() => onDispatch({ type: 'cancelBuildBuilding', playerId: 'p1' })}
              className="rounded border border-cyan-400/40 px-2 py-1 text-xs text-cyan-100 hover:bg-cyan-900"
            >
              Cancel
            </button>
          </div>
        )}

        {/* 3-Tab Command Selector: Structures | Units | Cyber */}
        <div className="grid grid-cols-3 gap-1 p-2 border-b border-slate-800 text-xs">
          <button
            type="button"
            onClick={() => setTab('structures')}
            className={`rounded py-1.5 font-semibold transition ${
              tab === 'structures'
                ? 'bg-sky-500 text-slate-950'
                : 'bg-slate-900 text-slate-300 hover:text-white'
            }`}
          >
            Build
          </button>
          <button
            type="button"
            data-tour="tab-units"
            onClick={() => setTab('units')}
            className={`rounded py-1.5 font-semibold transition ${
              tab === 'units'
                ? 'bg-sky-500 text-slate-950'
                : 'bg-slate-900 text-slate-300 hover:text-white'
            }`}
          >
            Units ({player.unitQueue.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('cyber')}
            className={`rounded py-1.5 font-semibold transition ${
              tab === 'cyber'
                ? 'bg-purple-500 text-white'
                : 'bg-slate-900 text-slate-300 hover:text-white'
            }`}
          >
            Cyber
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto tactical-scroll p-2 space-y-2">
          {tab === 'structures' && (
            <div className="grid grid-cols-2 gap-1.5">
              {structures.map((id) => {
                const def = BUILDING_DEFS[id];
                const reqMet =
                  ownedBuildings.has('conyard') &&
                  (!def.requires || def.requires.every((r) => ownedBuildings.has(r)));
                const isBuildingThis = player.buildingQueue?.defId === id;
                const progress = isBuildingThis
                  ? player.buildingQueue!.progress / player.buildingQueue!.totalTime
                  : 0;
                const disabled =
                  !reqMet ||
                  Boolean(player.buildingQueue) ||
                  Boolean(player.readyBuildingDefId) ||
                  player.silicon < def.cost;

                return (
                  <button
                    key={id}
                    type="button"
                    data-tour={id === 'barracks' ? 'build-barracks' : undefined}
                    title={def.description}
                    disabled={disabled && !isBuildingThis}
                    onClick={() =>
                      isBuildingThis
                        ? onDispatch({ type: 'cancelBuildBuilding', playerId: 'p1' })
                        : onDispatch({ type: 'startBuildBuilding', playerId: 'p1', defId: id })
                    }
                    className={`relative overflow-hidden rounded border p-2 text-left transition min-h-[62px] ${
                      isBuildingThis
                        ? 'border-sky-400 bg-sky-950/60'
                        : reqMet
                        ? 'border-slate-700/80 bg-slate-900/90 hover:border-sky-400/60 disabled:opacity-50'
                        : 'border-slate-800/70 bg-slate-950/60 opacity-40'
                    }`}
                  >
                    {isBuildingThis && (
                      <div
                        className="absolute inset-x-0 bottom-0 bg-sky-400/25 transition-all"
                        style={{ height: `${Math.round(progress * 100)}%` }}
                      />
                    )}
                    <div className="relative z-10 flex flex-col justify-between h-full gap-1">
                      <div className="flex items-center gap-1.5">
                        <UnitIcon defId={id} kind="building" faction={player.faction} />
                        <span className="text-xs font-semibold text-slate-100 leading-tight">
                          {def.shortName}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs font-mono text-cyan-300">
                        <span>{def.cost}</span>
                        <span className={def.powerDelta >= 0 ? 'text-emerald-400' : 'text-amber-400'}>
                          {def.powerDelta >= 0 ? `+${def.powerDelta}` : def.powerDelta}MW
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {tab === 'units' && (
            <div className="grid grid-cols-2 gap-1.5">
              {units.map((id: UnitId) => {
                const def = UNIT_DEFS[id];
                const reqMet = ownedBuildings.has(def.producedBy);
                const queueCount = player.unitQueue.filter((q) => q.defId === id).length;
                const activeItem = player.unitQueue[0]?.defId === id ? player.unitQueue[0] : null;
                const progress = activeItem ? activeItem.progress / activeItem.totalTime : 0;
                const effectiveCost = player.chokepointTimer > 0 ? def.cost * 2 : def.cost;

                return (
                  <button
                    key={id}
                    type="button"
                    data-tour={
                      id === 'forward_controller' || id === 'shock_trooper' || id === 'teleop_militia'
                        ? 'unit-train-first'
                        : undefined
                    }
                    title={def.description}
                    disabled={!reqMet || player.silicon < effectiveCost}
                    onClick={() => onDispatch({ type: 'queueUnit', playerId: 'p1', defId: id })}
                    className={`relative overflow-hidden rounded border p-2 text-left transition min-h-[62px] ${
                      reqMet
                        ? 'border-slate-700/80 bg-slate-900/90 hover:border-sky-400/60 disabled:opacity-50'
                        : 'border-slate-800/70 bg-slate-950/60 opacity-40'
                    }`}
                  >
                    {activeItem && (
                      <div
                        className="absolute inset-x-0 bottom-0 bg-emerald-400/25 transition-all"
                        style={{ height: `${Math.round(progress * 100)}%` }}
                      />
                    )}
                    <div className="relative z-10 flex flex-col justify-between h-full gap-1">
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <UnitIcon defId={id} kind="unit" faction={player.faction} />
                          <span className="text-xs font-semibold text-slate-100 leading-tight truncate">
                            {def.shortName}
                          </span>
                        </div>
                        {queueCount > 0 && (
                          <span className="rounded bg-sky-500 px-1 text-xs font-bold text-slate-950 shrink-0">
                            {queueCount}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-xs font-mono text-cyan-300">
                        <span className={player.chokepointTimer > 0 ? 'text-rose-400 font-bold' : ''}>
                          {effectiveCost}
                        </span>
                        <span className="text-slate-400">
                          {def.flopsCost > 0 ? `${def.flopsCost}F` : 'HUM'}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {tab === 'cyber' && (
            <div className="space-y-2.5 text-xs">
              {/* Quantum Cryo-Core / Q-Day Decryption */}
              <div className="rounded border border-slate-800 bg-slate-900/80 p-2 space-y-1.5">
                <div className="flex items-center justify-between font-mono">
                  <span className="text-slate-300 font-semibold">Q-DAY CRACK</span>
                  <span className={player.qDayActive ? 'text-emerald-400 font-bold' : 'text-sky-400'}>
                    {Math.floor(player.qDayProgress)}%
                  </span>
                </div>
                <div className="h-1.5 w-full rounded bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      player.qDayActive ? 'bg-emerald-400' : 'bg-sky-400'
                    }`}
                    style={{ width: `${Math.round(player.qDayProgress)}%` }}
                  />
                </div>
                {!hasCryoCore ? (
                  <p className="text-slate-400">Build a Quantum Cryo-Core to unlock Cyber Warfare &amp; Q-Day.</p>
                ) : player.qDayActive && enemy ? (
                  <div className="rounded bg-slate-950/90 border border-emerald-500/40 p-1.5 font-mono text-emerald-200 space-y-0.5">
                    <div>ENEMY TELEMETRY LIVE:</div>
                    <div>
                      Bld:{' '}
                      {enemy.buildingQueue
                        ? BUILDING_DEFS[enemy.buildingQueue.defId as BuildingId].shortName
                        : 'Idle'}
                    </div>
                    <div>
                      Unit:{' '}
                      {enemy.unitQueue[0]
                        ? UNIT_DEFS[enemy.unitQueue[0].defId as UnitId].shortName
                        : 'Idle'}
                    </div>
                  </div>
                ) : (
                  <p className="text-slate-400">Decrypting enemy classical keys...</p>
                )}
              </div>

              {/* Cyber Powers */}
              <div className="space-y-1.5">
                {CYBER_POWER_LIST.map((pid: CyberPowerId) => {
                  const def = CYBER_POWERS[pid];
                  const cd = player.cyberCooldowns[pid];
                  const locked = !hasCryoCore || (def.requiresQDay && !player.qDayActive);
                  const isArmed = armedTargeting?.kind === 'cyber' && armedTargeting.powerId === pid;
                  return (
                    <button
                      key={pid}
                      type="button"
                      disabled={locked || cd > 0}
                      title={def.description}
                      onClick={() => {
                        if (!def.needsTargetLocation) {
                          onDispatch({ type: 'useCyberPower', playerId: 'p1', powerId: pid, x: 0, y: 0 });
                        } else {
                          onArmTargeting(isArmed ? null : { kind: 'cyber', powerId: pid });
                        }
                      }}
                      className={`w-full rounded border px-2.5 py-2 text-left transition ${
                        isArmed
                          ? 'border-purple-400 bg-purple-600/70 text-white'
                          : locked || cd > 0
                          ? 'border-slate-800 bg-slate-950/60 text-slate-500 opacity-60'
                          : 'border-purple-500/40 bg-slate-900 text-slate-100 hover:border-purple-400'
                      }`}
                    >
                      <div className="flex items-center justify-between font-semibold">
                        <span className="flex items-center gap-1.5">
                          {def.requiresQDay ? (
                            <Radio className="h-3.5 w-3.5 text-emerald-400" />
                          ) : (
                            <LockKeyhole className="h-3.5 w-3.5 text-purple-400" />
                          )}
                          {def.shortName}
                        </span>
                        <span className="font-mono">
                          {cd > 0 ? `${Math.ceil(cd)}s` : def.requiresQDay && !player.qDayActive ? 'Q-DAY' : 'READY'}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Superweapon Control */}
              <div className="rounded border border-rose-500/35 bg-slate-900/90 p-2 space-y-1.5">
                <div className="flex items-center justify-between font-mono">
                  <span className="text-rose-300 font-bold flex items-center gap-1">
                    <ShieldAlert className="h-3.5 w-3.5" />
                    {BUILDING_DEFS[swId].shortName}
                  </span>
                  <span className="text-slate-200">{Math.floor(player.superweaponCharge)}%</span>
                </div>
                <div className="h-1.5 w-full rounded bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-rose-500 transition-all"
                    style={{ width: `${Math.round(player.superweaponCharge)}%` }}
                  />
                </div>
                <button
                  type="button"
                  disabled={!hasSuperweapon || player.superweaponCharge < 100}
                  onClick={() => {
                    if (player.faction === 'alliance') {
                      onArmTargeting(
                        armedTargeting?.kind === 'superweapon' ? null : { kind: 'superweapon' }
                      );
                    } else {
                      onDispatch({ type: 'fireSuperweapon', playerId: 'p1', x: 0, y: 0 });
                    }
                  }}
                  className="w-full rounded bg-rose-600 py-1.5 font-bold text-white hover:bg-rose-500 disabled:opacity-40"
                >
                  {!hasSuperweapon
                    ? `Build ${BUILDING_DEFS[swId].shortName}`
                    : player.superweaponCharge < 100
                    ? 'CHARGING...'
                    : player.faction === 'alliance'
                    ? 'TARGET ORBITAL BEAM'
                    : 'DETONATE SUPERWEAPON'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Cyber Overclock & Tactical Unit Actions */}
        <div className="p-2.5 border-t border-slate-800 space-y-2 bg-slate-950/90">
          <div>
            <div className="flex items-center justify-between text-xs font-mono mb-1">
              <span className="text-slate-400">SERVER THERMAL</span>
              <span className={player.thermalLoad > 75 ? 'text-orange-400 font-bold' : 'text-slate-300'}>
                {Math.round(player.thermalLoad)}%
              </span>
            </div>
            <div className="h-1.5 w-full rounded bg-slate-800 overflow-hidden mb-2">
              <div
                className={`h-full transition-all ${
                  player.thermalLoad > 75 ? 'bg-orange-500' : 'bg-cyan-400'
                }`}
                style={{ width: `${Math.round(player.thermalLoad)}%` }}
              />
            </div>
            <button
              type="button"
              data-tour="overclock-btn"
              onClick={() => onDispatch({ type: 'toggleOverclock', playerId: 'p1' })}
              className={`w-full flex items-center justify-center gap-1.5 rounded border py-2 text-xs font-bold transition ${
                player.overclock
                  ? 'border-orange-400 bg-orange-600/80 text-white'
                  : 'border-sky-500/40 bg-slate-900 text-sky-200 hover:bg-slate-800'
              }`}
            >
              <Flame className="h-3.5 w-3.5" />
              {player.overclock ? 'OVERCLOCK ON (150%)' : 'OVERCLOCK 150%'}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-1.5 text-xs">
            <button
              type="button"
              onClick={onToggleAttackMove}
              className={`flex items-center justify-center gap-1 rounded border py-1.5 font-medium ${
                attackMoveArmed
                  ? 'border-rose-400 bg-rose-600/80 text-white'
                  : 'border-slate-700 bg-slate-900 text-slate-200'
              }`}
            >
              <Crosshair className="h-3.5 w-3.5" />
              Attack-Move
            </button>

            <button
              type="button"
              onClick={onToggleBoxSelectMode}
              className={`flex items-center justify-center gap-1 rounded border py-1.5 font-medium ${
                boxSelectMode
                  ? 'border-sky-400 bg-sky-500 text-slate-950 font-bold'
                  : 'border-slate-700 bg-slate-900 text-slate-200'
              }`}
            >
              <SquareDashedMousePointer className="h-3.5 w-3.5" />
              Box Select
            </button>

            {selectedEntities.length > 0 && (
              <div className="col-span-2 rounded border border-slate-700/80 bg-slate-900/90 px-2.5 py-2 space-y-1.5">
                {singleSelected ? (
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-100 truncate">{singleLabel}</div>
                      <div className="font-mono text-[11px] text-slate-300 tabular-nums">
                        HP {Math.ceil(singleSelected.hp)}/{singleSelected.maxHp} · Kills{' '}
                        {singleSelected.kills}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-0.5 shrink-0">
                      <span
                        className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[10px] font-bold ${
                          singleSelected.veterancy === 3
                            ? 'bg-amber-400/20 text-amber-200 border border-amber-400/50'
                            : singleSelected.veterancy > 0
                            ? 'bg-yellow-500/15 text-yellow-300'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {singleSelected.veterancy > 0 && <Star className="h-2.5 w-2.5 fill-current" />}
                        {singleSelected.veterancy > 0 ? `${'★'.repeat(singleSelected.veterancy)} ` : ''}
                        {getVeterancyLabel(singleSelected.veterancy)}
                      </span>
                      {singleSelected.repairing && (
                        <span className="font-mono text-[10px] font-bold text-emerald-300">
                          + REPAIRING
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-slate-200 font-semibold">
                      {selectedEntities.length} Selected ({damagedSelected.length} damaged)
                    </span>
                    {highestRank > 0 && (
                      <span className="text-amber-300 font-bold">
                        Top: {'★'.repeat(highestRank)} {getVeterancyLabel(highestRank)}
                      </span>
                    )}
                  </div>
                )}

                {damagedSelected.length > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      onDispatch({
                        type: 'toggleRepair',
                        playerId: 'p1',
                        entityIds: damagedSelected.map((e) => e.id),
                      })
                    }
                    className={`w-full flex items-center justify-center gap-1.5 rounded border py-1.5 font-bold transition ${
                      anyManualRepairing
                        ? 'border-emerald-300 bg-emerald-500 text-slate-950'
                        : 'border-emerald-400/65 bg-emerald-950/75 text-emerald-200 hover:bg-emerald-900/75'
                    }`}
                  >
                    <Wrench className="h-3.5 w-3.5" />
                    <span>{anyManualRepairing ? 'Repairing... (R to Stop)' : 'Repair Selected (R)'}</span>
                  </button>
                )}

                {singleSellableBuilding && (
                  <button
                    type="button"
                    onClick={() =>
                      onDispatch({
                        type: 'sellBuilding',
                        playerId: 'p1',
                        buildingId: singleSellableBuilding.id,
                      })
                    }
                    className="w-full flex items-center justify-center gap-1 rounded border border-amber-500/45 bg-amber-950/50 py-1 font-semibold text-amber-200 hover:bg-amber-900/60 transition"
                  >
                    <DollarSign className="h-3 w-3" />
                    <span>
                      Sell Structure (+
                      {Math.round(BUILDING_DEFS[singleSellableBuilding.defId as BuildingId].cost * 0.5)} Si)
                    </span>
                  </button>
                )}
              </div>
            )}

            {hasSelectedMcv && (
              <button
                type="button"
                onClick={() =>
                  onDispatch({ type: 'deployMcv', playerId: 'p1', unitId: hasSelectedMcv.id })
                }
                className="col-span-2 flex items-center justify-center gap-1 rounded border border-emerald-400 bg-emerald-600/80 py-1.5 font-bold text-white"
              >
                <Layers className="h-3.5 w-3.5" />
                Deploy MCV into ConYard
              </button>
            )}

            {hasSmokeCarrier && (
              <button
                type="button"
                onClick={() =>
                  onDispatch({
                    type: 'deploySmoke',
                    playerId: 'p1',
                    unitIds: selectedEntities.map((e) => e.id),
                  })
                }
                className="col-span-2 flex items-center justify-center gap-1 rounded border border-cyan-400 bg-cyan-700/80 py-1.5 font-bold text-white"
              >
                <Wind className="h-3.5 w-3.5" />
                Deploy Aerosol Smoke (-80% Laser)
              </button>
            )}

            {hasTunnelCrawler && (
              <button
                type="button"
                onClick={() =>
                  onDispatch({
                    type: 'toggleBurrow',
                    playerId: 'p1',
                    unitIds: selectedEntities.map((e) => e.id),
                  })
                }
                className="col-span-2 flex items-center justify-center gap-1 rounded border border-amber-400 bg-amber-700/80 py-1.5 font-bold text-white"
              >
                <ArrowDownUp className="h-3.5 w-3.5" />
                Burrow / Surface Tunnel
              </button>
            )}

            {hasSwarmLauncher && (
              <button
                type="button"
                onClick={() =>
                  onDispatch({
                    type: 'launchSwarm',
                    playerId: 'p1',
                    unitIds: selectedEntities.map((e) => e.id),
                  })
                }
                className="col-span-2 flex items-center justify-center gap-1 rounded border border-yellow-400 bg-yellow-700/80 py-1.5 font-bold text-white"
              >
                <Rocket className="h-3.5 w-3.5" />
                Launch Hive-Mind Swarm
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
