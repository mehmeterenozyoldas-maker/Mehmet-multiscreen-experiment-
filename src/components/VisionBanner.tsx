import type { InteractionMode, VisionState } from '../engine/types';

interface VisionBannerProps {
  mode: InteractionMode;
  vision: VisionState;
  onFallbackToGravity: () => void;
}

export function VisionBanner({ mode, vision, onFallbackToGravity }: VisionBannerProps) {
  if (mode === 'GRAVITY' || vision.status === 'active' || vision.status === 'idle') {
    return null;
  }

  return (
    <div
      role="status"
      className="pointer-events-auto fixed top-5 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-lg border border-white/10 bg-[#0B0F17]/92 px-3.5 py-2 text-xs text-slate-200 shadow-lg"
    >
      <span>
        {vision.status === 'starting'
          ? `Initializing ${mode === 'WIND' ? 'FaceMesh Wind' : 'Hand Sculpt'} camera stream...`
          : vision.errorMessage ?? 'Camera input unavailable. Using mouse gravity.'}
      </span>
      <button
        type="button"
        onClick={onFallbackToGravity}
        className="rounded border border-white/14 bg-white/[0.06] px-2.5 py-1 text-xs font-medium text-[#38BDF8] hover:bg-white/[0.12] whitespace-nowrap"
      >
        Switch to Gravity
      </button>
    </div>
  );
}
