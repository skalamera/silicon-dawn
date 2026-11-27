import { UNIT_DEFS, type UnitId } from '../data/defs';
import type { Entity, GameState, SimCommand } from '../sim/types';
import { ArrowDownUp, Crosshair, Layers, Navigation, OctagonX, Rocket, Wind, X } from 'lucide-react';

export interface RadialMenuTarget {
  sx: number;
  sy: number;
  wx: number;
  wy: number;
}

interface RadialMenuProps {
  target: RadialMenuTarget | null;
  state: GameState;
  selectedIds: Set<string>;
  onDispatch: (cmd: SimCommand) => void;
  onClose: () => void;
}

export function RadialMenu({
  target,
  state,
  selectedIds,
  onDispatch,
  onClose,
}: RadialMenuProps) {
  if (!target) return null;

  const unitIds = Array.from(selectedIds).filter((id) => {
    const e = state.entities[id];
    return e && e.kind === 'unit' && e.ownerId === 'p1';
  });
  if (unitIds.length === 0) return null;

  const selectedUnits: Entity[] = unitIds.map((id) => state.entities[id]);
  const mcv = selectedUnits.find((u) => u.defId === 'mcv');
  const hasSmoke = selectedUnits.some((u) => UNIT_DEFS[u.defId as UnitId].canDeploySmoke);
  const hasBurrow = selectedUnits.some((u) => UNIT_DEFS[u.defId as UnitId].canBurrow);
  const hasSwarm = selectedUnits.some((u) => UNIT_DEFS[u.defId as UnitId].canLaunchSwarm);

  const vw = typeof window !== 'undefined' ? window.innerWidth : 800;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 600;
  const cx = Math.max(92, Math.min(vw - 92, target.sx));
  const cy = Math.max(92, Math.min(vh - 92, target.sy));

  return (
    <div
      className="fixed inset-0 z-40"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="fixed -translate-x-1/2 -translate-y-1/2 w-48 h-48 pointer-events-none"
        style={{ left: cx, top: cy }}
      >
        {/* Center Cancel */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close radial command menu"
          className="pointer-events-auto absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-11 w-11 rounded-full border border-slate-600 bg-slate-950/95 text-slate-300 flex items-center justify-center shadow-lg"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Top: Move */}
        <button
          type="button"
          onClick={() => {
            onDispatch({ type: 'moveUnits', playerId: 'p1', unitIds, x: target.wx, y: target.wy });
            onClose();
          }}
          className="pointer-events-auto absolute left-1/2 top-0 -translate-x-1/2 h-11 min-w-[76px] rounded-full border border-sky-400/70 bg-slate-950/95 px-3 text-xs font-bold text-sky-200 flex items-center justify-center gap-1 shadow-lg"
        >
          <Navigation className="h-3.5 w-3.5" />
          Move
        </button>

        {/* Right: Attack-Move */}
        <button
          type="button"
          onClick={() => {
            onDispatch({
              type: 'moveUnits',
              playerId: 'p1',
              unitIds,
              x: target.wx,
              y: target.wy,
              attackMove: true,
            });
            onClose();
          }}
          className="pointer-events-auto absolute right-0 top-1/2 -translate-y-1/2 h-11 min-w-[76px] rounded-full border border-rose-400/70 bg-slate-950/95 px-2.5 text-xs font-bold text-rose-200 flex items-center justify-center gap-1 shadow-lg"
        >
          <Crosshair className="h-3.5 w-3.5" />
          Attack
        </button>

        {/* Left: Stop */}
        <button
          type="button"
          onClick={() => {
            onDispatch({ type: 'stopUnits', playerId: 'p1', unitIds });
            onClose();
          }}
          className="pointer-events-auto absolute left-0 top-1/2 -translate-y-1/2 h-11 min-w-[72px] rounded-full border border-amber-400/70 bg-slate-950/95 px-3 text-xs font-bold text-amber-200 flex items-center justify-center gap-1 shadow-lg"
        >
          <OctagonX className="h-3.5 w-3.5" />
          Stop
        </button>

        {/* Bottom: Context Special Ability (or Attack-Move fallback) */}
        {mcv && (
          <button
            type="button"
            onClick={() => {
              onDispatch({ type: 'deployMcv', playerId: 'p1', unitId: mcv.id });
              onClose();
            }}
            className="pointer-events-auto absolute left-1/2 bottom-0 -translate-x-1/2 h-11 min-w-[88px] rounded-full border border-emerald-400/80 bg-emerald-950/95 px-3 text-xs font-bold text-emerald-200 flex items-center justify-center gap-1 shadow-lg"
          >
            <Layers className="h-3.5 w-3.5" />
            Deploy
          </button>
        )}
        {!mcv && hasSmoke && (
          <button
            type="button"
            onClick={() => {
              onDispatch({ type: 'deploySmoke', playerId: 'p1', unitIds });
              onClose();
            }}
            className="pointer-events-auto absolute left-1/2 bottom-0 -translate-x-1/2 h-11 min-w-[88px] rounded-full border border-cyan-400/80 bg-cyan-950/95 px-3 text-xs font-bold text-cyan-200 flex items-center justify-center gap-1 shadow-lg"
          >
            <Wind className="h-3.5 w-3.5" />
            Smoke
          </button>
        )}
        {!mcv && !hasSmoke && hasBurrow && (
          <button
            type="button"
            onClick={() => {
              onDispatch({ type: 'toggleBurrow', playerId: 'p1', unitIds });
              onClose();
            }}
            className="pointer-events-auto absolute left-1/2 bottom-0 -translate-x-1/2 h-11 min-w-[88px] rounded-full border border-amber-400/80 bg-amber-950/95 px-3 text-xs font-bold text-amber-200 flex items-center justify-center gap-1 shadow-lg"
          >
            <ArrowDownUp className="h-3.5 w-3.5" />
            Burrow
          </button>
        )}
        {!mcv && !hasSmoke && !hasBurrow && hasSwarm && (
          <button
            type="button"
            onClick={() => {
              onDispatch({ type: 'launchSwarm', playerId: 'p1', unitIds, x: target.wx, y: target.wy });
              onClose();
            }}
            className="pointer-events-auto absolute left-1/2 bottom-0 -translate-x-1/2 h-11 min-w-[88px] rounded-full border border-yellow-400/80 bg-yellow-950/95 px-3 text-xs font-bold text-yellow-200 flex items-center justify-center gap-1 shadow-lg"
          >
            <Rocket className="h-3.5 w-3.5" />
            Swarm
          </button>
        )}
      </div>
    </div>
  );
}
