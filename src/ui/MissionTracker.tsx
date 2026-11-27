import { useState } from 'react';
import { getMissionById } from '../data/missions';
import type { GameState, OverlayMode } from '../sim/types';
import { CheckCircle2, ChevronDown, ChevronUp, Circle, ShieldCheck, Star } from 'lucide-react';

interface MissionTrackerProps {
  state: GameState;
  emVisited: boolean;
  overlayMode: OverlayMode;
}

export function MissionTracker({ state, emVisited, overlayMode }: MissionTrackerProps) {
  const [collapsed, setCollapsed] = useState(false);
  const mission = getMissionById(state.missionId);
  if (!mission) return null;

  const bonusDone = mission.bonusObjective.check(state, { emVisited, overlayMode });
  const graceSecondsLeft = Math.max(0, Math.ceil(state.players.ai1.aiWaveTimer));
  const inEarlyBuildUp = state.elapsedSeconds < 240 && graceSecondsLeft > 0;

  return (
    <div className="pointer-events-auto fixed right-2 md:right-68 top-14 z-10 w-64 sm:w-72 rounded border border-amber-500/45 bg-slate-950/90 backdrop-blur-md text-xs shadow-lg">
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
        <div className="p-2.5 space-y-2">
          {inEarlyBuildUp && (
            <div className="flex items-center justify-between rounded border border-emerald-400/35 bg-emerald-950/50 px-2 py-1 text-[11px] font-mono text-emerald-200">
              <span className="flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                Build-Up Window
              </span>
              <span className="tabular-nums font-bold">
                {Math.floor(graceSecondsLeft / 60)}:
                {String(graceSecondsLeft % 60).padStart(2, '0')}
              </span>
            </div>
          )}

          <ul className="space-y-1.5">
            {mission.objectiveDefs.map((obj, idx) => {
              const done = obj.check(state, { emVisited, overlayMode });
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
                  <span>{obj.label}</span>
                </li>
              );
            })}
          </ul>

          <div
            className={`pt-1.5 border-t border-slate-800 flex items-start gap-1.5 ${
              bonusDone ? 'text-amber-300' : 'text-slate-300'
            }`}
          >
            <Star
              className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${
                bonusDone ? 'text-amber-300 fill-amber-300' : 'text-amber-400'
              }`}
            />
            <span className={bonusDone ? 'line-through opacity-85' : ''}>
              {mission.bonusObjective.label}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
