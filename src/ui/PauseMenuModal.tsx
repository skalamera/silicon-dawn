import { useEffect, useRef, useState } from 'react';
import {
  FolderOpen,
  LogOut,
  Map as MapIcon,
  Play,
  Save,
  Sliders,
  X,
} from 'lucide-react';

interface PauseMenuModalProps {
  open: boolean;
  operationTitle: string;
  factionLabel: string;
  elapsedSeconds: number;
  isDemo: boolean;
  onResume: () => void;
  onSaveAndQuit: () => Promise<void>;
  onOpenSaves: () => void;
  onOpenCampaignHub: () => void;
  onOpenSettings: () => void;
  onQuitToMenu: () => void;
}

function formatClock(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function PauseMenuModal({
  open,
  operationTitle,
  factionLabel,
  elapsedSeconds,
  isDemo,
  onResume,
  onSaveAndQuit,
  onOpenSaves,
  onOpenCampaignHub,
  onOpenSettings,
  onQuitToMenu,
}: PauseMenuModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [saving, setSaving] = useState(false);

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
      onResume();
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
  }, [onResume]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="pause-menu-title"
      {...({ closedby: 'any' } as Record<string, string>)}
      className="m-auto w-[min(92dvw,25rem)] max-h-[88dvh] rounded-lg border border-emerald-400/45 bg-slate-950 text-slate-100 shadow-2xl p-0"
    >
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <div>
          <h1 id="pause-menu-title" className="modal-heading font-bold tracking-wide text-emerald-300">
            Operation Paused
          </h1>
          <p className="text-xs font-mono text-slate-400 mt-0.5">
            {operationTitle} · {factionLabel.toUpperCase()} · {formatClock(elapsedSeconds)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          aria-label="Resume operation"
          className="rounded border border-slate-700 p-1.5 text-slate-300 hover:bg-slate-800"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="p-4 flex flex-col gap-2 text-xs">
        <button
          type="button"
          autoFocus
          onClick={() => dialogRef.current?.close()}
          className="flex min-h-[44px] items-center justify-center gap-2 rounded bg-emerald-400 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-emerald-300 transition"
        >
          <Play className="h-4 w-4" />
          <span>Resume Operation</span>
        </button>

        {!isDemo && (
          <button
            type="button"
            disabled={saving}
            onClick={() => {
              setSaving(true);
              void onSaveAndQuit().finally(() => setSaving(false));
            }}
            className="flex min-h-[42px] items-center justify-center gap-2 rounded border border-sky-400/50 bg-sky-950/60 px-4 py-2 font-semibold text-sky-100 hover:bg-sky-900/70 disabled:opacity-50 transition"
          >
            <Save className="h-4 w-4 text-sky-300" />
            <span>{saving ? 'Saving Operation...' : 'Save & Quit to Main Menu'}</span>
          </button>
        )}

        <button
          type="button"
          onClick={onOpenCampaignHub}
          className="flex min-h-[42px] items-center justify-center gap-2 rounded border border-amber-400/45 bg-amber-950/50 px-4 py-2 font-semibold text-amber-200 hover:bg-amber-900/60 transition"
        >
          <MapIcon className="h-4 w-4" />
          <span>Campaign Command Hub</span>
        </button>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onOpenSaves}
            className="flex min-h-[40px] items-center justify-center gap-1.5 rounded border border-slate-700 bg-slate-900 px-3 py-2 font-medium text-slate-200 hover:border-sky-400/50 transition"
          >
            <FolderOpen className="h-3.5 w-3.5" />
            <span>Save / Load</span>
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            className="flex min-h-[40px] items-center justify-center gap-1.5 rounded border border-slate-700 bg-slate-900 px-3 py-2 font-medium text-slate-200 hover:border-sky-400/50 transition"
          >
            <Sliders className="h-3.5 w-3.5" />
            <span>Settings</span>
          </button>
        </div>

        <button
          type="button"
          onClick={onQuitToMenu}
          className="mt-1 flex min-h-[42px] items-center justify-center gap-2 rounded border border-rose-500/55 bg-rose-950/55 px-4 py-2 font-bold text-rose-200 hover:bg-rose-900/70 transition"
        >
          <LogOut className="h-4 w-4" />
          <span>Quit to Main Menu</span>
        </button>
      </div>
    </dialog>
  );
}
