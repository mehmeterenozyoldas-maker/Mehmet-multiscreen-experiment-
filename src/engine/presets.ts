import type { VfxPreset, VfxTuning } from './types';

export const VFX_PRESETS: VfxPreset[] = [
  {
    id: 'liquid-obsidian',
    name: 'Liquid Obsidian',
    description: 'Optical cyan dispersion over deep void with violet peer filaments.',
    coreColor: '#0A2540',
    midColor: '#38BDF8',
    rimColor: '#A78BFA',
    peakColor: '#F59E0B',
    curlFrequency: 0.42,
    turbulence: 1.15,
    glassIOR: 1.68,
    dispersion: 0.048,
    bloomStrength: 0.72,
    bloomThreshold: 0.32,
    dofFocalLength: 14.0,
    chromaticStrength: 0.0022,
    anamorphicIntensity: 0.52,
  },
  {
    id: 'cryo-caustics',
    name: 'Cryo Caustics',
    description: 'Sub-zero refractive crystal with high-clarity glacial caustics.',
    coreColor: '#0B3954',
    midColor: '#67E8F9',
    rimColor: '#E0F2FE',
    peakColor: '#38BDF8',
    curlFrequency: 0.56,
    turbulence: 0.9,
    glassIOR: 1.82,
    dispersion: 0.065,
    bloomStrength: 0.85,
    bloomThreshold: 0.28,
    dofFocalLength: 16.0,
    chromaticStrength: 0.0028,
    anamorphicIntensity: 0.64,
  },
  {
    id: 'solar-corona',
    name: 'Solar Corona',
    description: 'Amber plasma advection with high-energy coronal shockwaves.',
    coreColor: '#3B1106',
    midColor: '#F59E0B',
    rimColor: '#FB7185',
    peakColor: '#FEF08A',
    curlFrequency: 0.65,
    turbulence: 1.48,
    glassIOR: 1.54,
    dispersion: 0.036,
    bloomStrength: 0.95,
    bloomThreshold: 0.25,
    dofFocalLength: 12.0,
    chromaticStrength: 0.0032,
    anamorphicIntensity: 0.74,
  },
  {
    id: 'quantum-prism',
    name: 'Quantum Prism',
    description: 'Ultra-high spectral dispersion with violet harmonic ribbons.',
    coreColor: '#1E1145',
    midColor: '#A78BFA',
    rimColor: '#38BDF8',
    peakColor: '#F472B6',
    curlFrequency: 0.48,
    turbulence: 1.25,
    glassIOR: 2.05,
    dispersion: 0.09,
    bloomStrength: 0.8,
    bloomThreshold: 0.3,
    dofFocalLength: 15.0,
    chromaticStrength: 0.0036,
    anamorphicIntensity: 0.58,
  },
];

export function getPresetById(id: string): VfxPreset {
  return VFX_PRESETS.find((p) => p.id === id) ?? VFX_PRESETS[0];
}

export function extractTuningFromPreset(preset: VfxPreset): VfxTuning {
  return {
    bloomStrength: preset.bloomStrength,
    dispersion: preset.dispersion,
    turbulence: preset.turbulence,
    dofFocalLength: preset.dofFocalLength,
  };
}
