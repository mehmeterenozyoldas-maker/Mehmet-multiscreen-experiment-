import { useCallback, useEffect, useRef, useState } from 'react';
import { BottomDock } from './components/BottomDock';
import { MetapromptStudio } from './components/MetapromptStudio';
import { TopReadout } from './components/TopReadout';
import { VisionBanner } from './components/VisionBanner';
import { DEFAULT_METAPROMPT_MODULES } from './engine/metapromptBuilder';
import { extractTuningFromPreset, VFX_PRESETS } from './engine/presets';
import { PARTICLE_COUNT, SingularityEngine } from './engine/SingularityEngine';
import type {
  EngineTelemetry,
  InteractionMode,
  MetapromptModules,
  MinimapNode,
  VfxPreset,
  VfxTuning,
  VisionState,
  WorldBounds,
} from './engine/types';
import { UnifiedVisionTracker } from './services/visionTracker';
import { WindowSyncChannel } from './services/windowSyncChannel';

const INITIAL_PRESET = VFX_PRESETS[0];

const INITIAL_BOUNDS: WorldBounds = {
  minX: 0,
  minY: 0,
  maxX: 1440,
  maxY: 900,
  width: 1440,
  height: 900,
  centerX: 720,
  centerY: 450,
  nodeCount: 1,
};

