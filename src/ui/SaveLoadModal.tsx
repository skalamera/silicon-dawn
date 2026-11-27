import { useEffect, useRef, useState } from 'react';
import type { SaveSlotMeta } from '../storage';
import { Download, HardDrive, Trash2, Upload, X } from 'lucide-react';

interface SaveLoadModalProps {
  open: boolean;
  onClose: () => void;
  providerLabel: string;
  slots: SaveSlotMeta[];
  onSaveNamed: (name: string) => Promise<void>;
  onLoadSlot: (id: string) => Promise<void>;
  onDeleteSlot: (id: string) => Promise<void>;
  onExportCurrent: () => void;
  onImportFile: (file: File) => Promise<void>;
}

export function SaveLoadModal({
  open,
  onClose,
  providerLabel,
  slots,
  onSaveNamed,
  onLoadSlot,
  onDeleteSlot,
  onExportCurrent,
  onImportFile,
}: SaveLoadModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [slotName, setSlotName] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  // Native <dialog> close handling + Safari light-dismiss fallback for closedby="any"
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
      const onDown = (e: PointerEvent) => {
        pressedOutside = outside(e);
      };
      const onUp = (e: PointerEvent) => {
        if (pressedOutside && outside(e)) dialog.close();
      };
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

  const handleCreateSave = async () => {
    setBusy(true);
    setErrorMsg(null);
    try {
      const name = slotName.trim() || `Operation ${new Date().toLocaleTimeString()}`;
      await onSaveNamed(name);
      setSlotName('');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save match.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="save-modal-title"
      {...({ closedby: 'any' } as Record<string, string>)}
      className="m-auto w-[min(92dvw,34rem)] max-h-[85dvh] rounded-lg border border-sky-500/40 bg-slate-950 text-slate-100 shadow-2xl p-0"
    >
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <div>
          <h1 id="save-modal-title" className="modal-heading font-bold tracking-wide text-slate-100">
            Save &amp; Load Operations
          </h1>
          <div className="flex items-center gap-1.5 text-xs text-sky-400 mt-0.5">
            <HardDrive className="h-3.5 w-3.5" />
            <span>{providerLabel}</span>
          </div>
        </div>
        <button
          type="button"
          autoFocus
          onClick={() => dialogRef.current?.close()}
          aria-label="Close save dialog"
          className="rounded border border-slate-700 p-1.5 text-slate-300 hover:bg-slate-800 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="p-4 space-y-4 overflow-y-auto tactical-scroll">
        {/* New Named Save + Portable .sdawn Export/Import */}
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={slotName}
              onChange={(e) => setSlotName(e.target.value)}
              placeholder="Save slot name (optional)..."
              className="flex-1 rounded border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400 focus:outline-none"
            />
            <button
              type="button"
              disabled={busy}
              onClick={handleCreateSave}
              className="rounded bg-sky-500 px-3.5 py-2 text-xs font-bold text-slate-950 hover:bg-sky-400 disabled:opacity-50"
            >
              Save Current
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onExportCurrent}
              className="flex items-center gap-1.5 rounded border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-sky-400"
            >
              <Download className="h-3.5 w-3.5 text-cyan-400" />
              Export .sdawn File
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 rounded border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-sky-400"
            >
              <Upload className="h-3.5 w-3.5 text-emerald-400" />
              Import .sdawn File
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".sdawn,.json"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file) return;
                setBusy(true);
                setErrorMsg(null);
                try {
                  await onImportFile(file);
                } catch (err) {
                  setErrorMsg(err instanceof Error ? err.message : 'Invalid .sdawn file.');
                } finally {
                  setBusy(false);
                }
              }}
            />
          </div>
        </div>

        {errorMsg && (
          <div className="rounded border border-rose-500/60 bg-rose-950/60 px-3 py-2 text-xs text-rose-200">
            {errorMsg}
          </div>
        )}

        {/* Saved Slots List */}
        <div className="space-y-2">
          <div className="text-xs font-mono text-slate-400 uppercase">
            Local Slots ({slots.length})
          </div>
          {slots.length === 0 ? (
            <div className="rounded border border-slate-800 bg-slate-900/50 p-4 text-center text-xs text-slate-400">
              No saved matches yet. Press Quick Save (F5) or Save Current above.
            </div>
          ) : (
            <ul className="space-y-1.5">
              {slots.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-2 rounded border border-slate-800 bg-slate-900/80 px-3 py-2 text-xs"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-100 truncate">{s.name}</span>
                      <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-xs text-sky-300 uppercase">
                        {s.kind}
                      </span>
                    </div>
                    <div className="text-slate-400 font-mono mt-0.5">
                      {s.playerFaction.toUpperCase()} vs {s.aiFaction.toUpperCase()} ·{' '}
                      {Math.floor(s.elapsedSeconds)}s · {(s.byteSize / 1024).toFixed(1)} KB
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          await onLoadSlot(s.id);
                        } finally {
                          setBusy(false);
                        }
                      }}
                      className="rounded bg-emerald-500 px-2.5 py-1.5 font-bold text-slate-950 hover:bg-emerald-400"
                    >
                      Load
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      aria-label={`Delete ${s.name}`}
                      onClick={() => onDeleteSlot(s.id)}
                      className="rounded border border-slate-700 p-1.5 text-slate-400 hover:border-rose-500 hover:text-rose-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </dialog>
  );
}
