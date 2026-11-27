import { BUILDING_DEFS, UNIT_DEFS, type BuildingId, type UnitId } from '../data/defs';
import type { Entity, GameState } from '../sim/types';

interface SquadBarProps {
  state: GameState;
  selectedIds: Set<string>;
  onSelectIds: (ids: string[]) => void;
}

export function SquadBar({ state, selectedIds, onSelectIds }: SquadBarProps) {
  const p1Units: Entity[] = [];
  for (const id of state.entityOrder) {
    const e = state.entities[id];
    if (e && e.kind === 'unit' && e.ownerId === 'p1') p1Units.push(e);
  }

  const combatUnits = p1Units.filter((u) => u.defId !== 'relay_crawler' && u.defId !== 'mcv');
  const armorUnits = combatUnits.filter((u) => UNIT_DEFS[u.defId as UnitId].tags.includes('ARMORED'));
  const lightUnits = combatUnits.filter((u) => UNIT_DEFS[u.defId as UnitId].tags.includes('LIGHT'));
  const crawlers = p1Units.filter((u) => u.defId === 'relay_crawler');

  const selectedList = Array.from(selectedIds)
    .map((id) => state.entities[id])
    .filter((e): e is Entity => Boolean(e));

  const primary = selectedList[0];

  return (
    <div className="pointer-events-none fixed left-2 bottom-2 z-10 flex flex-col gap-1.5 max-w-[calc(100dvw-16px)] md:max-w-[calc(100dvw-18rem)]">
      {/* Selected Unit / Building Inspector */}
      {primary && (
        <div className="pointer-events-auto rounded border border-sky-500/35 bg-slate-950/90 px-3 py-2 backdrop-blur-md text-xs shadow-lg max-w-sm">
          {selectedList.length === 1 ? (
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-3">
                <span className="font-bold text-slate-100">
                  {primary.kind === 'building'
                    ? BUILDING_DEFS[primary.defId as BuildingId].name
                    : UNIT_DEFS[primary.defId as UnitId].name}
                </span>
                <span className="font-mono text-emerald-300 tabular-nums">
                  {Math.ceil(primary.hp)}/{primary.maxHp} HP
                </span>
              </div>
              {primary.kind === 'unit' && (
                <div className="flex flex-wrap items-center gap-1">
                  {UNIT_DEFS[primary.defId as UnitId].tags.map((t) => (
                    <span
                      key={t}
                      className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-xs text-sky-300"
                    >
                      {t}
                    </span>
                  ))}
                  {primary.safeMode && (
                    <span className="rounded bg-amber-500 px-1.5 py-0.5 font-mono text-xs font-bold text-slate-950">
                      SAFE MODE
                    </span>
                  )}
                  {primary.humanOverride && (
                    <span className="rounded bg-emerald-600 px-1.5 py-0.5 font-mono text-xs font-bold text-white">
                      HUMAN OVERRIDE
                    </span>
                  )}
                  {primary.jammed && (
                    <span className="rounded bg-rose-600 px-1.5 py-0.5 font-mono text-xs font-bold text-white">
                      GPS JAMMED
                    </span>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3 font-mono">
              <span className="font-bold text-sky-300">{selectedList.length} UNITS SELECTED</span>
              <span className="text-slate-400">Right-click or tap target to order</span>
            </div>
          )}
        </div>
      )}

      {/* Quick Squad Filter Pills */}
      <div className="pointer-events-auto flex flex-wrap items-center gap-1.5 text-xs">
        <button
          type="button"
          data-tour="squad-combat"
          onClick={() => onSelectIds(combatUnits.map((u) => u.id))}
          disabled={combatUnits.length === 0}
          className="rounded border border-slate-700 bg-slate-950/90 px-2.5 py-1.5 font-medium text-slate-200 hover:border-sky-400 disabled:opacity-40"
        >
          All Combat ({combatUnits.length})
        </button>
        <button
          type="button"
          onClick={() => onSelectIds(armorUnits.map((u) => u.id))}
          disabled={armorUnits.length === 0}
          className="rounded border border-slate-700 bg-slate-950/90 px-2.5 py-1.5 font-medium text-slate-200 hover:border-sky-400 disabled:opacity-40"
        >
          Armor ({armorUnits.length})
        </button>
        <button
          type="button"
          onClick={() => onSelectIds(lightUnits.map((u) => u.id))}
          disabled={lightUnits.length === 0}
          className="rounded border border-slate-700 bg-slate-950/90 px-2.5 py-1.5 font-medium text-slate-200 hover:border-sky-400 disabled:opacity-40"
        >
          Infantry/Bots ({lightUnits.length})
        </button>
        <button
          type="button"
          onClick={() => onSelectIds(crawlers.map((u) => u.id))}
          disabled={crawlers.length === 0}
          className="rounded border border-slate-700 bg-slate-950/90 px-2.5 py-1.5 font-medium text-slate-200 hover:border-sky-400 disabled:opacity-40"
        >
          Crawlers ({crawlers.length})
        </button>
      </div>
    </div>
  );
}
