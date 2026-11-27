import { useEffect, useRef, useState } from 'react';
import { soundEngine } from '../audio/SoundEngine';
import type { CutsceneScript } from '../data/cutscenes';
import { FastForward, Radio, SkipForward, X } from 'lucide-react';

interface CutsceneModalProps {
  script: CutsceneScript | null;
  onClose: () => void;
}

export function CutsceneModal({ script, onClose }: CutsceneModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [beatIdx, setBeatIdx] = useState(0);
  const [typedLen, setTypedLen] = useState(0);
  const [staticFlash, setStaticFlash] = useState(false);

  const open = Boolean(script);
  const beats = script?.beats ?? [];
  const currentBeat = beats[Math.min(beatIdx, Math.max(0, beats.length - 1))];

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setBeatIdx(0);
      setTypedLen(0);
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open, script?.id]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleClose = () => {
      dialog.returnValue = '';
      soundEngine.stopVoice();
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

  // Play radio static squelch + speak commander voice + animate subtitle typewriter on beat change
  useEffect(() => {
    if (!open || !currentBeat) return;
    setTypedLen(0);
    setStaticFlash(true);
    soundEngine.unlock();
    soundEngine.playRadioStatic();
    soundEngine.speakCommander(currentBeat.line, currentBeat.faction, currentBeat.audioUrl);

    const flashTimer = window.setTimeout(() => setStaticFlash(false), 260);
    const typeTimer = window.setInterval(() => {
      setTypedLen((len) => {
        if (len >= currentBeat.line.length) {
          window.clearInterval(typeTimer);
          return len;
        }
        return len + 2;
      });
    }, 24);

    return () => {
      window.clearTimeout(flashTimer);
      window.clearInterval(typeTimer);
      soundEngine.stopVoice();
    };
  }, [open, beatIdx, currentBeat]);

  const isLastBeat = beatIdx >= beats.length - 1;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="cutscene-title"
      {...({ closedby: 'any' } as Record<string, string>)}
      className="m-auto w-[min(95dvw,46rem)] max-h-[90dvh] rounded-lg border border-sky-500/50 bg-slate-950 text-slate-100 shadow-2xl p-0 overflow-hidden"
    >
      {/* Top Uplink Bar */}
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-4 py-2.5">
        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
          <h1 id="cutscene-title" className="modal-heading font-bold tracking-wider text-sky-200 uppercase">
            {script?.title ?? 'TRANSMISSION'}
          </h1>
        </div>
        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          aria-label="Skip briefing"
          className="rounded border border-slate-700 p-1 text-slate-300 hover:bg-slate-800"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {currentBeat && (
        <div className="flex flex-col">
          {/* 16:9 Live-Action FMV Video Viewport */}
          <div className="relative w-full aspect-video bg-black overflow-hidden">
            <img
              key={`${script?.id}-${beatIdx}`}
              src={currentBeat.image}
              alt={currentBeat.speaker}
              style={{
                filter:
                  currentBeat.faction === 'pact'
                    ? 'brightness(0.82) contrast(1.25) sepia(0.65) hue-rotate(-38deg) saturate(1.8)'
                    : currentBeat.faction === 'axis'
                    ? 'brightness(0.84) contrast(1.22) sepia(0.75) hue-rotate(8deg) saturate(1.5)'
                    : undefined,
              }}
              className="h-full w-full object-cover ken-burns-fmv"
            />
            {/* CRT Scanlines + Cinema Vignette */}
            <div className="pointer-events-none absolute inset-0 crt-scanlines opacity-55" />
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_45%,rgba(2,6,14,0.82)_100%)]" />

            {/* Static Glitch Burst between shots */}
            {staticFlash && (
              <div className="pointer-events-none absolute inset-0 bg-cyan-300/20 backdrop-blur-[1px]" />
            )}

            {/* Top-Left Live Channel HUD */}
            <div className="absolute left-3 top-3 flex items-center gap-2 rounded border border-sky-400/40 bg-slate-950/80 px-2.5 py-1 font-mono text-xs text-sky-200">
              <Radio className="h-3.5 w-3.5 text-rose-400 animate-pulse" />
              <span>{currentBeat.channelCode}</span>
            </div>

            {/* Bottom-Right Voice Equalizer Bars */}
            <div className="absolute right-3 top-3 flex items-end gap-0.5 h-5 px-2 py-1 rounded bg-slate-950/80 border border-slate-700">
              {[0.5, 0.9, 0.65, 1, 0.7].map((h, i) => (
                <span
                  key={i}
                  className="w-1 bg-emerald-400 animate-pulse"
                  style={{
                    height: `${Math.round(h * 100)}%`,
                    animationDelay: `${i * 90}ms`,
                  }}
                />
              ))}
            </div>

            {/* Bottom Subtitle Overlay */}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950 via-slate-950/90 to-transparent px-4 pb-3 pt-8">
              <div className="font-mono text-xs font-bold text-amber-300 tracking-wide">
                {currentBeat.speaker}
              </div>
              <p className="mt-1 text-sm sm:text-base text-slate-100 leading-snug font-medium">
                {currentBeat.line.slice(0, typedLen)}
                {typedLen < currentBeat.line.length && (
                  <span className="inline-block w-2 h-4 bg-cyan-400 ml-0.5 animate-pulse align-middle" />
                )}
              </p>
            </div>
          </div>

          {/* Controls Footer */}
          <div className="flex items-center justify-between gap-2 bg-slate-950 px-4 py-3 border-t border-slate-800 text-xs">
            <div className="flex items-center gap-1.5 font-mono text-slate-400">
              <span>
                TRANSMISSION {beatIdx + 1} / {beats.length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => dialogRef.current?.close()}
                className="flex items-center gap-1 rounded border border-slate-700 px-3 py-2 text-slate-300 hover:bg-slate-800"
              >
                <SkipForward className="h-3.5 w-3.5" />
                Skip
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => {
                  if (!isLastBeat) {
                    setBeatIdx((i) => i + 1);
                  } else {
                    dialogRef.current?.close();
                  }
                }}
                className="flex items-center gap-1.5 rounded bg-sky-500 px-4 py-2 font-bold text-slate-950 hover:bg-sky-400"
              >
                <FastForward className="h-3.5 w-3.5" />
                {isLastBeat ? (script?.actionLabel ?? 'Deploy') : 'Next Transmission'}
              </button>
            </div>
          </div>
        </div>
      )}
    </dialog>
  );
}
