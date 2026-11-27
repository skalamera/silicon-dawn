import { useEffect, useState } from 'react';
import type { GameState, OverlayMode } from '../sim/types';
import { CheckCircle2, Play, Sparkles, X } from 'lucide-react';

const TOUR_STORAGE_KEY = 'silicon-dawn-walkthrough-v1';

export interface WalkthroughStepDef {
  id: string;
  title: string;
  instruction: string;
  tourTarget: string;
  forceTab?: 'structures' | 'units' | 'cyber';
  forceMobileDrawer?: boolean;
}

export const WALKTHROUGH_STEPS: WalkthroughStepDef[] = [
  {
    id: 'select_squad',
    title: '1/7 · Select Your Strike Squad',
    instruction: 'Click "All Combat" in the bottom-left bar (or drag a box around your starter units).',
    tourTarget: 'squad-combat',
  },
  {
    id: 'move_squad',
    title: '2/7 · Issue a Move Order',
    instruction: 'Right-click (or tap on touch) an open area on the battlefield to advance your squad.',
    tourTarget: 'battlefield-canvas',
  },
  {
    id: 'em_overlay',
    title: '3/7 · Scan the EM Spectrum',
    instruction: 'Click the "EM" button (or press Tab) to inspect GPS-denied jamming domes & fiber links.',
    tourTarget: 'overlay-em',
  },
  {
    id: 'build_foundry',
    title: '4/7 · Construct a Tactical Foundry',
    instruction: 'Click "Foundry" in the Build sidebar to construct your infantry & android facility.',
    tourTarget: 'build-barracks',
    forceTab: 'structures',
    forceMobileDrawer: true,
  },
  {
    id: 'deploy_foundry',
    title: '5/7 · Deploy Foundry on Base Pad',
    instruction: 'Once construction hits 100%, click inside your illuminated base perimeter on the map to place it.',
    tourTarget: 'battlefield-canvas',
  },
  {
    id: 'train_unit',
    title: '6/7 · Train Reinforcements',
    instruction: 'Click "Units" and train a Forward Controller or Valkyrie android.',
    tourTarget: 'unit-train-first',
    forceTab: 'units',
    forceMobileDrawer: true,
  },
  {
    id: 'overclock',
    title: '7/7 · Engage Overclock 150%',
    instruction: 'Click "OVERCLOCK 150%" to boost production & robot fire rate (watch the thermal meter!).',
    tourTarget: 'overclock-btn',
    forceMobileDrawer: true,
  },
];

export function hasCompletedWalkthrough(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return localStorage.getItem(TOUR_STORAGE_KEY) === 'done';
  } catch {
    return false;
  }
}

export function markWalkthroughDone(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(TOUR_STORAGE_KEY, 'done');
  } catch {
    // Ignore
  }
}

interface WalkthroughOverlayProps {
  active: boolean;
  step: number;
  state: GameState;
  selectedIds: Set<string>;
  overlayMode: OverlayMode;
  lastOrderTick: number;
  onSetStep: (next: number) => void;
  onClose: () => void;
  onLaunchDemo: () => void;
  onOpenCampaign: () => void;
}

