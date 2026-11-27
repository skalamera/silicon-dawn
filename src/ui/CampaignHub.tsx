import { useRef, useState } from 'react';
import { MISSIONS, getMissionById, type MissionDef } from '../data/missions';
import type { SaveSlotMeta } from '../storage';
import {
  ArrowLeft,
  CheckCircle2,
  Film,
  FolderOpen,
  GraduationCap,
  Play,
  RotateCcw,
  Shield,
  Trash2,
  Upload,
} from 'lucide-react';
import { HomeBackdrop } from './HomeBackdrop';

interface CampaignHubProps {
  completedIds: Set<string>;
  saveSlots: SaveSlotMeta[];
  heroImageSrc?: string;
  onBackToHome: () => void;
  onLaunchMission: (mission: MissionDef, options?: { forceWalkthrough?: boolean }) => void;
  onPreviewBriefing: (mission: MissionDef) => void;
  onLoadSlot: (id: string) => void;
  onDeleteSlot: (id: string) => void;
  onImportFile: (file: File) => void;
  onResetProgress: () => void;
}

function getCommanderRank(cleared: number): string {
  if (cleared >= MISSIONS.length) return 'Supreme AUTOWARCOM Commander';
  if (cleared >= 6) return 'Theater Marshal';
  if (cleared >= 3) return 'Strike General';
  if (cleared >= 1) return 'Theater Officer';
  return 'Recruit Commander';
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function CampaignHub({
  completedIds,
  saveSlots,
  heroImageSrc,
  onBackToHome,
  onLaunchMission,
  onPreviewBriefing,
  onLoadSlot,
  onDeleteSlot,
  onImportFile,
  onResetProgress,
}: CampaignHubProps) {
  const firstPending = MISSIONS.find((m) => !completedIds.has(m.id)) ?? MISSIONS[MISSIONS.length - 1];
  const [selectedId, setSelectedId] = useState<string>(firstPending.id);
  const [confirmReset, setConfirmReset] = useState(false);
  const hasCampaignSaves = saveSlots.some((s) => Boolean(s.missionId));
  const [saveFilter, setSaveFilter] = useState<'campaign' | 'all'>(() =>
    hasCampaignSaves ? 'campaign' : 'all'
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const active = MISSIONS.find((m) => m.id === selectedId) ?? firstPending;
  const clearedCount = completedIds.size;
  const pct = Math.round((clearedCount / MISSIONS.length) * 100);
  const latestCampaignSave = saveSlots.find((s) => Boolean(s.missionId));
  const filteredSaves =
    saveFilter === 'campaign' && hasCampaignSaves
      ? saveSlots.filter((s) => Boolean(s.missionId))
      : saveSlots;

  const factionStats = (['alliance', 'pact', 'axis'] as const).map((f) => {
    const ops = MISSIONS.filter((m) => m.faction === f);
    const done = ops.filter((m) => completedIds.has(m.id)).length;
    return { faction: f, done, total: ops.length };
  });

  return (
    <div className="fixed inset-0 z-40 h-dvh w-dvw overflow-y-auto tactical-scroll">
      <HomeBackdrop motionPaused={true} heroImageSrc={heroImageSrc} />
      <div className="pointer-events-none fixed inset-0 bg-[#050a06]/78" />

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-4 sm:px-6 sm:py-6 space-y-5">
        {/* Top Hub Bar */}
        <header className="safe-top flex flex-wrap items-center justify-between gap-3 border-b border-emerald-400/20 pb-3">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onBackToHome}
              className="flex min-h-[40px] items-center gap-1.5 rounded border border-slate-600/60 bg-slate-950/85 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:border-emerald-400 hover:text-emerald-200 transition"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Main Menu</span>
            </button>
            <div>
              <h1 className="modal-heading font-black uppercase tracking-wide text-amber-200">
                Campaign Command Hub
              </h1>
              <div className="flex items-center gap-1.5 text-xs font-mono text-emerald-300">
                <Shield className="h-3.5 w-3.5" />
                <span>Clearance Rank: {getCommanderRank(clearedCount)}</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onBlur={() => setConfirmReset(false)}
            onClick={() => {
              if (!confirmReset) {
                setConfirmReset(true);
              } else {
                onResetProgress();
                setConfirmReset(false);
              }
            }}
            className={`flex min-h-[38px] items-center gap-1.5 rounded border px-3 py-1.5 text-xs font-mono transition ${
              confirmReset
                ? 'border-rose-400 bg-rose-950/90 text-rose-200 font-bold'
                : 'border-slate-700 bg-slate-950/80 text-slate-300 hover:border-rose-400/50 hover:text-rose-200'
            }`}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>{confirmReset ? 'Confirm Reset Progress?' : 'Reset Progress'}</span>
          </button>
        </header>

        {/* Campaign Progress Overview Banner */}
        <section className="rounded-lg border border-amber-400/35 bg-[#09100b]/88 p-4 backdrop-blur-md shadow-xl space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="font-mono text-xs text-amber-300 uppercase">
                Theater Campaign Progress · {clearedCount}/{MISSIONS.length} Operations Cleared ({pct}%)
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-slate-300">
                {factionStats.map((fs) => (
                  <span key={fs.faction} className="uppercase">
                    {fs.faction}: <strong className="text-slate-100">{fs.done}/{fs.total}</strong>
                  </span>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {latestCampaignSave && (
                <button
                  type="button"
                  onClick={() => onLoadSlot(latestCampaignSave.id)}
                  className="flex min-h-[42px] items-center gap-1.5 rounded border border-emerald-400/60 bg-emerald-950/75 px-3.5 py-2 text-xs font-bold text-emerald-100 hover:bg-emerald-900/80 transition"
                >
                  <FolderOpen className="h-4 w-4 text-emerald-300" />
                  <span>
                    Resume Save ({formatDuration(latestCampaignSave.elapsedSeconds)})
                  </span>
                </button>
              )}

              <button
                type="button"
                onClick={() => onLaunchMission(firstPending)}
                className="flex min-h-[42px] items-center gap-1.5 rounded bg-amber-400 px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-950 hover:bg-amber-300 transition"
              >
                <Play className="h-4 w-4" />
                <span>
                  {clearedCount === 0
                    ? `Start ${firstPending.codeName}`
                    : clearedCount >= MISSIONS.length
                    ? `Replay ${firstPending.codeName}`
                    : `Continue ${firstPending.codeName}`}
                </span>
              </button>
            </div>
          </div>

          <div className="h-2 w-full rounded-full bg-slate-900 overflow-hidden border border-slate-800">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 via-amber-400 to-sky-400 transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        </section>

        {/* Main Operations + Saved States Split */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Operations Roster & Briefing Dossier */}
          <section className="lg:col-span-7 rounded-lg border border-slate-700/70 bg-[#080f0a]/90 backdrop-blur-md shadow-xl overflow-hidden">
            <div className="border-b border-slate-800 px-4 py-2.5 font-mono text-xs uppercase text-slate-300 flex items-center justify-between">
              <span>Operation Theater Roster</span>
              <span className="text-amber-300">7 Missions · Red Alert FMV Briefings</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12">
              {/* Operation List */}
              <div className="sm:col-span-5 border-b sm:border-b-0 sm:border-r border-slate-800 p-2 space-y-1.5 max-h-[28rem] overflow-y-auto tactical-scroll">
                {MISSIONS.map((m) => {
                  const done = completedIds.has(m.id);
                  const isNext = m.id === firstPending.id && !done;
                  const isSelected = m.id === active.id;
                  const factionBadge =
                    m.faction === 'alliance'
                      ? 'text-sky-300'
                      : m.faction === 'pact'
                      ? 'text-rose-300'
                      : 'text-amber-300';

                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setSelectedId(m.id)}
                      className={`w-full rounded border p-2.5 text-left text-xs transition ${
                        isSelected
                          ? 'border-amber-400 bg-amber-950/35'
                          : 'border-slate-800 bg-slate-900/70 hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1.5">
                        <span className={`font-mono font-bold ${factionBadge}`}>{m.codeName}</span>
                        {done ? (
                          <span className="inline-flex items-center gap-1 rounded bg-emerald-500/15 px-1.5 py-0.5 font-mono text-[10px] font-bold text-emerald-300">
                            <CheckCircle2 className="h-3 w-3" />
                            CLEARED
                          </span>
                        ) : isNext ? (
                          <span className="rounded bg-amber-400/20 px-1.5 py-0.5 font-mono text-[10px] font-bold text-amber-300">
                            NEXT OP
                          </span>
                        ) : null}
                      </div>
                      <div className="font-semibold text-slate-100 mt-1">{m.title}</div>
                      <div className="text-[11px] font-mono text-slate-400 mt-0.5 uppercase">
                        {m.faction} · {m.difficulty}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Active Dossier */}
              <div className="sm:col-span-7 p-4 flex flex-col justify-between gap-4 text-xs">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-amber-300">
                    <span>
                      {active.codeName} // {active.faction.toUpperCase()}
                    </span>
                    <span>THEATER: {active.mapId.replace('_', ' ').toUpperCase()}</span>
                  </div>

                  <h2 className="text-lg font-black text-slate-100">{active.title}</h2>

                  <p className="rounded border border-slate-800 bg-slate-900/75 p-3 text-slate-300 leading-relaxed font-mono">
                    {active.briefing}
                  </p>

                  <div className="space-y-1.5">
                    <div className="font-mono text-slate-400 uppercase">Primary Objectives</div>
                    <ul className="space-y-1">
                      {active.objectives.map((obj, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-slate-200">
                          <span className="text-sky-400 font-mono">[{idx + 1}]</span>
                          <span>{obj}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => onPreviewBriefing(active)}
                    className="flex min-h-[38px] items-center gap-1.5 rounded border border-slate-600 bg-slate-900 px-3 py-1.5 text-slate-200 hover:border-cyan-400 hover:text-cyan-200 transition"
                  >
                    <Film className="h-3.5 w-3.5" />
                    <span>Watch FMV Briefing</span>
                  </button>

                  {active.id === 'boot_sequence' && (
                    <button
                      type="button"
                      onClick={() => onLaunchMission(active, { forceWalkthrough: true })}
                      className="flex min-h-[38px] items-center gap-1.5 rounded border border-cyan-400/60 bg-cyan-950/60 px-3 py-1.5 font-semibold text-cyan-200 hover:bg-cyan-900/70 transition"
                    >
                      <GraduationCap className="h-3.5 w-3.5" />
                      <span>Deploy + Walkthrough</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => onLaunchMission(active)}
                    className="flex min-h-[38px] items-center gap-1.5 rounded bg-amber-400 px-4 py-1.5 font-bold text-slate-950 hover:bg-amber-300 transition"
                  >
                    <Play className="h-3.5 w-3.5" />
                    <span>Deploy Operation</span>
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Saved States Panel */}
          <section className="lg:col-span-5 rounded-lg border border-slate-700/70 bg-[#080f0a]/90 backdrop-blur-md shadow-xl flex flex-col justify-between overflow-hidden">
            <div className="border-b border-slate-800 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-xs uppercase text-slate-300">
                Saved Operation States
              </span>
              <div className="flex items-center gap-1 text-[11px] font-mono">
                <button
                  type="button"
                  onClick={() => setSaveFilter('campaign')}
                  className={`rounded px-2 py-0.5 ${
                    saveFilter === 'campaign'
                      ? 'bg-emerald-500 text-slate-950 font-bold'
                      : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  Campaign
                </button>
                <button
                  type="button"
                  onClick={() => setSaveFilter('all')}
                  className={`rounded px-2 py-0.5 ${
                    saveFilter === 'all'
                      ? 'bg-sky-500 text-slate-950 font-bold'
                      : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  All Saves ({saveSlots.length})
                </button>
              </div>
            </div>

            <div className="p-3 space-y-2 max-h-[24rem] overflow-y-auto tactical-scroll text-xs">
              {filteredSaves.length === 0 ? (
                <div className="rounded border border-dashed border-slate-700 p-5 text-center text-slate-400 space-y-1.5">
                  <div className="font-semibold text-slate-200">No saved operations yet</div>
                  <p className="leading-relaxed">
                    Matches autosave every 2 minutes, quick-save with <code>F5</code>, or use{' '}
                    <strong>Menu → Save &amp; Quit</strong> mid-mission to store your state here.
                  </p>
                </div>
              ) : (
                filteredSaves.map((slot) => {
                  const missionMeta = getMissionById(slot.missionId);
                  return (
                    <div
                      key={slot.id}
                      className="rounded border border-slate-800 bg-slate-900/75 p-3 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-semibold text-slate-100 truncate">
                              {slot.name}
                            </span>
                            <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] uppercase text-sky-300">
                              {slot.kind}
                            </span>
                          </div>
                          <div className="text-[11px] font-mono text-amber-300 mt-0.5">
                            {missionMeta
                              ? `${missionMeta.codeName} · ${missionMeta.title}`
                              : 'Skirmish / Local Save'}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {slot.playerFaction.toUpperCase()} vs {slot.aiFaction.toUpperCase()} ·{' '}
                            {formatDuration(slot.elapsedSeconds)} ·{' '}
                            {new Date(slot.savedAt).toLocaleString()}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => onDeleteSlot(slot.id)}
                          aria-label={`Delete save ${slot.name}`}
                          className="rounded border border-rose-500/35 p-1.5 text-rose-300 hover:bg-rose-950/60"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onLoadSlot(slot.id)}
                          className="flex items-center gap-1 rounded bg-emerald-400 px-3 py-1 font-bold text-slate-950 hover:bg-emerald-300 transition"
                        >
                          <Play className="h-3 w-3" />
                          <span>Resume</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="border-t border-slate-800 p-3 flex items-center justify-between gap-2 text-xs">
              <span className="text-slate-400">Stored offline in IndexedDB</span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".sdawn,.json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onImportFile(file);
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 rounded border border-slate-700 bg-slate-900 px-3 py-1.5 text-slate-200 hover:border-sky-400/60 transition"
              >
                <Upload className="h-3.5 w-3.5" />
                <span>Import .sdawn</span>
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