const INITIAL_VISION: VisionState = {
  status: 'idle',
  errorMessage: null,
  emitterX: 0,
  emitterY: 0,
  blowStrength: 0,
  handGesture: 'NONE',
  handEnergy: 0,
  detectedHands: 0,
};

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<SingularityEngine | null>(null);
  const syncRef = useRef<WindowSyncChannel | null>(null);
  const visionRef = useRef<UnifiedVisionTracker | null>(null);

  const [mode, setMode] = useState<InteractionMode>('GRAVITY');
  const modeRef = useRef<InteractionMode>('GRAVITY');

  const [activePreset, setActivePreset] = useState<VfxPreset>(INITIAL_PRESET);
  const [tuning, setTuning] = useState<VfxTuning>(() => extractTuningFromPreset(INITIAL_PRESET));
  const [hudHidden, setHudHidden] = useState(false);
  const [metapromptOpen, setMetapromptOpen] = useState(false);
  const [metapromptModules, setMetapromptModules] = useState<MetapromptModules>(
    DEFAULT_METAPROMPT_MODULES
  );

  const [telemetry, setTelemetry] = useState<EngineTelemetry>({
    backend: 'initializing',
    particleCount: PARTICLE_COUNT,
    nodeCount: 1,
    fps: 60,
    isSoftwareGl: false,
  });

  const [minimapNodes, setMinimapNodes] = useState<MinimapNode[]>([]);
  const [bounds, setBounds] = useState<WorldBounds>(INITIAL_BOUNDS);
  const [vision, setVision] = useState<VisionState>(INITIAL_VISION);
  const [engineError, setEngineError] = useState<string | null>(null);

  const lastMinimapUpdateRef = useRef(0);
  const pointerRef = useRef({ x: 0, y: 0 });
  const dragStateRef = useRef({
    down: false,
    moved: false,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
  });

  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    const engine = new SingularityEngine(mount, INITIAL_PRESET, {
      onTelemetry: (next) => setTelemetry(next),
      onError: (msg) => setEngineError(msg),
    });
    engineRef.current = engine;
    void engine.init();

    const sync = new WindowSyncChannel();
    syncRef.current = sync;

    sync.onShockwave((x, y, energy) => {
      engine.triggerShockwave(x, y, energy);
    });

    sync.onChange((snapshot) => {
      engine.setSpatialSync(
        snapshot.offset.x,
        snapshot.offset.y,
        snapshot.bounds.nodeCount,
        snapshot.links
      );

      const now = performance.now();
      if (now - lastMinimapUpdateRef.current >= 140) {
        lastMinimapUpdateRef.current = now;
        setBounds(snapshot.bounds);
        setMinimapNodes(snapshot.minimapNodes);
      }
    });

    const tracker = new UnifiedVisionTracker();
    visionRef.current = tracker;
    tracker.onStateChange((nextVision) => {
      setVision(nextVision);
      engine.setInteractionInput(
        modeRef.current,
        nextVision.blowStrength,
        nextVision.emitterX,
        nextVision.emitterY,
        nextVision.handGesture,
        nextVision.handEnergy
      );
      sync.setLocalInteraction(
        modeRef.current,
        nextVision.handGesture,
        pointerRef.current.x,
        pointerRef.current.y
      );
    });

    return () => {
      tracker.dispose();
      sync.dispose();
      engine.dispose();
      visionRef.current = null;
      syncRef.current = null;
      engineRef.current = null;
    };
  }, []);

  // Keyboard shortcuts: H toggles Cinema / Zen mode, R resets 3D orbit camera
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (metapromptOpen) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      if (e.key === 'h' || e.key === 'H') {
        setHudHidden((prev) => !prev);
      } else if (e.key === 'r' || e.key === 'R') {
        engineRef.current?.resetCamera();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [metapromptOpen]);

  const handleModeChange = useCallback((nextMode: InteractionMode) => {
    setMode(nextMode);
    modeRef.current = nextMode;
    engineRef.current?.setInteractionInput(nextMode, 0, pointerRef.current.x, pointerRef.current.y, 'NONE', 0);
    syncRef.current?.setLocalInteraction(nextMode, 'NONE', pointerRef.current.x, pointerRef.current.y);
    void visionRef.current?.setMode(nextMode);
  }, []);

  const handleSelectPreset = useCallback((preset: VfxPreset) => {
    setActivePreset(preset);
    const nextTuning = extractTuningFromPreset(preset);
    setTuning(nextTuning);
    engineRef.current?.applyPreset(preset, false);
  }, []);

  const handleTuningChange = useCallback((nextTuning: VfxTuning) => {
    setTuning(nextTuning);
    engineRef.current?.updateTuning(nextTuning);
  }, []);

  const handleSpawnWindow = useCallback(() => {
    return syncRef.current?.spawnSiblingWindow() ?? false;
  }, []);

  const handleToggleModule = useCallback((key: keyof MetapromptModules) => {
    setMetapromptModules((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleStagePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const nx = (e.clientX / Math.max(1, window.innerWidth)) * 2 - 1;
      const ny = -(e.clientY / Math.max(1, window.innerHeight)) * 2 + 1;
      pointerRef.current = { x: nx, y: ny };
      engineRef.current?.setPointer(nx, ny);
      syncRef.current?.setLocalInteraction(modeRef.current, vision.handGesture, nx, ny);

      const drag = dragStateRef.current;
      if (drag.down) {
        const dx = e.clientX - drag.lastX;
        const dy = e.clientY - drag.lastY;
        drag.lastX = e.clientX;
        drag.lastY = e.clientY;
        const distSq =
          (e.clientX - drag.startX) * (e.clientX - drag.startX) +
          (e.clientY - drag.startY) * (e.clientY - drag.startY);
        if (distSq > 36) {
          drag.moved = true;
        }
        if (drag.moved) {
          engineRef.current?.orbitBy(-dx * 0.0065, dy * 0.0055);
        }
      }
    },
    [vision.handGesture]
  );

  const handleStagePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    dragStateRef.current = {
      down: true,
      moved: false,
      startX: e.clientX,
      startY: e.clientY,
      lastX: e.clientX,
      lastY: e.clientY,
    };
  }, []);

  const handleStagePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragStateRef.current;
    if (!drag.down) return;
    const wasMoved = drag.moved;
    drag.down = false;
    drag.moved = false;

    if (!wasMoved) {
      const nx = (e.clientX / Math.max(1, window.innerWidth)) * 2 - 1;
      const ny = -(e.clientY / Math.max(1, window.innerHeight)) * 2 + 1;
      engineRef.current?.triggerShockwave(nx, ny, 1.0);
      syncRef.current?.broadcastShockwave(nx, ny, 1.0);
    }
  }, []);

  const handleStageWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    engineRef.current?.dollyBy(e.deltaY * 0.0045);
  }, []);

  const handleStageDoubleClick = useCallback(() => {
    engineRef.current?.resetCamera();
  }, []);

  return (
    <main
      className="relative h-screen w-screen overflow-hidden bg-[#05070B]"
      data-mode={mode}
      data-backend={telemetry.backend}
      data-hud={hudHidden ? 'hidden' : 'visible'}
    >
      {/* Full-bleed 3D VFX Stage */}
      <div
        ref={canvasMountRef}
        onPointerMove={handleStagePointerMove}
        onPointerDown={handleStagePointerDown}
        onPointerUp={handleStagePointerUp}
        onPointerCancel={handleStagePointerUp}
        onWheel={handleStageWheel}
        onDoubleClick={handleStageDoubleClick}
        className="absolute inset-0 h-full w-full cursor-crosshair touch-none"
        aria-label="Interactive 3D Neural Singularity Stage"
      />

      {/* Graceful fallback only if WebGPU and WebGL2 both fail */}
      {engineError && (
        <div
          role="alert"
          className="fixed inset-0 z-40 flex items-center justify-center bg-[#05070B]/95 p-6 text-center"
        >
          <div className="max-w-md rounded-xl border border-white/10 bg-[#0B0F17] p-6">
            <h2
              className="text-base font-semibold text-slate-100"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              3D Graphics Context Unavailable
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">{engineError}</p>
          </div>
        </div>
      )}

      <TopReadout
        telemetry={telemetry}
        mode={mode}
        vision={vision}
        hudHidden={hudHidden || metapromptOpen}
      />

      <VisionBanner
        mode={mode}
        vision={vision}
        onFallbackToGravity={() => handleModeChange('GRAVITY')}
      />

      <BottomDock
        mode={mode}
        onModeChange={handleModeChange}
        activePreset={activePreset}
        onSelectPreset={handleSelectPreset}
        tuning={tuning}
        onTuningChange={handleTuningChange}
        minimapNodes={minimapNodes}
        bounds={bounds}
        onSpawnWindow={handleSpawnWindow}
        onOpenMetaprompt={() => setMetapromptOpen(true)}
        hudHidden={hudHidden || metapromptOpen}
        onToggleHud={() => setHudHidden((prev) => !prev)}
      />

      <MetapromptStudio
        open={metapromptOpen}
        onClose={() => setMetapromptOpen(false)}
        modules={metapromptModules}
        onToggleModule={handleToggleModule}
      />
    </main>
  );
}
