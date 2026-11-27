import { useCallback, useEffect, useRef, useState } from 'react';
import { soundEngine } from './audio/SoundEngine';
import {
  BRIEFING_CUTSCENES,
  getVictoryCutscene,
  type CutsceneScript,
} from './data/cutscenes';
import { getMissionById, type MissionDef } from './data/missions';
import { InputController } from './input/InputController';
import { CanvasRenderer, type ArmedTargeting } from './renderer/CanvasRenderer';
import { DEMO_CHAPTERS, createDemoState, triggerDemoChapter } from './sim/demo';
import { createInitialState, dispatchCommand, stepSimulation } from './sim/engine';
import { deserializeGameState, serializeGameState } from './sim/serialize';
import type { GameState, MatchConfig, OverlayMode, SimCommand } from './sim/types';
import {
  exportSaveToFile,
  importSaveFromFile,
  saveStorage,
  type SaveSlotMeta,
} from './storage';
import { getCompletedMissions, markMissionCompleted } from './storage/campaignProgress';
import { loadUserSettings, saveUserSettings, type UserSettings } from './storage/settings';
import { CampaignModal } from './ui/CampaignModal';
import { CommandSidebar } from './ui/CommandSidebar';
import { CutsceneModal } from './ui/CutsceneModal';
import { DemoHud } from './ui/DemoHud';
import { MissionTracker } from './ui/MissionTracker';
import { NewMatchModal } from './ui/NewMatchModal';
import { RadialMenu, type RadialMenuTarget } from './ui/RadialMenu';
import { SaveLoadModal } from './ui/SaveLoadModal';
import { SettingsModal } from './ui/SettingsModal';
import { SquadBar } from './ui/SquadBar';
import { TopBar } from './ui/TopBar';
import {
  WALKTHROUGH_STEPS,
  WalkthroughOverlay,
  hasCompletedWalkthrough,
} from './ui/WalkthroughOverlay';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DEFAULT_CONFIG: MatchConfig = {
  seed: 202601,
  playerFaction: 'alliance',
  aiFaction: 'pact',
  aiDifficulty: 'commander',
  mapId: 'peninsula_grid',
};

const FIRST_BOOT_CONFIG: MatchConfig = {
  seed: 202600,
  playerFaction: 'alliance',
  aiFaction: 'pact',
  aiDifficulty: 'recruit',
  mapId: 'peninsula_grid',
  missionId: 'boot_sequence',
};

function getConyardCenter(state: GameState): { x: number; y: number } {
  const cy = state.entityOrder
    .map((id) => state.entities[id])
    .find((e) => e && e.ownerId === 'p1' && e.kind === 'building' && e.defId === 'conyard');
  if (cy) return { x: cy.x + 80, y: cy.y - 40 };
  const ts = state.map.tileSize;
  return {
    x: Math.round(state.map.width * 0.14) * ts,
    y: Math.round(state.map.height * 0.8) * ts,
  };
}

