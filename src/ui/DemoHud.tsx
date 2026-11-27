import { DEMO_CHAPTERS, type DemoChapter } from '../sim/demo';
import { ChevronLeft, ChevronRight, Pause, Play, Sparkles, X } from 'lucide-react';

interface DemoHudProps {
  chapterIndex: number;
  autoPlay: boolean;
  onSelectChapter: (idx: number) => void;
  onToggleAutoPlay: () => void;
  onExitDemo: () => void;
}

export function DemoHud({
  chapterIndex,
  autoPlay,
  onSelectChapter,
  onToggleAutoPlay,
  onExitDemo,
}: DemoHudProps) {
  const ch: DemoChapter = DEMO_CHAPTERS[chapterIndex] ?? DEMO_CHAPTERS[0];

  return (
    <div className="pointer-events-auto fixed left-1/2 bottom-3 -translate-x-1/2 z-30 w-[min(94dvw,38rem)] rounded-lg border border-cyan-400/60 bg-slate-950/92 backdrop-blur-md px-3.5 py-2.5 shadow-2xl text-xs space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 font-mono font-bold text-cyan-300">
          <Sparkles className="h-3.5 w-3.5 text-amber-300" />
          <span>FEATURE SHOWCASE DEMO</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onToggleAutoPlay}
            className="flex items-center gap-1 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-slate-200 hover:border-cyan-400"
          >
            {autoPlay ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
            <span>{autoPlay ? 'Auto' : 'Paused'}</span>
          </button>
          <button
            type="button"
            onClick={onExitDemo}
            className="flex items-center gap-1 rounded bg-sky-500 px-2.5 py-1 font-bold text-slate-950 hover:bg-sky-400"
          >
            <X className="h-3 w-3" />
            Exit Demo
          </button>
        </div>
      </div>

      <div>
        <div className="font-bold text-slate-100 text-sm">{ch.title}</div>
        <p className="text-slate-300 mt-0.5 leading-snug">{ch.summary}</p>
      </div>

      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800">
        <button
          type="button"
          onClick={() => onSelectChapter((chapterIndex - 1 + DEMO_CHAPTERS.length) % DEMO_CHAPTERS.length)}
          className="flex items-center gap-1 rounded border border-slate-700 px-2 py-1 text-slate-200 hover:border-sky-400"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Prev
        </button>
        <div className="flex items-center gap-1.5">
          {DEMO_CHAPTERS.map((item, idx) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectChapter(idx)}
              title={item.title}
              className={`h-2.5 rounded-full transition-all ${
                idx === chapterIndex ? 'w-6 bg-cyan-400' : 'w-2.5 bg-slate-700 hover:bg-slate-500'
              }`}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => onSelectChapter((chapterIndex + 1) % DEMO_CHAPTERS.length)}
          className="flex items-center gap-1 rounded border border-slate-700 px-2 py-1 text-slate-200 hover:border-sky-400"
        >
          Next
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
