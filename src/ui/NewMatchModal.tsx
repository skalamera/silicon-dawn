import { useEffect, useRef, useState } from 'react';
import type { PlayableFactionId } from '../data/defs';
import { MAP_CATALOG } from '../sim/mapGen';
import type { DifficultyId, MapId, MatchConfig } from '../sim/types';
import { X } from 'lucide-react';

interface NewMatchModalProps {
  open: boolean;
  onClose: () => void;
  onStartMatch: (config: MatchConfig) => void;
}

export function NewMatchModal({ open, onClose, onStartMatch }: NewMatchModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [playerFaction, setPlayerFaction] = useState<PlayableFactionId>('alliance');
  const [aiFaction, setAiFaction] = useState<PlayableFactionId>('pact');
  const [aiDifficulty, setAiDifficulty] = useState<DifficultyId>('commander');
  const [mapId, setMapId] = useState<MapId>('peninsula_grid');

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

  const factions: Array<{ id: PlayableFactionId; title: string; color: string; border: string; desc: string }> = [
    {
      id: 'alliance',
      title: 'Western Alliance',
      color: 'text-sky-300',
      border: 'border-sky-400 bg-sky-950/70',
      desc: 'Iron Beam lasers, M1E4 Trophy APS, Unit 8200 Zero-Day, Project Prometheus.',
    },
    {
      id: 'pact',
      title: 'Eurasian Pact',
      color: 'text-rose-300',
      border: 'border-rose-400 bg-rose-950/70',
      desc: 'Dark Factories, Fiber Tethers, Krasukha-Q EW, TOS-3 MLRS, Kessler EMP.',
    },
    {
      id: 'axis',
      title: 'Asymmetric Axis',
      color: 'text-yellow-300',
      border: 'border-yellow-400 bg-yellow-950/60',
      desc: 'Shahed-X hive swarms, Tunnel Borers, Decoys, Pop-Up Silos, Strait Chokepoint.',
    },
  ];

  const selectedMap = MAP_CATALOG.find((m) => m.id === mapId) ?? MAP_CATALOG[0];

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="new-match-title"
      {...({ closedby: 'any' } as Record<string, string>)}
      className="m-auto w-[min(94dvw,38rem)] max-h-[88dvh] rounded-lg border border-sky-500/40 bg-slate-950 text-slate-100 shadow-2xl p-0"
    >
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <h1 id="new-match-title" className="modal-heading font-bold tracking-wide">
          Deploy Skirmish Operation
        </h1>
        <button
          type="button"
          autoFocus
          onClick={() => dialogRef.current?.close()}
          aria-label="Close new match dialog"
          className="rounded border border-slate-700 p-1.5 text-slate-300 hover:bg-slate-800"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="p-4 space-y-4 text-xs overflow-y-auto tactical-scroll">
        {/* Map Picker */}
        <div className="space-y-1.5">
          <div className="font-mono text-slate-400 uppercase">Theater Map</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {MAP_CATALOG.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMapId(m.id)}
                className={`rounded border px-2.5 py-2 text-left transition ${
                  mapId === m.id
                    ? 'border-cyan-400 bg-cyan-950/60 text-cyan-100'
                    : 'border-slate-800 bg-slate-900 text-slate-300'
                }`}
              >
                <div className="font-semibold">{m.name}</div>
                <div className="font-mono text-slate-400 uppercase mt-0.5">{m.biome}</div>
              </button>
            ))}
          </div>
          <p className="text-slate-400">{selectedMap.description}</p>
        </div>

        <div className="space-y-1.5">
          <div className="font-mono text-slate-400 uppercase">Your Faction</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {factions.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  setPlayerFaction(f.id);
                  if (aiFaction === f.id) {
                    setAiFaction(f.id === 'alliance' ? 'pact' : 'alliance');
                  }
                }}
                className={`rounded border p-2.5 text-left transition ${
                  playerFaction === f.id ? f.border : 'border-slate-800 bg-slate-900'
                }`}
              >
                <div className={`font-bold ${f.color}`}>{f.title}</div>
                <div className="text-slate-400 mt-1">{f.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <div className="font-mono text-slate-400 uppercase">Opponent Faction</div>
            <div className="grid grid-cols-3 gap-1.5">
              {factions.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setAiFaction(f.id)}
                  className={`rounded border py-2 px-1.5 font-semibold ${
                    aiFaction === f.id ? f.border : 'border-slate-800 bg-slate-900 text-slate-300'
                  }`}
                >
                  {f.title.split(' ')[1] ?? f.title}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="font-mono text-slate-400 uppercase">AI Difficulty</div>
            <div className="grid grid-cols-2 gap-1.5">
              {(['recruit', 'commander'] as const).map((diff) => (
                <button
                  key={diff}
                  type="button"
                  onClick={() => setAiDifficulty(diff)}
                  className={`rounded border py-2 px-3 font-semibold capitalize ${
                    aiDifficulty === diff
                      ? 'border-emerald-400 bg-emerald-950/60 text-emerald-200'
                      : 'border-slate-800 bg-slate-900 text-slate-300'
                  }`}
                >
                  {diff}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="rounded border border-slate-700 px-3 py-2 text-slate-300 hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onStartMatch({
                seed: Math.floor(Math.random() * 1_000_000) + 1,
                playerFaction,
                aiFaction,
                aiDifficulty,
                mapId,
              });
              onClose();
            }}
            className="rounded bg-sky-500 px-4 py-2 font-bold text-slate-950 hover:bg-sky-400"
          >
            Launch Match
          </button>
        </div>
      </div>
    </dialog>
  );
}
