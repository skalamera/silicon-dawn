import { useEffect, useRef } from 'react';
import type { UserSettings } from '../storage/settings';
import { Cloud, Eye, GraduationCap, Monitor, Smartphone, Sliders, X } from 'lucide-react';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  settings: UserSettings;
  onUpdateSettings: (next: UserSettings) => void;
  onReplayWalkthrough?: () => void;
}

export function SettingsModal({
  open,
  onClose,
  settings,
  onUpdateSettings,
  onReplayWalkthrough,
}: SettingsModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

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

  const toggle = (key: keyof UserSettings) => {
    onUpdateSettings({ ...settings, [key]: !settings[key] });
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="settings-modal-title"
      {...({ closedby: 'any' } as Record<string, string>)}
      className="m-auto w-[min(94dvw,34rem)] max-h-[88dvh] rounded-lg border border-sky-500/40 bg-slate-950 text-slate-100 shadow-2xl p-0"
    >
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <Sliders className="h-4 w-4 text-sky-400" />
          <h1 id="settings-modal-title" className="modal-heading font-bold tracking-wide">
            Tactical Display &amp; Controls
          </h1>
        </div>
        <button
          type="button"
          autoFocus
          onClick={() => dialogRef.current?.close()}
          aria-label="Close settings dialog"
          className="rounded border border-slate-700 p-1.5 text-slate-300 hover:bg-slate-800"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="p-4 space-y-4 text-xs overflow-y-auto tactical-scroll">
        <div className="space-y-2">
          <div className="font-mono text-slate-400 uppercase flex items-center gap-1.5">
            <Eye className="h-3.5 w-3.5 text-cyan-400" />
            Accessibility &amp; Performance
          </div>

          {(
            [
              {
                key: 'colorblindPalette',
                label: 'Colorblind-Safe EM & Faction Palette',
                desc: 'Uses Okabe-Ito high-contrast blues, vermilion, gold, and magenta EW domes.',
              },
              {
                key: 'crtScanlines',
                label: 'Tactical CRT Scanline Overlay',
                desc: 'Adds subtle Westwood-inspired command terminal scanlines across the HUD.',
              },
              {
                key: 'lowPowerMode',
                label: 'Battery / Low-Power Render Mode',
                desc: 'Caps canvas pixel ratio to 1× and disables additive bloom for older mobile GPUs.',
              },
              {
                key: 'touchRadialMenu',
                label: 'Touch Long-Press Radial Wheel',
                desc: 'Hold a finger on the map for 0.4s with units selected to open Move/Attack/Stop wheel.',
              },
            ] as const
          ).map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => toggle(item.key)}
              className="w-full flex items-center justify-between gap-3 rounded border border-slate-800 bg-slate-900/80 px-3 py-2.5 text-left hover:border-sky-500/40"
            >
              <div>
                <div className="font-semibold text-slate-100">{item.label}</div>
                <div className="text-slate-400 mt-0.5">{item.desc}</div>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 font-mono font-bold ${
                  settings[item.key]
                    ? 'bg-emerald-500 text-slate-950'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {settings[item.key] ? 'ON' : 'OFF'}
              </span>
            </button>
          ))}
        </div>

        {/* Controls Reference */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div className="rounded border border-slate-800 bg-slate-900/60 p-3 space-y-1">
            <div className="font-semibold text-sky-300 flex items-center gap-1.5">
              <Monitor className="h-3.5 w-3.5" />
              Desktop Controls
            </div>
            <ul className="text-slate-300 space-y-0.5 font-mono">
              <li>L-Click / Drag: Select</li>
              <li>R-Click: Move / Attack / Capture</li>
              <li>WASD / Arrows / Wheel: Pan &amp; Zoom</li>
              <li>Tab: Cycle Tactical / EM / Grid</li>
              <li>H or X: Stop selected units</li>
              <li>Space: Pause · F5/F9: Quick Save/Load</li>
              <li>Ctrl+1..4 / 1..4: Control Groups</li>
            </ul>
          </div>

          <div className="rounded border border-slate-800 bg-slate-900/60 p-3 space-y-1">
            <div className="font-semibold text-emerald-300 flex items-center gap-1.5">
              <Smartphone className="h-3.5 w-3.5" />
              Mobile Touch Controls
            </div>
            <ul className="text-slate-300 space-y-0.5 font-mono">
              <li>1-Finger Drag: Pan Map</li>
              <li>2-Finger Pinch: Zoom</li>
              <li>Tap Unit / Squad Pill: Select</li>
              <li>Long-Press (0.4s): Radial Wheel</li>
              <li>Box Select Toggle: Touch Lasso</li>
              <li>Command Button: Toggle Sidebar</li>
            </ul>
          </div>
        </div>

        <div className="rounded border border-sky-500/30 bg-sky-950/30 p-3 flex items-start gap-2.5 text-slate-300">
          <Cloud className="h-4 w-4 text-sky-400 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-sky-200">Offline PWA + Cloud-Ready Save Architecture</div>
            <div className="text-slate-400 mt-0.5">
              Matches persist offline in IndexedDB with gzip compression and portable <code>.sdawn</code>{' '}
              export. A drop-in <code>CloudSyncAdapter</code> is wired for future account sync.
            </div>
          </div>
        </div>

        {onReplayWalkthrough && (
          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={() => {
                dialogRef.current?.close();
                onReplayWalkthrough();
              }}
              className="flex items-center gap-1.5 rounded border border-cyan-400/50 bg-cyan-950/50 px-3 py-1.5 text-xs font-semibold text-cyan-200 hover:bg-cyan-900/60"
            >
              <GraduationCap className="h-3.5 w-3.5" />
              Replay Interactive Walkthrough
            </button>
          </div>
        )}
      </div>
    </dialog>
  );
}
