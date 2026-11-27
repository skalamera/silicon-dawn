import {
  Cpu,
  Download,
  FolderOpen,
  Map as MapIcon,
  Menu,
  MessageSquare,
  Music,
  Pause,
  Play,
  PlusCircle,
  Radio,
  Save,
  Sliders,
  Sparkles,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import type { OverlayMode, PlayerState } from '../sim/types';

interface TopBarProps {
  player: PlayerState;
  elapsedSeconds: number;
  kesslerTimer: number;
  overlayMode: OverlayMode;
  onSetOverlay: (mode: OverlayMode) => void;
  simSpeed: 0 | 0.5 | 1 | 2;
  onSetSpeed: (spd: 0 | 0.5 | 1 | 2) => void;
  sfxOn: boolean;
  musicOn: boolean;
  voiceOn: boolean;
  onToggleSfx: () => void;
  onToggleMusic: () => void;
  onToggleVoice: () => void;
  canInstallPwa: boolean;
  onInstallPwa: () => void;
  onQuickSave: () => void;
  onOpenSaves: () => void;
  onOpenNewMatch: () => void;
  onOpenCampaign: () => void;
  onOpenSettings: () => void;
  onStartDemo: () => void;
  onOpenMenu: () => void;
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function TopBar({
  player,
  elapsedSeconds,
  kesslerTimer,
  overlayMode,
  onSetOverlay,
  simSpeed,
  onSetSpeed,
  sfxOn,
  musicOn,
  voiceOn,
  onToggleSfx,
  onToggleMusic,
  onToggleVoice,
  canInstallPwa,
  onInstallPwa,
  onQuickSave,
  onOpenSaves,
  onOpenNewMatch,
  onOpenCampaign,
  onOpenSettings,
  onStartDemo,
  onOpenMenu,
}: TopBarProps) {
  const powerOk = player.powerRatio >= 1.0;
  const latencyPct = Math.round(player.latencyFactor * 100);

  return (
    <header className="safe-top z-20 flex flex-wrap items-center justify-between gap-2 border-b border-sky-500/25 bg-slate-950/90 px-2.5 py-1.5 backdrop-blur-md">
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={onOpenMenu}
          title="Pause / Save & Quit to Main Menu (Esc)"
          aria-label="Open Operation Menu"
          className="flex items-center gap-1.5 rounded border border-emerald-400/45 bg-emerald-950/55 px-2.5 py-1 text-xs font-semibold text-emerald-200 hover:bg-emerald-900/70 transition"
        >
          <Menu className="h-3.5 w-3.5" />
          <span>Menu</span>
        </button>

        <div className="flex items-center gap-1.5 pr-2 border-r border-slate-800">
          <span className="h-2 w-2 rounded-full bg-sky-400 shadow-[0_0_8px_#38bdf8]" />
          <span className="hud-title font-bold tracking-wider text-slate-100 uppercase">
            Silicon Dawn
          </span>
          <span className="hidden sm:inline font-mono text-xs text-slate-400 tabular-nums ml-1">
            {formatTime(elapsedSeconds)}
          </span>
        </div>

        <div className="flex items-center gap-1.5 rounded bg-slate-900/90 border border-slate-800 px-2 py-1 text-xs font-mono tabular-nums">
          <span className="text-cyan-400 font-bold">Si</span>
          <span className="text-slate-100 font-semibold">{Math.floor(player.silicon).toLocaleString()}</span>
        </div>

        <div
          className={`flex items-center gap-1 rounded border px-2 py-1 text-xs font-mono tabular-nums ${
            powerOk
              ? 'bg-slate-900/90 border-slate-800 text-emerald-300'
              : 'bg-amber-950/70 border-amber-500/60 text-amber-300 animate-pulse'
          }`}
          title="Power Grid (MW Produced / Consumed)"
        >
          <Zap className="h-3.5 w-3.5" />
          <span>
            {player.powerProduced}/{player.powerConsumed} MW
          </span>
        </div>

        <div
          className={`flex items-center gap-1 rounded border px-2 py-1 text-xs font-mono tabular-nums ${
            latencyPct === 100
              ? 'bg-slate-900/90 border-slate-800 text-sky-300'
              : latencyPct >= 75
              ? 'bg-amber-950/70 border-amber-500/50 text-amber-300'
              : 'bg-rose-950/70 border-rose-500/60 text-rose-300'
          }`}
          title="Compute Cap (FLOPS Used / Cap)"
        >
          <Cpu className="h-3.5 w-3.5" />
          <span>
            {player.flopsUsed}/{player.flopsCap}
          </span>
          {latencyPct < 100 && <span className="ml-1 font-bold">({latencyPct}% SPD)</span>}
        </div>

        {kesslerTimer > 0 && (
          <div className="rounded border border-rose-500/70 bg-rose-950/80 px-2 py-1 text-xs font-mono font-bold text-rose-200 animate-pulse">
            EMP BLACKOUT {formatTime(kesslerTimer)}
          </div>
        )}
        {player.chokepointTimer > 0 && (
          <div className="rounded border border-amber-500/70 bg-amber-950/80 px-2 py-1 text-xs font-mono font-bold text-amber-200">
            SUPPLY COLLAPSE {Math.ceil(player.chokepointTimer)}s
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <div className="flex items-center rounded border border-slate-800 bg-slate-900/90 p-0.5 text-xs">
          {(
            [
              ['tactical', 'Tactical'],
              ['em', 'EM'],
              ['power', 'Grid'],
            ] as const
          ).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              data-tour={mode === 'em' ? 'overlay-em' : undefined}
              onClick={() => onSetOverlay(mode)}
              className={`flex items-center gap-1 rounded px-2 py-1 font-medium transition ${
                overlayMode === mode
                  ? 'bg-sky-500 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              {mode === 'em' && <Radio className="h-3 w-3" />}
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center rounded border border-slate-800 bg-slate-900/90 p-0.5 text-xs font-mono">
          {([0, 0.5, 1, 2] as const).map((spd) => (
            <button
              key={spd}
              type="button"
              onClick={() => onSetSpeed(spd)}
              aria-label={spd === 0 ? 'Pause simulation' : `Speed ${spd}x`}
              className={`rounded px-1.5 py-1 transition ${
                simSpeed === spd
                  ? 'bg-emerald-500 text-slate-950 font-bold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              {spd === 0 ? <Pause className="h-3.5 w-3.5" /> : spd === 1 ? <Play className="h-3.5 w-3.5 inline" /> : `${spd}×`}
            </button>
          ))}
        </div>

        {/* Audio Toggles */}
        <div className="flex items-center rounded border border-slate-800 bg-slate-900/90 p-0.5 text-xs">
          <button
            type="button"
            onClick={onToggleSfx}
            title="Toggle Sound Effects"
            aria-label="Toggle Sound Effects"
            className={`rounded p-1 ${sfxOn ? 'text-sky-300' : 'text-slate-500'}`}
          >
            {sfxOn ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            onClick={onToggleMusic}
            title="Toggle Synth Music"
            aria-label="Toggle Synth Music"
            className={`rounded p-1 ${musicOn ? 'text-emerald-300' : 'text-slate-500'}`}
          >
            <Music className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onToggleVoice}
            title="Toggle EVA Voice Cues"
            aria-label="Toggle EVA Voice Cues"
            className={`rounded p-1 ${voiceOn ? 'text-cyan-300' : 'text-slate-500'}`}
          >
            <MessageSquare className="h-3.5 w-3.5" />
          </button>
        </div>

        <button
          type="button"
          onClick={onStartDemo}
          className="flex items-center gap-1 rounded border border-cyan-400/50 bg-cyan-950/60 px-2.5 py-1 text-xs font-medium text-cyan-200 hover:bg-cyan-900/70 transition"
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span>Demo</span>
        </button>

        <button
          type="button"
          onClick={onOpenCampaign}
          className="flex items-center gap-1 rounded border border-amber-500/45 bg-amber-950/50 px-2.5 py-1 text-xs font-medium text-amber-200 hover:bg-amber-900/60 transition"
        >
          <MapIcon className="h-3.5 w-3.5" />
          <span>Campaign</span>
        </button>

        <button
          type="button"
          data-tour="quicksave-btn"
          onClick={onQuickSave}
          title="Quick Save (F5)"
          className="flex items-center gap-1 rounded border border-sky-500/40 bg-sky-950/60 px-2.5 py-1 text-xs font-medium text-sky-200 hover:bg-sky-900/70 transition"
        >
          <Save className="h-3.5 w-3.5" />
          <span className="hidden lg:inline">Quick Save</span>
        </button>

        <button
          type="button"
          onClick={onOpenSaves}
          className="flex items-center gap-1 rounded border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs font-medium text-slate-200 hover:border-sky-500/50 transition"
        >
          <FolderOpen className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Saves</span>
        </button>

        <button
          type="button"
          onClick={onOpenNewMatch}
          className="flex items-center gap-1 rounded border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs font-medium text-slate-200 hover:border-sky-500/50 transition"
        >
          <PlusCircle className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Skirmish</span>
        </button>

        <button
          type="button"
          onClick={onOpenSettings}
          title="Display & Accessibility Settings"
          aria-label="Open Settings"
          className="flex items-center gap-1 rounded border border-slate-700 bg-slate-900 p-1.5 text-xs font-medium text-slate-200 hover:border-sky-500/50 transition"
        >
          <Sliders className="h-3.5 w-3.5" />
        </button>

        {canInstallPwa && (
          <button
            type="button"
            onClick={onInstallPwa}
            className="flex items-center gap-1 rounded border border-emerald-400/60 bg-emerald-950/70 px-2.5 py-1 text-xs font-bold text-emerald-200 hover:bg-emerald-900/70 transition"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Install</span>
          </button>
        )}
      </div>
    </header>
  );
}