export function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const minimapRef = useRef<HTMLCanvasElement>(null);

  const initialFirstBootRef = useRef(!hasCompletedWalkthrough());
  const stateRef = useRef<GameState>(
    createInitialState(initialFirstBootRef.current ? FIRST_BOOT_CONFIG : DEFAULT_CONFIG)
  );
  const rendererRef = useRef<CanvasRenderer>(new CanvasRenderer());
  const inputRef = useRef<InputController | null>(null);

  const overlayRef = useRef<OverlayMode>('tactical');
  const speedRef = useRef<0 | 0.5 | 1 | 2>(1);
  const selectedRef = useRef<Set<string>>(new Set());
  const boxSelectRef = useRef<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const hoverTileRef = useRef<{ tx: number; ty: number } | null>(null);
  const hoverWorldRef = useRef<{ wx: number; wy: number } | null>(null);
  const attackMoveRef = useRef(false);
  const armedTargetingRef = useRef<ArmedTargeting>(null);
  const boxModeRef = useRef(false);
  const seenEffectsRef = useRef<Set<string>>(new Set());
  const recordedWinRef = useRef<string | null>(null);
  const pendingMissionVoiceRef = useRef<string | null>(null);
  const settingsRef = useRef<UserSettings>(loadUserSettings());

  const [hudState, setHudState] = useState<GameState>(() => stateRef.current);
  const [overlayMode, setOverlayMode] = useState<OverlayMode>('tactical');
  const [emVisited, setEmVisited] = useState(false);
  const [simSpeed, setSimSpeed] = useState<0 | 0.5 | 1 | 2>(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [attackMoveArmed, setAttackMoveArmed] = useState(false);
  const [armedTargeting, setArmedTargeting] = useState<ArmedTargeting>(null);
  const [boxSelectMode, setBoxSelectMode] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [newMatchOpen, setNewMatchOpen] = useState(false);
  const [campaignOpen, setCampaignOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<UserSettings>(() => settingsRef.current);
  const [radialMenu, setRadialMenu] = useState<RadialMenuTarget | null>(null);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [completedMissions, setCompletedMissions] = useState<Set<string>>(() => getCompletedMissions());
  const [saveSlots, setSaveSlots] = useState<SaveSlotMeta[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  const [activeCutscene, setActiveCutscene] = useState<CutsceneScript | null>(null);
  const [demoActive, setDemoActive] = useState(false);
  const [demoChapter, setDemoChapter] = useState(0);
  const [demoAutoPlay, setDemoAutoPlay] = useState(true);
  const [walkthroughActive, setWalkthroughActive] = useState(() => initialFirstBootRef.current);
  const [walkthroughStep, setWalkthroughStep] = useState(0);
  const [lastOrderTick, setLastOrderTick] = useState(0);

  const [sfxOn, setSfxOn] = useState(soundEngine.prefs.sfx);
  const [musicOn, setMusicOn] = useState(soundEngine.prefs.music);
  const [voiceOn, setVoiceOn] = useState(soundEngine.prefs.voice);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => {
      setToast((curr) => (curr === msg ? null : curr));
    }, 2600);
  }, []);

  const refreshSlots = useCallback(async () => {
    try {
      const list = await saveStorage.listSlots();
      setSaveSlots(list);
    } catch {
      // IndexedDB unavailable
    }
  }, []);

  const handleDispatch = useCallback((cmd: SimCommand) => {
    soundEngine.unlock();
    soundEngine.playUiClick();
    dispatchCommand(stateRef.current, cmd);
    if (cmd.type === 'moveUnits' || cmd.type === 'attackEntity' || cmd.type === 'captureBuilding') {
      setLastOrderTick((t) => t + 1);
    }
    setHudState({ ...stateRef.current });
  }, []);

  const handleQuickSave = useCallback(async () => {
    try {
      const payload = serializeGameState(stateRef.current);
      await saveStorage.saveSlot('quicksave', 'Quick Save', 'quicksave', payload);
      await refreshSlots();
      showToast('Quick Saved locally (F5)');
    } catch {
      showToast('Save failed — IndexedDB unavailable');
    }
  }, [refreshSlots, showToast]);

  const handleQuickLoad = useCallback(async () => {
    try {
      const rec = await saveStorage.loadSlot('quicksave');
      if (!rec) {
        showToast('No Quick Save found');
        return;
      }
      stateRef.current = rec.payload.state;
      inputRef.current?.setSelection([]);
      setHudState({ ...stateRef.current });
      showToast('Quick Save loaded');
    } catch {
      showToast('Failed to load Quick Save');
    }
  }, [showToast]);

  // Unlock Web Audio on first user interaction + listen for PWA install prompt
  useEffect(() => {
    const unlock = () => soundEngine.unlock();
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const initCam = getConyardCenter(stateRef.current);

    const controller = new InputController(
      canvas,
      {
        getState: () => stateRef.current,
        dispatch: (cmd) => {
          dispatchCommand(stateRef.current, cmd);
          if (
            cmd.type === 'moveUnits' ||
            cmd.type === 'attackEntity' ||
            cmd.type === 'captureBuilding'
          ) {
            setLastOrderTick((t) => t + 1);
          }
        },
        onSelectionChange: (ids) => {
          selectedRef.current = ids;
          setSelectedIds(ids);
        },
        onBoxSelectChange: (box) => {
          boxSelectRef.current = box;
        },
        onHoverTileChange: (tile) => {
          hoverTileRef.current = tile;
        },
        onHoverWorldChange: (world) => {
          hoverWorldRef.current = world;
        },
        onCycleOverlay: () => {
          const order: OverlayMode[] = ['tactical', 'em', 'power'];
          const next = order[(order.indexOf(overlayRef.current) + 1) % order.length];
          overlayRef.current = next;
          setOverlayMode(next);
          if (next === 'em') setEmVisited(true);
          soundEngine.playUiClick();
        },
        onTogglePause: () => {
          const next = speedRef.current === 0 ? 1 : 0;
          speedRef.current = next;
          setSimSpeed(next);
        },
        onQuickSave: () => {
          void handleQuickSave();
        },
        onQuickLoad: () => {
          void handleQuickLoad();
        },
        getAttackMoveArmed: () => attackMoveRef.current,
        clearAttackMoveArmed: () => {
          attackMoveRef.current = false;
          setAttackMoveArmed(false);
        },
        getArmedTargeting: () => armedTargetingRef.current,
        clearArmedTargeting: () => {
          armedTargetingRef.current = null;
          setArmedTargeting(null);
        },
        getBoxSelectMode: () => boxModeRef.current,
        getTouchRadialEnabled: () => settingsRef.current.touchRadialMenu,
        onOpenRadialMenu: (pos) => {
          setRadialMenu(pos);
        },
      },
      { x: initCam.x, y: initCam.y, zoom: 0.9 }
    );
    inputRef.current = controller;
    const detach = controller.attach();

    let rafId = 0;
    let lastTime = performance.now();
    let accumulator = 0;
    let hudSyncAccum = 0;
    const fixedDt = 1 / 20;

    const loop = (now: number) => {
      const frameDt = Math.min(0.1, (now - lastTime) / 1000);
      lastTime = now;

      controller.updateCamera(frameDt);

      const spd = speedRef.current;
      if (spd > 0) {
        accumulator += frameDt * spd;
        let steps = 0;
        while (accumulator >= fixedDt && steps < 6) {
          stepSimulation(stateRef.current);
          accumulator -= fixedDt;
          steps++;
        }
      }

      const st = stateRef.current;

      // Drive procedural SFX & adaptive music intensity from live simulation events
      const seen = seenEffectsRef.current;
      for (const b of st.beams) {
        if (!seen.has(b.id)) {
          seen.add(b.id);
          if (b.kind === 'laser_hel') soundEngine.playLaser();
          else if (b.kind === 'hpm_cone') soundEngine.playHpm();
        }
      }
      for (const ex of st.explosions) {
        if (!seen.has(ex.id)) {
          seen.add(ex.id);
          soundEngine.playExplosion(ex.radius >= 30);
        }
      }
      for (const al of st.alerts) {
        if (!seen.has(al.id)) {
          seen.add(al.id);
          soundEngine.playAlertChime(al.tone === 'danger');
          if (al.tone !== 'info' || al.text.includes('Q-DAY') || al.text.includes('ready')) {
            soundEngine.speakEva(al.text);
          }
        }
      }
      if (seen.size > 400) seen.clear();

      const intensity = Math.min(
        1,
        (st.beams.length * 0.25 + st.explosions.length * 0.3 + st.projectiles.length * 0.1)
      );
      soundEngine.setBattleIntensity(intensity);

      // Record Campaign victory + trigger FMV debrief cutscene
      if (st.winnerId === 'p1' && st.missionId && recordedWinRef.current !== st.missionId) {
        recordedWinRef.current = st.missionId;
        setCompletedMissions(markMissionCompleted(st.missionId));
        const mission = getMissionById(st.missionId);
        speedRef.current = 0;
        setSimSpeed(0);
        setActiveCutscene(
          getVictoryCutscene(st.config.playerFaction, mission?.title ?? st.missionId)
        );
      }

      rendererRef.current.render(
        canvas,
        minimapRef.current,
        st,
        {
          camera: controller.camera,
          overlayMode: overlayRef.current,
          selectedIds: selectedRef.current,
          boxSelect: boxSelectRef.current,
          hoverTile: hoverTileRef.current,
          hoverWorld: hoverWorldRef.current,
          attackMoveArmed: attackMoveRef.current,
          armedTargeting: armedTargetingRef.current,
          colorblindPalette: settingsRef.current.colorblindPalette,
          lowPowerMode: settingsRef.current.lowPowerMode,
        },
        now / 1000
      );

      hudSyncAccum += frameDt;
      if (hudSyncAccum >= 0.1) {
        hudSyncAccum = 0;
        setHudState({ ...st });
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    void refreshSlots();

    return () => {
      cancelAnimationFrame(rafId);
      detach();
    };
  }, [handleQuickLoad, handleQuickSave, refreshSlots]);

  useEffect(() => {
    let autoIdx = 1;
    const timer = window.setInterval(async () => {
      if (speedRef.current === 0 || stateRef.current.winnerId) return;
      try {
        const payload = serializeGameState(stateRef.current);
        await saveStorage.saveSlot(
          `autosave-${autoIdx}`,
          `Autosave #${autoIdx}`,
          'autosave',
          payload
        );
        autoIdx = (autoIdx % 3) + 1;
        await refreshSlots();
      } catch {
        // Ignore silent autosave errors
      }
    }, 120_000);
    return () => window.clearInterval(timer);
  }, [refreshSlots]);

  const selectDemoChapter = useCallback(
    (idx: number) => {
      const normalized = ((idx % DEMO_CHAPTERS.length) + DEMO_CHAPTERS.length) % DEMO_CHAPTERS.length;
      if (!stateRef.current.config.isDemo) {
        stateRef.current = createDemoState();
      }
      const ch = triggerDemoChapter(stateRef.current, normalized);
      setDemoChapter(normalized);
      overlayRef.current = ch.overlayMode;
      setOverlayMode(ch.overlayMode);
      inputRef.current?.setSelection([]);
      inputRef.current?.setCameraCenter(ch.cameraX, ch.cameraY, ch.cameraZoom);
      speedRef.current = 1;
      setSimSpeed(1);
      setHudState({ ...stateRef.current });
    },
    []
  );

  const startDemoMode = useCallback(() => {
    soundEngine.unlock();
    setWalkthroughActive(false);
    setActiveCutscene(null);
    stateRef.current = createDemoState();
    recordedWinRef.current = null;
    seenEffectsRef.current.clear();
    setDemoActive(true);
    setDemoAutoPlay(true);
    selectDemoChapter(0);
    showToast('Feature Showcase Demo started — watch live systems in action');
  }, [selectDemoChapter, showToast]);

  useEffect(() => {
    if (!demoActive || !demoAutoPlay) return;
    const timer = window.setInterval(() => {
      setDemoChapter((curr) => {
        const next = (curr + 1) % DEMO_CHAPTERS.length;
        selectDemoChapter(next);
        return next;
      });
    }, 12_000);
    return () => window.clearInterval(timer);
  }, [demoActive, demoAutoPlay, selectDemoChapter]);

  const startNewMatch = (config: MatchConfig) => {
    const fresh = createInitialState(config);
    stateRef.current = fresh;
    recordedWinRef.current = null;
    seenEffectsRef.current.clear();
    setDemoActive(false);
    inputRef.current?.setSelection([]);
    armedTargetingRef.current = null;
    setArmedTargeting(null);
    setEmVisited(false);
    const cam = getConyardCenter(fresh);
    inputRef.current?.setCameraCenter(cam.x, cam.y, 0.9);
    speedRef.current = 1;
    setSimSpeed(1);
    setHudState({ ...fresh });
    showToast(`Deployed ${config.playerFaction.toUpperCase()} on ${fresh.map.name}`);
  };

  const launchMission = (mission: MissionDef) => {
    setWalkthroughActive(false);
    startNewMatch({
      seed: 2026 + mission.id.length * 131,
      playerFaction: mission.faction,
      aiFaction: mission.enemyFaction,
      aiDifficulty: mission.difficulty,
      mapId: mission.mapId,
      missionId: mission.id,
    });
    const cutscene = BRIEFING_CUTSCENES[mission.id];
    if (cutscene) {
      speedRef.current = 0;
      setSimSpeed(0);
      pendingMissionVoiceRef.current = `${mission.title}. Operation active.`;
      setActiveCutscene(cutscene);
    } else {
      soundEngine.speakEva(`${mission.title}. Operation active.`);
    }
  };

  const replayWalkthrough = () => {
    startNewMatch(FIRST_BOOT_CONFIG);
    setWalkthroughStep(0);
    setLastOrderTick(0);
    setWalkthroughActive(true);
    showToast('Interactive walkthrough restarted');
  };

  const currentTourStep =
    walkthroughActive && walkthroughStep < WALKTHROUGH_STEPS.length
      ? WALKTHROUGH_STEPS[walkthroughStep]
      : undefined;

  return (
    <div className="flex flex-col h-dvh w-dvw overflow-hidden bg-[#070c14] text-slate-100">
      <TopBar
        player={hudState.players.p1}
        elapsedSeconds={hudState.elapsedSeconds}
        kesslerTimer={hudState.kesslerTimer}
        overlayMode={overlayMode}
        onSetOverlay={(mode) => {
          soundEngine.unlock();
          soundEngine.playUiClick();
          overlayRef.current = mode;
          setOverlayMode(mode);
          if (mode === 'em') setEmVisited(true);
        }}
        simSpeed={simSpeed}
        onSetSpeed={(spd) => {
          speedRef.current = spd;
          setSimSpeed(spd);
        }}
        sfxOn={sfxOn}
        musicOn={musicOn}
        voiceOn={voiceOn}
        onToggleSfx={() => {
          soundEngine.unlock();
          setSfxOn(soundEngine.toggleSfx());
        }}
        onToggleMusic={() => {
          soundEngine.unlock();
          setMusicOn(soundEngine.toggleMusic());
        }}
        onToggleVoice={() => {
          soundEngine.unlock();
          setVoiceOn(soundEngine.toggleVoice());
        }}
        canInstallPwa={Boolean(installPrompt)}
        onInstallPwa={() => {
          if (!installPrompt) return;
          void installPrompt.prompt().then(() => setInstallPrompt(null));
        }}
        onQuickSave={() => void handleQuickSave()}
        onOpenSaves={() => {
          void refreshSlots();
          setSaveModalOpen(true);
        }}
        onOpenNewMatch={() => setNewMatchOpen(true)}
        onOpenCampaign={() => setCampaignOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        onStartDemo={startDemoMode}
      />

      <div className="relative flex flex-1 min-h-0 overflow-hidden">
        <main className="relative flex-1 min-w-0 h-full overflow-hidden">
          <canvas
            ref={canvasRef}
            data-tour="battlefield-canvas"
            className="battle-canvas block w-full h-full"
          />
          {settings.crtScanlines && (
            <div className="pointer-events-none fixed inset-0 z-20 crt-scanlines opacity-55" />
          )}

          {hudState.players.p1.ransomwareTimer > 0 && (
            <div className="fixed left-1/2 top-14 -translate-x-1/2 z-20 flex items-center gap-3 rounded border border-rose-500 bg-rose-950/95 px-3.5 py-2 text-xs shadow-xl">
              <span className="font-bold text-rose-200">
                RANSOMWARE LOCK ({Math.ceil(hudState.players.p1.ransomwareTimer)}s)
              </span>
              <button
                type="button"
                disabled={hudState.players.p1.silicon < 350}
                onClick={() => handleDispatch({ type: 'payRansom', playerId: 'p1' })}
                className="rounded bg-amber-400 px-2.5 py-1 font-bold text-slate-950 hover:bg-amber-300 disabled:opacity-40"
              >
                Pay 350 Si Ransom
              </button>
            </div>
          )}

          {/* Live Tactical Alerts */}
          <div className="pointer-events-none fixed left-2 top-14 z-10 flex flex-col gap-1 max-w-xs sm:max-w-sm">
            {hudState.alerts.map((a) => (
              <div
                key={a.id}
                className={`rounded border px-2.5 py-1.5 text-xs font-medium backdrop-blur-md shadow ${
                  a.tone === 'danger'
                    ? 'border-rose-500/70 bg-rose-950/85 text-rose-100'
                    : a.tone === 'warn'
                    ? 'border-amber-500/70 bg-amber-950/85 text-amber-100'
                    : 'border-sky-500/50 bg-slate-950/85 text-sky-100'
                }`}
              >
                {a.text}
              </div>
            ))}
          </div>

          <MissionTracker state={hudState} emVisited={emVisited} overlayMode={overlayMode} />

          {toast && (
            <div className="pointer-events-none fixed left-1/2 top-24 -translate-x-1/2 z-30 rounded-full border border-cyan-400/60 bg-slate-950/90 px-4 py-1.5 text-xs font-semibold text-cyan-200 shadow-lg">
              {toast}
            </div>
          )}

          {hudState.winnerId && (
            <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm">
              <div className="rounded-lg border border-sky-500/50 bg-slate-950 p-6 text-center space-y-4 max-w-sm mx-4 shadow-2xl">
                <h2 className="text-xl font-bold tracking-wider uppercase text-sky-300">
                  {hudState.winnerId === 'p1' ? 'Sector Secured — Victory' : 'Command Lost — Defeat'}
                </h2>
                <p className="text-xs text-slate-300">
                  {hudState.winnerId === 'p1'
                    ? 'Enemy command infrastructure neutralized.'
                    : 'All friendly command yards and MCVs destroyed.'}
                </p>
                <div className="flex justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCampaignOpen(true)}
                    className="rounded border border-amber-400/50 px-4 py-2 text-xs font-bold text-amber-200 hover:bg-amber-950/60"
                  >
                    Campaign
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewMatchOpen(true)}
                    className="rounded bg-sky-500 px-5 py-2 text-xs font-bold text-slate-950 hover:bg-sky-400"
                  >
                    New Skirmish
                  </button>
                </div>
              </div>
            </div>
          )}

          <SquadBar
            state={hudState}
            selectedIds={selectedIds}
            onSelectIds={(ids) => inputRef.current?.setSelection(ids)}
          />

          {demoActive && (
            <DemoHud
              chapterIndex={demoChapter}
              autoPlay={demoAutoPlay}
              onSelectChapter={(idx) => {
                setDemoAutoPlay(false);
                selectDemoChapter(idx);
              }}
              onToggleAutoPlay={() => setDemoAutoPlay((v) => !v)}
              onExitDemo={() => {
                setDemoActive(false);
                startNewMatch(DEFAULT_CONFIG);
              }}
            />
          )}
        </main>

        <CommandSidebar
          state={hudState}
          minimapRef={minimapRef}
          selectedIds={selectedIds}
          attackMoveArmed={attackMoveArmed}
          boxSelectMode={boxSelectMode}
          armedTargeting={armedTargeting}
          onArmTargeting={(tgt) => {
            armedTargetingRef.current = tgt;
            setArmedTargeting(tgt);
          }}
          onToggleAttackMove={() => {
            const next = !attackMoveRef.current;
            attackMoveRef.current = next;
            setAttackMoveArmed(next);
          }}
          onToggleBoxSelectMode={() => {
            const next = !boxModeRef.current;
            boxModeRef.current = next;
            setBoxSelectMode(next);
          }}
          onDispatch={handleDispatch}
          onPanMinimap={(wx, wy) => inputRef.current?.setCameraCenter(wx, wy)}
          forcedTab={currentTourStep?.forceTab ?? null}
          forcedMobileOpen={currentTourStep?.forceMobileDrawer}
        />
      </div>

      <SaveLoadModal
        open={saveModalOpen}
        onClose={() => setSaveModalOpen(false)}
        providerLabel={saveStorage.getProviderLabel()}
        slots={saveSlots}
        onSaveNamed={async (name) => {
          const payload = serializeGameState(stateRef.current);
          const id = `slot-${Date.now()}`;
          await saveStorage.saveSlot(id, name, 'manual', payload);
          await refreshSlots();
          showToast(`Saved "${name}"`);
        }}
        onLoadSlot={async (id) => {
          const rec = await saveStorage.loadSlot(id);
          if (!rec) return;
          stateRef.current = deserializeGameState(rec.payload);
          inputRef.current?.setSelection([]);
          setHudState({ ...stateRef.current });
          setSaveModalOpen(false);
          showToast(`Loaded "${rec.meta.name}"`);
        }}
        onDeleteSlot={async (id) => {
          await saveStorage.deleteSlot(id);
          await refreshSlots();
        }}
        onExportCurrent={() => {
          const payload = serializeGameState(stateRef.current);
          exportSaveToFile(payload, `silicon-dawn-t${stateRef.current.tick}`);
          showToast('Exported .sdawn save file');
        }}
        onImportFile={async (file) => {
          const { state } = await importSaveFromFile(file);
          stateRef.current = state;
          inputRef.current?.setSelection([]);
          setHudState({ ...stateRef.current });
          setSaveModalOpen(false);
          showToast(`Imported ${file.name}`);
        }}
      />

      <NewMatchModal
        open={newMatchOpen}
        onClose={() => setNewMatchOpen(false)}
        onStartMatch={startNewMatch}
      />

      <CampaignModal
        open={campaignOpen}
        onClose={() => setCampaignOpen(false)}
        completedIds={completedMissions}
        onLaunchMission={launchMission}
      />

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={(next) => {
          settingsRef.current = next;
          setSettings(next);
          saveUserSettings(next);
        }}
        onReplayWalkthrough={replayWalkthrough}
      />

      <RadialMenu
        target={radialMenu}
        state={hudState}
        selectedIds={selectedIds}
        onDispatch={handleDispatch}
        onClose={() => setRadialMenu(null)}
      />

      <CutsceneModal
        script={activeCutscene}
        onClose={() => {
          setActiveCutscene(null);
          if (!stateRef.current.winnerId) {
            speedRef.current = 1;
            setSimSpeed(1);
          }
          if (pendingMissionVoiceRef.current) {
            soundEngine.speakEva(pendingMissionVoiceRef.current);
            pendingMissionVoiceRef.current = null;
          }
        }}
      />

      <WalkthroughOverlay
        active={walkthroughActive && !activeCutscene && !demoActive}
        step={walkthroughStep}
        state={hudState}
        selectedIds={selectedIds}
        overlayMode={overlayMode}
        lastOrderTick={lastOrderTick}
        onSetStep={setWalkthroughStep}
        onClose={() => setWalkthroughActive(false)}
        onLaunchDemo={startDemoMode}
        onOpenCampaign={() => {
          setWalkthroughActive(false);
          setCampaignOpen(true);
        }}
      />
    </div>
  );
}
export default App;
