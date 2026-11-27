import { useState } from 'react';
import {
  Crosshair,
  FolderOpen,
  GraduationCap,
  Pause,
  Play,
  Sliders,
  Sparkles,
  Swords,
} from 'lucide-react';
import { HomeBackdrop } from './HomeBackdrop';

interface HomeScreenProps {
  hasActiveSession: boolean;
  completedMissionCount: number;
  totalMissionCount: number;
  saveSlotCount: number;
  walkthroughCompleted: boolean;
  heroImageSrc?: string;
  onResume: () => void;
  onOpenCampaign: () => void;
  onOpenSkirmish: () => void;
  onStartTutorial: () => void;
  onStartDemo: () => void;
  onOpenSaves: () => void;
  onOpenSettings: () => void;
}

export function HomeScreen({
  hasActiveSession,
  completedMissionCount,
  totalMissionCount,
  saveSlotCount,
  walkthroughCompleted,
  heroImageSrc,
  onResume,
  onOpenCampaign,
  onOpenSkirmish,
  onStartTutorial,
  onStartDemo,
  onOpenSaves,
  onOpenSettings,
}: HomeScreenProps) {
  const [motionPaused, setMotionPaused] = useState(false);

  return (
    <div className="fixed inset-0 z-40 h-dvh w-dvw overflow-y-auto tactical-scroll">
      <HomeBackdrop motionPaused={motionPaused} heroImageSrc={heroImageSrc} />

      <div className="relative z-10 mx-auto flex min-h-full max-w-5xl flex-col justify-between px-4 py-5 sm:px-8 sm:py-8">
        {/* Top Command Status Bar */}
        <header className="safe-top flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
          <div className="flex items-center gap-2 rounded border border-emerald-400/25 bg-[#09110b]/75 px-3 py-1.5 backdrop-blur-md">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#4ade80]" />
            <span className="tracking-wider text-emerald-100/90">
              AUTOWARCOM // THEATER COMMAND LINK
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="rounded border border-slate-600/40 bg-[#09110b]/75 px-3 py-1.5 text-slate-200 backdrop-blur-md">
              CAMPAIGN:{' '}
              <span className="font-bold text-emerald-300">
                {completedMissionCount}/{totalMissionCount}
              </span>{' '}
              OPS CLEARED
            </div>
            <button
              type="button"
              onClick={() => setMotionPaused((v) => !v)}
              className="flex items-center gap-1.5 rounded border border-slate-600/50 bg-[#09110b]/80 px-2.5 py-1.5 text-slate-200 backdrop-blur-md hover:border-emerald-400/60 hover:text-emerald-200 transition"
              title="Toggle background atmospheric motion"
            >
              {motionPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
              <span>{motionPaused ? 'Play FX' : 'Pause FX'}</span>
            </button>
          </div>
        </header>

        {/* Main Hero Lockup + Mode Selection */}
        <main className="my-auto py-8 sm:py-10 space-y-7 max-w-2xl">
          <div className="space-y-2.5">
            <div className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.26em] text-emerald-300/85">
              <span className="h-px w-6 bg-emerald-400/60" />
              <span>2032 Autonomous Warfare RTS</span>
            </div>
            <h1 className="home-title font-black uppercase tracking-tight">SILICON DAWN</h1>
            <p className="home-subtitle font-mono font-bold uppercase tracking-[0.28em]">
              Modern Autonomous Warfare
            </p>
            <p className="max-w-xl text-sm text-slate-200/90 leading-relaxed pt-1">
              Command autonomous armor, drone swarms, electronic warfare jamming domes, and
              quantum cyber operations across contested Flashpoint theaters.
            </p>
          </div>

          {hasActiveSession && (
            <div>
              <button
                type="button"
                onClick={onResume}
                className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-md border border-emerald-400/70 bg-emerald-500/20 px-5 py-2.5 text-sm font-bold uppercase tracking-wider text-emerald-100 backdrop-blur-md shadow-[0_0_24px_rgba(16,185,129,0.22)] hover:bg-emerald-500/30 transition"
              >
                <Play className="h-4 w-4 text-emerald-300" />
                <span>Resume Active Operation</span>
              </button>
            </div>
          )}

          {/* Flagship Dual Selector: Campaign vs Skirmish */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <button
              type="button"
              onClick={onOpenCampaign}
              className="group relative flex flex-col justify-between gap-3 rounded-lg border border-amber-400/45 bg-[#0d140f]/82 p-5 text-left backdrop-blur-md shadow-2xl transition hover:border-amber-300 hover:bg-[#131d16]/92 focus-visible:outline-2 focus-visible:outline-amber-300"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded bg-amber-400/15 border border-amber-400/35 px-2 py-0.5 font-mono text-[11px] font-bold text-amber-300">
                    7 OPS · FMV BRIEFINGS
                  </span>
                  <Crosshair className="h-5 w-5 text-amber-300 transition-transform group-hover:rotate-45" />
                </div>
                <div className="text-xl font-black uppercase tracking-wide text-slate-100 group-hover:text-amber-200">
                  Campaign
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Deploy across Boot Sequence and 6 escalating Flashpoint theaters with Red
                  Alert-style video briefings and campaign unlocks.
                </p>
              </div>
              <div className="font-mono text-xs font-bold uppercase tracking-wider text-amber-300">
                Select Operation →
              </div>
            </button>

            <button
              type="button"
              onClick={onOpenSkirmish}
              className="group relative flex flex-col justify-between gap-3 rounded-lg border border-emerald-400/45 bg-[#0b130e]/82 p-5 text-left backdrop-blur-md shadow-2xl transition hover:border-emerald-300 hover:bg-[#111e16]/92 focus-visible:outline-2 focus-visible:outline-emerald-300"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded bg-emerald-400/15 border border-emerald-400/35 px-2 py-0.5 font-mono text-[11px] font-bold text-emerald-300">
                    CUSTOM BATTLE · 5 MAPS
                  </span>
                  <Swords className="h-5 w-5 text-emerald-300 transition-transform group-hover:scale-110" />
                </div>
                <div className="text-xl font-black uppercase tracking-wide text-slate-100 group-hover:text-emerald-200">
                  Skirmish
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Pick Western Alliance, Eurasian Pact, or Asymmetric Axis against Recruit or
                  Commander AI on 72×54 strategic maps.
                </p>
              </div>
              <div className="font-mono text-xs font-bold uppercase tracking-wider text-emerald-300">
                Configure Skirmish →
              </div>
            </button>
          </div>

          {/* Secondary Utility Actions */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <button
              type="button"
              onClick={onStartTutorial}
              className="flex min-h-[44px] flex-col justify-center gap-1 rounded border border-cyan-400/35 bg-[#091210]/80 px-3 py-2 text-left text-xs backdrop-blur-md hover:border-cyan-300 hover:bg-[#0e1b18]/90 transition"
            >
              <div className="flex items-center justify-between gap-1 font-semibold text-cyan-200">
                <span className="flex items-center gap-1.5">
                  <GraduationCap className="h-3.5 w-3.5" />
                  Walkthrough
                </span>
                {!walkthroughCompleted && (
                  <span className="rounded bg-cyan-400/20 px-1.5 py-0.5 font-mono text-[10px] font-bold text-cyan-300">
                    NEW
                  </span>
                )}
              </div>
              <span className="text-[11px] text-slate-400">Interactive spotlight tour</span>
            </button>

            <button
              type="button"
              onClick={onStartDemo}
              className="flex min-h-[44px] flex-col justify-center gap-1 rounded border border-slate-600/45 bg-[#09100c]/80 px-3 py-2 text-left text-xs backdrop-blur-md hover:border-emerald-400/60 hover:bg-[#0f1812]/90 transition"
            >
              <div className="flex items-center gap-1.5 font-semibold text-emerald-200">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Showcase Demo</span>
              </div>
              <span className="text-[11px] text-slate-400">6-chapter live battle</span>
            </button>

            <button
              type="button"
              onClick={onOpenSaves}
              className="flex min-h-[44px] flex-col justify-center gap-1 rounded border border-slate-600/45 bg-[#09100c]/80 px-3 py-2 text-left text-xs backdrop-blur-md hover:border-sky-400/60 hover:bg-[#0f1812]/90 transition"
            >
              <div className="flex items-center gap-1.5 font-semibold text-slate-100">
                <FolderOpen className="h-3.5 w-3.5 text-sky-300" />
                <span>Load Save{saveSlotCount > 0 ? ` (${saveSlotCount})` : ''}</span>
              </div>
              <span className="text-[11px] text-slate-400">IndexedDB &amp; .sdawn</span>
            </button>

            <button
              type="button"
              onClick={onOpenSettings}
              className="flex min-h-[44px] flex-col justify-center gap-1 rounded border border-slate-600/45 bg-[#09100c]/80 px-3 py-2 text-left text-xs backdrop-blur-md hover:border-sky-400/60 hover:bg-[#0f1812]/90 transition"
            >
              <div className="flex items-center gap-1.5 font-semibold text-slate-100">
                <Sliders className="h-3.5 w-3.5 text-slate-300" />
                <span>Settings</span>
              </div>
              <span className="text-[11px] text-slate-400">Controls &amp; display</span>
            </button>
          </div>
        </main>

        {/* Bottom Intel Strip */}
        <footer className="safe-bottom flex flex-wrap items-center justify-between gap-2 border-t border-emerald-200/15 pt-3 text-[11px] font-mono text-slate-300/75">
          <span>FACTIONS: WESTERN ALLIANCE · EURASIAN PACT · ASYMMETRIC AXIS</span>
          <span>20HZ DETERMINISTIC SIM · OFFLINE PWA READY</span>
        </footer>
      </div>
    </div>
  );
}
