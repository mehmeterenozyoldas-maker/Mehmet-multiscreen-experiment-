import { useEffect, useMemo, useState } from 'react';
import { Check, Copy, Download, X } from 'lucide-react';
import {
  buildMasterMetaprompt,
  METAPROMPT_MODULE_LIST,
} from '../engine/metapromptBuilder';
import type { MetapromptModules } from '../engine/types';

interface MetapromptStudioProps {
  open: boolean;
  onClose: () => void;
  modules: MetapromptModules;
  onToggleModule: (key: keyof MetapromptModules) => void;
}

export function MetapromptStudio({
  open,
  onClose,
  modules,
  onToggleModule,
}: MetapromptStudioProps) {
  const [copied, setCopied] = useState(false);

  const assembledPrompt = useMemo(() => buildMasterMetaprompt(modules), [modules]);
  const lineCount = useMemo(() => assembledPrompt.split('\n').length, [assembledPrompt]);
  const charCount = assembledPrompt.length;

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(assembledPrompt);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Fallback selection copy
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([assembledPrompt], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'neural-singularity-touchdesigner-metaprompt.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="metaprompt-studio-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#05070B]/92 p-4 sm:p-6"
    >
      <div className="flex h-[min(86vh,760px)] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-white/10 bg-[#0B0F17] text-slate-100 shadow-2xl">
        {/* Studio Header */}
        <div className="flex items-center justify-between gap-4 border-b border-white/8 px-5 py-4">
          <div className="min-w-0">
            <h2
              id="metaprompt-studio-title"
              className="truncate text-lg font-semibold text-slate-50"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              TouchDesigner-Grade Web3D Metaprompt Studio
            </h2>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-400">
              <span>Three.js WebGPU / TSL Blueprint</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">{lineCount} lines</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">{charCount.toLocaleString()} chars</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#38BDF8] px-3.5 text-xs font-semibold text-[#05070B] transition-colors hover:bg-[#7DD3FC] whitespace-nowrap"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copied ? 'Copied' : 'Copy Prompt'}</span>
            </button>

            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/12 bg-white/[0.04] px-3 text-xs font-medium text-slate-200 transition-colors hover:bg-white/[0.1] whitespace-nowrap"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export .md</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close Metaprompt Studio"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-slate-300 transition-colors hover:bg-white/[0.1] hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Studio Body: Modular Architecture Toggles + Live Prompt Output */}
        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[310px_1fr]">
          <aside className="obsidian-scroll overflow-y-auto border-b border-white/8 p-4 lg:border-b-0 lg:border-r">
            <p className="mb-3 text-xs font-medium text-slate-400">
              Toggle architectural operators to assemble a tailored generation prompt.
            </p>
            <div className="flex flex-col gap-2">
              {METAPROMPT_MODULE_LIST.map((mod) => {
                const enabled = modules[mod.key];
                return (
                  <label
                    key={mod.key}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                      enabled
                        ? 'border-[#38BDF8]/50 bg-[#38BDF8]/8'
                        : 'border-white/8 bg-white/[0.02] hover:border-white/16'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={() => onToggleModule(mod.key)}
                      className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-[#38BDF8]"
                    />
                    <div className="min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-100">
                          {mod.label}
                        </span>
                      </div>
                      <span className="block font-mono text-[11px] text-[#A78BFA]">
                        {mod.tdAnalog}
                      </span>
                      <p className="mt-1 text-xs leading-relaxed text-slate-400">
                        {mod.summary}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
          </aside>

          <div className="obsidian-scroll min-h-0 overflow-y-auto bg-[#05070B] p-5">
            <pre
              data-testid="metaprompt-output"
              className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-slate-200 selection:bg-[#38BDF8]/30"
            >
              {assembledPrompt}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