export function WalkthroughOverlay({
  active,
  step,
  state,
  selectedIds,
  overlayMode,
  lastOrderTick,
  onSetStep,
  onClose,
  onLaunchDemo,
  onOpenCampaign,
}: WalkthroughOverlayProps) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [unitsTabOpened, setUnitsTabOpened] = useState(false);

  const player = state.players.p1;
  const hasBarracks = state.entityOrder.some((id) => {
    const e = state.entities[id];
    return e && e.kind === 'building' && e.ownerId === 'p1' && e.defId === 'barracks';
  });

  // Auto-advance ONLY when the user completes each required action
  useEffect(() => {
    if (!active) return;

    if (step === 0 && selectedIds.size > 0) {
      onSetStep(1);
    } else if (step === 1 && lastOrderTick > 0) {
      onSetStep(2);
    } else if (step === 2 && overlayMode === 'em') {
      onSetStep(3);
    } else if (
      step === 3 &&
      (player.buildingQueue?.defId === 'barracks' ||
        player.readyBuildingDefId === 'barracks' ||
        hasBarracks)
    ) {
      onSetStep(4);
    } else if (step === 4 && hasBarracks) {
      onSetStep(5);
    } else if (step === 5 && player.unitQueue.length > 0) {
      onSetStep(6);
    } else if (step === 6 && player.overclock) {
      markWalkthroughDone();
      onSetStep(7);
    }
  }, [
    active,
    step,
    selectedIds,
    lastOrderTick,
    overlayMode,
    player.buildingQueue,
    player.readyBuildingDefId,
    player.unitQueue.length,
    player.overclock,
    hasBarracks,
    onSetStep,
  ]);

  // Track highlighted element bounding rect dynamically
  useEffect(() => {
    if (!active || step >= WALKTHROUGH_STEPS.length) {
      setRect(null);
      return;
    }

    const def = WALKTHROUGH_STEPS[step];
    const queryTarget = () => {
      let targetKey = def.tourTarget;
      if (step === 5 && !unitsTabOpened) {
        const unitBtn = document.querySelector('[data-tour="unit-train-first"]');
        if (!unitBtn) targetKey = 'tab-units';
      }
      const el = document.querySelector(`[data-tour="${targetKey}"]`);
      if (el) {
        setRect(el.getBoundingClientRect());
      } else {
        setRect(null);
      }
    };

    queryTarget();
    const id = window.setInterval(queryTarget, 160);
    window.addEventListener('resize', queryTarget);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('resize', queryTarget);
    };
  }, [active, step, unitsTabOpened]);

  if (!active) return null;

  // Completion Celebration Card (Step 7)
  if (step >= WALKTHROUGH_STEPS.length) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/65 backdrop-blur-sm p-4">
        <div className="w-full max-w-md rounded-lg border border-emerald-400/60 bg-slate-950 p-5 shadow-2xl space-y-4 text-xs">
          <div className="flex items-center gap-2 text-emerald-300 font-bold text-base">
            <CheckCircle2 className="h-5 w-5" />
            <span>Walkthrough Complete — You Are In Command</span>
          </div>
          <p className="text-slate-300 leading-relaxed">
            You&apos;ve mastered squad movement, EM Spectrum scanning, base deployment, unit training,
            and Overclocking. Next, try the live Feature Showcase Demo or launch the Campaign with
            FMV briefings!
          </p>
          <div className="flex flex-wrap justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={() => {
                markWalkthroughDone();
                onClose();
              }}
              className="rounded border border-slate-700 px-3 py-2 text-slate-200 hover:bg-slate-800"
            >
              Keep Playing
            </button>
            <button
              type="button"
              onClick={() => {
                markWalkthroughDone();
                onClose();
                onLaunchDemo();
              }}
              className="flex items-center gap-1 rounded border border-cyan-400/60 bg-cyan-950/70 px-3 py-2 font-bold text-cyan-200 hover:bg-cyan-900"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Watch Demo
            </button>
            <button
              type="button"
              onClick={() => {
                markWalkthroughDone();
                onClose();
                onOpenCampaign();
              }}
              className="flex items-center gap-1 rounded bg-amber-400 px-3.5 py-2 font-bold text-slate-950 hover:bg-amber-300"
            >
              <Play className="h-3.5 w-3.5" />
              Campaign
            </button>
          </div>
        </div>
      </div>
    );
  }

  const current = WALKTHROUGH_STEPS[step];
  const buildingPct =
    step === 4 && player.buildingQueue?.defId === 'barracks'
      ? Math.round((player.buildingQueue.progress / player.buildingQueue.totalTime) * 100)
      : null;

  // Smart card placement so it avoids covering the highlighted area
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1024;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 768;
  const isCanvasTarget = current.tourTarget === 'battlefield-canvas';

  let cardStyle: React.CSSProperties = { left: '50%', top: 76, transform: 'translateX(-50%)' };
  if (rect && !isCanvasTarget) {
    const placeLeft = rect.left > vw * 0.55;
    const placeBelow = rect.bottom < vh * 0.65;
    if (placeLeft) {
      cardStyle = {
        right: Math.max(16, vw - rect.left + 16),
        top: Math.max(64, Math.min(vh - 170, rect.top)),
      };
    } else if (placeBelow) {
      cardStyle = {
        left: Math.max(16, Math.min(vw - 320, rect.left)),
        top: Math.min(vh - 160, rect.bottom + 14),
      };
    } else {
      cardStyle = {
        left: Math.max(16, Math.min(vw - 320, rect.left)),
        bottom: Math.max(16, vh - rect.top + 14),
      };
    }
  }

  return (
    <>
      {/* Non-blocking glowing spotlight frame over target control */}
      {rect && !isCanvasTarget && (
        <div
          className="pointer-events-none fixed z-40 rounded-md border-2 border-cyan-400 shadow-[0_0_0_9999px_rgba(3,7,14,0.45),0_0_22px_rgba(34,211,238,0.9)] animate-pulse transition-all duration-150"
          style={{
            left: rect.left - 4,
            top: rect.top - 4,
            width: rect.width + 8,
            height: rect.height + 8,
          }}
        />
      )}

      {isCanvasTarget && rect && (
        <div
          className="pointer-events-none fixed z-30 rounded border-2 border-dashed border-cyan-400/80 animate-pulse"
          style={{
            left: rect.left + 12,
            top: rect.top + 12,
            width: Math.max(80, rect.width - 24),
            height: Math.max(80, rect.height - 24),
          }}
        />
      )}

      {/* Instructor Prompt Card */}
      <div
        className="pointer-events-auto fixed z-50 w-[min(90dvw,19.5rem)] rounded-lg border border-cyan-400/75 bg-slate-950/95 p-3.5 shadow-2xl backdrop-blur-md text-xs space-y-2"
        style={cardStyle}
        onClick={() => {
          if (step === 5) setUnitsTabOpened(true);
        }}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono font-bold text-cyan-300">{current.title}</span>
          <button
            type="button"
            onClick={() => {
              markWalkthroughDone();
              onClose();
            }}
            aria-label="Skip walkthrough"
            className="rounded border border-slate-700 p-1 text-slate-400 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <p className="text-slate-200 leading-relaxed">{current.instruction}</p>

        {buildingPct !== null && (
          <div className="space-y-1">
            <div className="flex justify-between font-mono text-cyan-300">
              <span>Building Foundry...</span>
              <span>{buildingPct}%</span>
            </div>
            <div className="h-1.5 w-full rounded bg-slate-800 overflow-hidden">
              <div className="h-full bg-cyan-400" style={{ width: `${buildingPct}%` }} />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-1 border-t border-slate-800 text-slate-400">
          <span>Waiting for action...</span>
          <button
            type="button"
            onClick={() => {
              markWalkthroughDone();
              onClose();
            }}
            className="text-slate-300 hover:text-white underline"
          >
            Skip Tour
          </button>
        </div>
      </div>
    </>
  );
}
