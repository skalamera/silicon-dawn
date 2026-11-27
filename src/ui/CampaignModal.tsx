import { useEffect, useRef, useState } from 'react';
import { MISSIONS, type MissionDef } from '../data/missions';
import { CheckCircle2, Play, Terminal, X } from 'lucide-react';

interface CampaignModalProps {
  open: boolean;
  onClose: () => void;
  completedIds: Set<string>;
  onLaunchMission: (mission: MissionDef) => void;
}

export function CampaignModal({
  open,
  onClose,
  completedIds,
  onLaunchMission,
}: CampaignModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [selectedId, setSelectedId] = useState<string>(MISSIONS[0].id);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleClose = () => {
      dialog.returnValue = '';
      onClose();
    };
    dialog.addEventListener('close', handleClose);

    let cleanupSafariFallback: (() => void) | undefined;
    if (!('closedBy' in HTMLDialogElement.prototype)) {
      const outside = (e: PointerEvent) => {
        const r = dialog.getBoundingClientRect();
        return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
      };
      let pressedOutside = false;
      const onDown = (e: PointerEvent) => { pressedOutside = outside(e); };
      const onUp = (e: PointerEvent) => { if (pressedOutside && outside(e)) dialog.close(); };
      dialog.addEventListener('pointerdown', onDown);
      dialog.addEventListener('pointerup', onUp);
      cleanupSafariFallback = () => {
        dialog.removeEventListener('pointerdown', onDown);
        dialog.removeEventListener('pointerup', onUp);
      };
    }

    return () => {
      dialog.removeEventListener('close', handleClose);
      cleanupSafariFallback?.();
    };
  }, [onClose]);

  const active = MISSIONS.find((m) => m.id === selectedId) ?? MISSIONS[0];

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="campaign-modal-title"
      {...({ closedby: 'any' } as Record<string, string>)}
      className="m-auto w-[min(95dvw,44rem)] max-h-[88dvh] rounded-lg border border-amber-500/45 bg-slate-950 text-slate-100 shadow-2xl p-0"
    >
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-amber-400" />
          <h1 id="campaign-modal-title" className="modal-heading font-bold tracking-wide">
            Flashpoints Campaign &amp; Boot Sequence
          </h1>
        </div>
        <button
          type="button"
          autoFocus
          onClick={() => dialogRef.current?.close()}
          aria-label="Close campaign dialog"
          className="rounded border border-slate-700 p-1.5 text-slate-300 hover:bg-slate-800"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-5 flex-1 min-h-0 overflow-hidden text-xs">
        {/* Left Mission List */}
        <div className="sm:col-span-2 border-b sm:border-b-0 sm:border-r border-slate-800 p-2.5 space-y-1.5 overflow-y-auto tactical-scroll max-h-48 sm:max-h-none">
          {MISSIONS.map((m) => {
            const done = completedIds.has(m.id);
            const factionBadge =
              m.faction === 'alliance'
                ? 'text-sky-300'
                : m.faction === 'pact'
                ? 'text-rose-300'
                : 'text-yellow-300';
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setSelectedId(m.id)}
                className={`w-full rounded border px-2.5 py-2 text-left transition ${
                  selectedId === m.id
                    ? 'border-amber-400 bg-amber-950/40'
                    : 'border-slate-800 bg-slate-900/70 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={`font-mono font-bold ${factionBadge}`}>{m.codeName}</span>
                  {done && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />}
                </div>
                <div className="font-semibold text-slate-100 mt-0.5">{m.title}</div>
              </button>
            );
          })}
        </div>

        {/* Right Tactical Terminal Briefing */}
        <div className="sm:col-span-3 p-4 flex flex-col justify-between gap-4 overflow-y-auto tactical-scroll">
          <div className="space-y-3">
            <div className="flex items-center justify-between font-mono text-amber-300">
              <span>{active.codeName} // {active.faction.toUpperCase()}</span>
              <span>MAP: {active.mapId.replace('_', ' ').toUpperCase()}</span>
            </div>
            <h2 className="text-base font-bold text-slate-100">{active.title}</h2>
            <p className="rounded border border-slate-800 bg-slate-900/70 p-3 text-slate-300 leading-relaxed font-mono">
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

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="rounded border border-slate-700 px-3 py-2 text-slate-300 hover:bg-slate-800"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => {
                onLaunchMission(active);
                onClose();
              }}
              className="flex items-center gap-1.5 rounded bg-amber-400 px-4 py-2 font-bold text-slate-950 hover:bg-amber-300"
            >
              <Play className="h-3.5 w-3.5" />
              Deploy Operation
            </button>
          </div>
        </div>
      </div>
    </dialog>
  );
}
