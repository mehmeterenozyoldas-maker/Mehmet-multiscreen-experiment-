import { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileCode2,
  Hand,
  MousePointerClick,
  Network,
  Plus,
  SlidersHorizontal,
  Wind,
} from 'lucide-react';
import type {
  InteractionMode,
  MinimapNode,
  VfxPreset,
  VfxTuning,
  WorldBounds,
} from '../engine/types';
import { VFX_PRESETS } from '../engine/presets';

interface BottomDockProps {
  mode: InteractionMode;
  onModeChange: (mode: InteractionMode) => void;
  activePreset: VfxPreset;
  onSelectPreset: (preset: VfxPreset) => void;
  tuning: VfxTuning;
  onTuningChange: (tuning: VfxTuning) => void;
  minimapNodes: MinimapNode[];
  bounds: WorldBounds;
  onSpawnWindow: () => boolean;
  onOpenMetaprompt: () => void;
  hudHidden: boolean;
  onToggleHud: () => void;
}

type ActivePopover = 'none' | 'vfx' | 'topology';

export function BottomDock({
  mode,
  onModeChange,
  activePreset,
  onSelectPreset,
  tuning,
  onTuningChange,
  minimapNodes,
  bounds,
  onSpawnWindow,
  onOpenMetaprompt,
  hudHidden,
  onToggleHud,
}: BottomDockProps) {
  const [popover, setPopover] = useState<ActivePopover>('none');
  const [popupBlocked, setPopupBlocked] = useState(false);

  const togglePopover = (target: ActivePopover) => {
    setPopover((prev) => (prev === target ? 'none' : target));
  };

  const handleNewWindow = () => {
    const opened = onSpawnWindow();
    if (!opened) {
      setPopupBlocked(true);
      setPopover('topology');
    } else {
      setPopupBlocked(false);
    }
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-30 flex flex-col items-center px-4">
      {/* Popovers anchored cleanly above the bottom dock */}
      {!hudHidden && popover === 'vfx' && (
        <section
          aria-label="VFX Presets and Optics Tuning"
          className="pointer-events-auto mb-3 w-full max-w-[600px] rounded-xl border border-white/10 bg-[#0B0F17]/95 p-4 text-slate-200 shadow-2xl"
        >
          <div className="mb-3 flex items-center justify-between gap-4">
            <h2
              className="text-sm font-semibold text-slate-100"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              VFX Presets & Optical Tuning
            </h2>
            <span className="text-xs text-slate-400">{activePreset.name}</span>
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            {VFX_PRESETS.map((preset) => {
              const selected = preset.id === activePreset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => onSelectPreset(preset)}
                  className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs font-medium transition-colors whitespace-nowrap ${
                    selected
                      ? 'border-[#38BDF8]/70 bg-[#38BDF8]/12 text-slate-50'
                      : 'border-white/8 bg-white/[0.03] text-slate-300 hover:border-white/20 hover:text-white'
                  }`}
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-sm"
                    style={{ backgroundColor: preset.midColor }}
                    aria-hidden="true"
                  />
                  <span>{preset.name}</span>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-xs text-slate-300">
              <div className="flex items-center justify-between">
                <span>HDR Bloom</span>
                <span className="font-mono tabular-nums text-slate-400">
                  {tuning.bloomStrength.toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min={0.1}
                max={1.8}
                step={0.02}
                value={tuning.bloomStrength}
                onChange={(e) =>
                  onTuningChange({ ...tuning, bloomStrength: parseFloat(e.target.value) })
                }
                className="h-1.5 w-full cursor-pointer accent-[#38BDF8]"
              />
            </label>

            <label className="flex flex-col gap-1.5 text-xs text-slate-300">
              <div className="flex items-center justify-between">
                <span>Glass Dispersion</span>
                <span className="font-mono tabular-nums text-slate-400">
                  {tuning.dispersion.toFixed(3)}
                </span>
              </div>
              <input
                type="range"
                min={0.005}
                max={0.14}
                step={0.002}
                value={tuning.dispersion}
                onChange={(e) =>
                  onTuningChange({ ...tuning, dispersion: parseFloat(e.target.value) })
                }
                className="h-1.5 w-full cursor-pointer accent-[#38BDF8]"
              />
            </label>

            <label className="flex flex-col gap-1.5 text-xs text-slate-300">
              <div className="flex items-center justify-between">
                <span>Curl Turbulence</span>
                <span className="font-mono tabular-nums text-slate-400">
                  {tuning.turbulence.toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min={0.2}
                max={2.4}
                step={0.05}
                value={tuning.turbulence}
                onChange={(e) =>
                  onTuningChange({ ...tuning, turbulence: parseFloat(e.target.value) })
                }
                className="h-1.5 w-full cursor-pointer accent-[#38BDF8]"
              />
            </label>

            <label className="flex flex-col gap-1.5 text-xs text-slate-300">
              <div className="flex items-center justify-between">
                <span>Bokeh DOF Span</span>
                <span className="font-mono tabular-nums text-slate-400">
                  {tuning.dofFocalLength.toFixed(1)}
                </span>
              </div>
              <input
                type="range"
                min={4.0}
                max={28.0}
                step={0.5}
                value={tuning.dofFocalLength}
                onChange={(e) =>
                  onTuningChange({ ...tuning, dofFocalLength: parseFloat(e.target.value) })
                }
                className="h-1.5 w-full cursor-pointer accent-[#38BDF8]"
              />
            </label>
          </div>
        </section>
      )}

      {!hudHidden && popover === 'topology' && (
        <section
          aria-label="Multi-Window Spatial Topology"
          className="pointer-events-auto mb-3 w-full max-w-[460px] rounded-xl border border-white/10 bg-[#0B0F17]/95 p-4 text-slate-200 shadow-2xl"
        >
          <div className="mb-3 flex items-center justify-between gap-4">
            <div>
              <h2
                className="text-sm font-semibold text-slate-100"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Spatial Window Topology
              </h2>
              <p className="text-xs text-slate-400">
                Drag windows across your desktop to inject inertia and stretch filaments.
              </p>
            </div>
            <span className="font-mono text-xs tabular-nums text-[#A78BFA] whitespace-nowrap">
              {Math.round(bounds.width)}×{Math.round(bounds.height)}
            </span>
          </div>

          <div
            className="relative mb-3 h-36 w-full overflow-hidden rounded-lg border border-white/8 bg-[#05070B]"
            data-testid="topology-minimap"
          >
            {minimapNodes.map((node) => (
              <div
                key={node.id}
                style={{
                  left: `${node.leftPct}%`,
                  top: `${node.topPct}%`,
                  width: `${node.widthPct}%`,
                  height: `${node.heightPct}%`,
                }}
                className={`absolute flex flex-col justify-between rounded border p-1.5 ${
                  node.isSelf
                    ? 'border-[#38BDF8]/80 bg-[#38BDF8]/12 text-[#38BDF8]'
                    : 'border-[#A78BFA]/70 bg-[#A78BFA]/12 text-[#A78BFA]'
                }`}
              >
                <span className="truncate font-mono text-[10px] font-medium">
                  {node.isSelf ? 'This Window' : node.id}
                </span>
                <span className="font-mono text-[10px] tabular-nums opacity-80">
                  {node.screenX},{node.screenY}
                </span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleNewWindow}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 bg-white/[0.06] px-3 py-2 text-xs font-medium text-slate-100 transition-colors hover:bg-white/[0.12] whitespace-nowrap"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Spawn Sibling Window</span>
            </button>

            <a
              href={typeof window !== 'undefined' ? window.location.href : '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-[#38BDF8] hover:underline whitespace-nowrap"
            >
              <span>Open in New Tab</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>

          {popupBlocked && (
            <p className="mt-2.5 text-xs text-[#F59E0B]">
              Popup window was blocked by the browser frame. Use Open in New Tab to test multi-window sync.
            </p>
          )}
        </section>
      )}

      {/* Collapse / Expand Handle */}
      <button
        type="button"
        onClick={onToggleHud}
        aria-expanded={!hudHidden}
        aria-label={hudHidden ? 'Show Controls' : 'Hide Controls'}
        className="pointer-events-auto mb-1.5 inline-flex h-7 items-center gap-1.5 rounded-md border border-white/10 bg-[#0B0F17]/90 px-3 text-[11px] font-medium text-slate-300 transition-colors hover:border-white/20 hover:text-white whitespace-nowrap"
      >
        {hudHidden ? (
          <>
            <ChevronUp className="h-3.5 w-3.5" />
            <span>Show Controls (H)</span>
          </>
        ) : (
          <>
            <ChevronDown className="h-3.5 w-3.5" />
            <span>Hide Controls (H)</span>
          </>
        )}
      </button>

      {/* Primary Bottom Control Dock (no backdrop-filter over canvas) */}
      <nav
        aria-label="VFX Controls"
        className={`pointer-events-auto flex max-w-[94vw] flex-wrap items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#0B0F17]/90 px-3 py-2 shadow-2xl transition-all duration-150 ease-out ${
          hudHidden
            ? 'pointer-events-none translate-y-6 opacity-0'
            : 'translate-y-0 opacity-100'
        }`}
      >
        {/* Interaction Mode Segmented Switcher */}
        <div
          role="group"
          aria-label="Interaction Mode"
          className="flex items-center gap-1 rounded-lg bg-[#05070B]/80 p-1 border border-white/6"
        >
          <button
            type="button"
            onClick={() => onModeChange('GRAVITY')}
            aria-pressed={mode === 'GRAVITY'}
            className={`inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              mode === 'GRAVITY'
                ? 'bg-[#38BDF8]/18 text-[#38BDF8] border border-[#38BDF8]/40'
                : 'text-slate-300 hover:text-white border border-transparent'
            }`}
          >
            <MousePointerClick className="h-3.5 w-3.5" />
            <span>Gravity</span>
          </button>

          <button
            type="button"
            onClick={() => onModeChange('WIND')}
            aria-pressed={mode === 'WIND'}
            className={`inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              mode === 'WIND'
                ? 'bg-[#38BDF8]/18 text-[#38BDF8] border border-[#38BDF8]/40'
                : 'text-slate-300 hover:text-white border border-transparent'
            }`}
          >
            <Wind className="h-3.5 w-3.5" />
            <span>Wind</span>
          </button>

          <button
            type="button"
            onClick={() => onModeChange('HAND')}
            aria-pressed={mode === 'HAND'}
            className={`inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              mode === 'HAND'
                ? 'bg-[#38BDF8]/18 text-[#38BDF8] border border-[#38BDF8]/40'
                : 'text-slate-300 hover:text-white border border-transparent'
            }`}
          >
            <Hand className="h-3.5 w-3.5" />
            <span>Hand</span>
          </button>
        </div>

        <div className="hidden h-6 w-px bg-white/10 sm:block" aria-hidden="true" />

        {/* Preset & Optics Lab */}
        <button
          type="button"
          onClick={() => togglePopover('vfx')}
          aria-expanded={popover === 'vfx'}
          className={`inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
            popover === 'vfx'
              ? 'border-[#38BDF8]/60 bg-[#38BDF8]/14 text-white'
              : 'border-white/8 bg-white/[0.04] text-slate-200 hover:border-white/20 hover:text-white'
          }`}
        >
          <SlidersHorizontal className="h-3.5 w-3.5 text-[#38BDF8]" />
          <span>{activePreset.name}</span>
        </button>

        {/* Multi-Window Topology */}
        <button
          type="button"
          onClick={() => togglePopover('topology')}
          aria-expanded={popover === 'topology'}
          className={`inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
            popover === 'topology'
              ? 'border-[#A78BFA]/60 bg-[#A78BFA]/14 text-white'
              : 'border-white/8 bg-white/[0.04] text-slate-200 hover:border-white/20 hover:text-white'
          }`}
        >
          <Network className="h-3.5 w-3.5 text-[#A78BFA]" />
          <span>Topology</span>
        </button>

        {/* Quick Spawn Sibling Window */}
        <button
          type="button"
          onClick={handleNewWindow}
          className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-white/8 bg-white/[0.04] px-3 text-xs font-medium text-slate-200 transition-colors hover:border-white/20 hover:text-white whitespace-nowrap shrink-0"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>New Window</span>
        </button>

        {/* Master Metaprompt Studio Primary Action */}
        <button
          type="button"
          onClick={onOpenMetaprompt}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#38BDF8] px-4 text-xs font-semibold text-[#05070B] transition-colors hover:bg-[#7DD3FC] whitespace-nowrap shrink-0"
        >
          <FileCode2 className="h-3.5 w-3.5" />
          <span>Metaprompt</span>
        </button>
      </nav>
    </div>
  );
}
