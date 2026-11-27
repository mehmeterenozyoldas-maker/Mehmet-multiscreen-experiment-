import type { EngineTelemetry, HandGesture, InteractionMode, VisionState } from '../engine/types';

interface TopReadoutProps {
  telemetry: EngineTelemetry;
  mode: InteractionMode;
  vision: VisionState;
  hudHidden: boolean;
}

function formatGestureLabel(gesture: HandGesture): string {
  switch (gesture) {
    case 'PINCH':
      return 'Pinch Condense';
    case 'PALM':
      return 'Palm Vortex';
    case 'SPREAD':
      return 'Two-Hand Burst';
    default:
      return 'Awaiting Hand';
  }
}

export function TopReadout({ telemetry, mode, vision, hudHidden }: TopReadoutProps) {
  const backendLabel =
    telemetry.backend === 'webgpu'
      ? 'WebGPU'
      : telemetry.backend === 'webgl2'
        ? 'WebGL2 Fallback'
        : 'Initializing';

  const nodeLabel = telemetry.nodeCount === 1 ? '1 Node' : `${telemetry.nodeCount} Nodes`;

  return (
    <header
      className={`pointer-events-none fixed top-5 left-6 z-20 transition-all duration-150 ease-out ${
        hudHidden ? 'opacity-0 -translate-y-2' : 'opacity-100 translate-y-0'
      }`}
    >
      <div className="flex flex-col gap-1">
        <div className="flex items-baseline gap-3">
          <h1
            className="text-lg font-semibold tracking-tight text-slate-100 whitespace-nowrap"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Neural Singularity
          </h1>
          <span className="text-xs font-mono tabular-nums text-slate-400 whitespace-nowrap">
            {backendLabel}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <span
            className={`font-mono tabular-nums whitespace-nowrap ${
              telemetry.nodeCount > 1 ? 'text-[#A78BFA]' : 'text-[#38BDF8]'
            }`}
            data-testid="node-count-readout"
          >
            {nodeLabel}
          </span>
          <span aria-hidden="true">·</span>
          <span className="font-mono tabular-nums whitespace-nowrap">
            {telemetry.particleCount.toLocaleString()} GPU Particles
          </span>
          <span aria-hidden="true">·</span>
          <span className="font-mono tabular-nums whitespace-nowrap">
            {telemetry.fps} FPS
          </span>
          {mode === 'WIND' && vision.status === 'active' && (
            <>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums text-[#38BDF8] whitespace-nowrap">
                Blow {Math.round(vision.blowStrength * 100)}%
              </span>
            </>
          )}
          {mode === 'HAND' && vision.status === 'active' && (
            <>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums text-[#F59E0B] whitespace-nowrap">
                {formatGestureLabel(vision.handGesture)}
              </span>
            </>
          )}
        </div>
        <div className="text-[11px] font-mono tabular-nums text-slate-500">
          Drag to Orbit · Scroll to Zoom · Click to Pulse · R to Reset
        </div>
      </div>
    </header>
  );
}
