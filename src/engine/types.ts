export type InteractionMode = 'GRAVITY' | 'WIND' | 'HAND';

export type HandGesture = 'NONE' | 'PINCH' | 'PALM' | 'SPREAD';

export type RenderBackendKind = 'webgpu' | 'webgl2' | 'initializing';

export interface WindowRect {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  updatedAt: number;
  mode: InteractionMode;
  gesture: HandGesture;
  pointerX: number; // normalized -1..1
  pointerY: number; // normalized -1..1
}

export interface WorldBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  nodeCount: number;
}

export interface SingularityOffset {
  x: number;
  y: number;
  normX: number;
  normY: number;
}

export interface PeerLink {
  peerId: string;
  dx: number; // world-space delta from local singularity to peer center
  dy: number;
  distance: number;
  gesture: HandGesture;
}

export interface MinimapNode {
  id: string;
  isSelf: boolean;
  leftPct: number;
  topPct: number;
  widthPct: number;
  heightPct: number;
  screenX: number;
  screenY: number;
  screenW: number;
  screenH: number;
  mode: InteractionMode;
}

export interface VfxPreset {
  id: string;
  name: string;
  description: string;
  coreColor: string;
  midColor: string;
  rimColor: string;
  peakColor: string;
  curlFrequency: number;
  turbulence: number;
  glassIOR: number;
  dispersion: number;
  bloomStrength: number;
  bloomThreshold: number;
  dofFocalLength: number;
  chromaticStrength: number;
  anamorphicIntensity: number;
}

export interface VfxTuning {
  bloomStrength: number;
  dispersion: number;
  turbulence: number;
  dofFocalLength: number;
}

export interface MetapromptModules {
  gpgpuAdvection: boolean;
  sdfRaymarching: boolean;
  volumetricStage: boolean;
  springRig: boolean;
  postProcessing: boolean;
  multiWindowSync: boolean;
  mediaPipeVision: boolean;
}

export interface VisionState {
  status: 'idle' | 'starting' | 'active' | 'denied' | 'unavailable';
  errorMessage: string | null;
  emitterX: number; // -1..1
  emitterY: number; // -1..1
  blowStrength: number; // 0..1
  handGesture: HandGesture;
  handEnergy: number; // 0..1
  detectedHands: number;
}

export interface EngineTelemetry {
  backend: RenderBackendKind;
  particleCount: number;
  nodeCount: number;
  fps: number;
  isSoftwareGl: boolean;
  cameraDistance?: number;
}
