import { useState } from 'react';
import { getMissionById } from '../data/missions';
import type { GameState, OverlayMode } from '../sim/types';
import { CheckCircle2, ChevronDown, ChevronUp, Circle } from 'lucide-react';

interface MissionTrackerProps {
  state: GameState;
  emVisited: boolean;
  overlayMode: OverlayMode;
}

export function MissionTracker({ state, emVisited, overlayMode }: MissionTrackerProps) {
  const [collapsed, setCollapsed] = useState(false);
  const mission = getMissionById(state.missionId);
  if (!mission) return null;

  // Live objective evaluation for Boot Sequence Tutorial & Flashpoints
  const p1Entities = state.entityOrder
    .map((id) => state.entities[id])
    .filter((e) => e && e.ownerId === 'p1');

  const evaluateObjective = (idx: number): boolean => {
    if (mission.isTutorial) {
      if (idx === 0) {
        return p1Entities.some((e) => e.defId === 'barracks' || e.defId === 'war_factory');
      }
      if (idx === 1) {
        return emVisited || overlayMode === 'em';
      }
      if (idx === 2) {
        return (
          p1Entities.some((e) => e.defId === 'lng_terminal' || e.defId === 'fiber_station') ||
          p1Entities.filter((e) => e.kind === 'unit').length >= 5
        );
      }
      if (idx === 3) {
        return state.winnerId === 'p1';
      }
    }
    return state.winnerId === 'p1';
  };

  return (
    <div className="pointer-events-auto fixed right-2 md:right-68 top-14 z-10 w-60 sm:w-68 rounded border border-amber-500/45 bg-slate-950/90 backdrop-blur-md text-xs shadow-lg">
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className="w-full flex items-center justify-between px-2.5 py-1.5 border-b border-slate-800 font-mono text-amber-300 font-bold"
      >
        <span className="truncate">
          {mission.codeName}: {mission.title}
        </span>
        {collapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
      </button>

      {!collapsed && (
        <ul className="p-2.5 space-y-1.5">
          {mission.objectives.map((obj, idx) => {
            const done = evaluateObjective(idx);
            return (
              <li
                key={idx}
                className={`flex items-start gap-1.5 ${
                  done ? 'text-emerald-300 line-through opacity-80' : 'text-slate-200'
                }`}
              >
                {done ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <Circle className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
                )}
                <span>{obj}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
