import * as THREE from 'three/webgpu';
import {
  Break,
  Discard,
  Fn,
  If,
  Loop,
  abs,
  cameraPosition,
  clamp,
  color,
  convertToTexture,
  cos,
  cross,
  dot,
  exp,
  float,
  hash,
  instanceIndex,
  instancedArray,
  length,
  max,
  mix,
  normalize,
  pass,
  positionWorld,
  pow,
  reflect,
  refract,
  screenUV,
  select,
  sin,
  smoothstep,
  time,
  uniform,
  uv,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { dof } from 'three/addons/tsl/display/DepthOfFieldNode.js';
import { gaussianBlur } from 'three/addons/tsl/display/GaussianBlurNode.js';
import { chromaticAberration } from 'three/addons/tsl/display/ChromaticAberrationNode.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

import {
  createSpringScalar,
  createSpringVec3,
  decayTrauma,
  stepSpringScalar,
  stepSpringVec3,
} from './springPhysics';
import type {
  EngineTelemetry,
  HandGesture,
  InteractionMode,
  PeerLink,
  RenderBackendKind,
  VfxPreset,
  VfxTuning,
} from './types';

export const PARTICLE_COUNT = 65536;
const DEEP_STAR_COUNT = 2400;
const MAX_PEER_FILAMENTS = 6;

// Pre-allocated zero-GC scratch objects
const _vecA = new THREE.Vector3();
const _vecB = new THREE.Vector3();
const _vecC = new THREE.Vector3();
const _quatA = new THREE.Quaternion();
const _upAxis = new THREE.Vector3(0, 1, 0);
const _raycaster = new THREE.Raycaster();
const _pointerNdc = new THREE.Vector2();
const _interactionPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
const _targetCoreColor = new THREE.Color();
const _targetMidColor = new THREE.Color();
const _targetRimColor = new THREE.Color();
const _targetPeakColor = new THREE.Color();

export function detectSoftwareWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) ?? '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export interface EngineCallbacks {
  onTelemetry?: (telemetry: EngineTelemetry) => void;
  onError?: (message: string) => void;
}

export class SingularityEngine {
  private container: HTMLElement;
  private callbacks: EngineCallbacks;
  private isSoftwareGl: boolean;

  private renderer!: THREE.WebGPURenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderPipeline: THREE.RenderPipeline | null = null;
  private pmremGenerator: THREE.PMREMGenerator | null = null;

  private computeInit!: THREE.ComputeNode;
  private computeAdvect!: THREE.ComputeNode;

  private singularityGroup!: THREE.Group;
  private gyroOuterRing!: THREE.Mesh;
  private gyroInnerRing!: THREE.Mesh;
  private gyroPolarRing!: THREE.Mesh;
  private geodesicCage!: THREE.LineSegments;
  private geodesicMat!: THREE.LineBasicMaterial;
  private horizonRing!: THREE.Mesh;
  private deepStars!: THREE.Points;
  private shockwaveRing!: THREE.Mesh;
  private filamentMeshes: THREE.Mesh[] = [];

  private backendKind: RenderBackendKind = 'initializing';
  private isDisposed = false;
  private frameId = 0;
  private lastTimestamp = 0;
  private lastTelemetryAt = 0;
  private frameCounter = 0;
  private currentFps = 60;

  // Second-order spring kinematics & spherical orbital camera rig
  private offsetSpring = createSpringVec3(0, 0, 0);
  private parallaxSpring = createSpringVec3(0, 0, 0);
  private orbitYawSpring = createSpringScalar(0);
  private orbitPitchSpring = createSpringScalar(0.08);
  private orbitRadiusSpring = createSpringScalar(8.8);
  private fovSpring = createSpringScalar(50);
  private pinchSpring = createSpringScalar(0);
  private trauma = 0;

  // Dynamic spatial & interaction state
  private targetOffsetX = 0;
  private targetOffsetY = 0;
  private prevWindowX = typeof window !== 'undefined' ? window.screenX : 0;
  private prevWindowY = typeof window !== 'undefined' ? window.screenY : 0;
  private pointerX = 0;
  private pointerY = 0;
  private interactionMode: InteractionMode = 'GRAVITY';
  private handGesture: HandGesture = 'NONE';
  private blowStrength = 0;
  private handEnergy = 0;
  private nodeCount = 1;
  private peerLinks: PeerLink[] = [];

  private activeShockwaveRadius = 0;
  private activeShockwaveEnergy = 0;

  // TSL Uniforms
  private uDt = uniform(0.016);
  private uSingularityCenter = uniform(new THREE.Vector3(0, 0, 0));
  private uWindowInertia = uniform(new THREE.Vector3(0, 0, 0));
  private uForceOrigin = uniform(new THREE.Vector3(0, 0, 1.5));
  private uForceMode = uniform(0); // 0=Gravity, 1=Wind, 2=HandPinch, 3=HandPalm, 4=HandSpread
  private uForceStrength = uniform(0.6);
  private uShockOrigin = uniform(new THREE.Vector3(0, 0, 0));
  private uShockRadius = uniform(0.0);
  private uShockEnergy = uniform(0.0);

  private uCoreColor = uniform(new THREE.Color('#0A2540'));
  private uMidColor = uniform(new THREE.Color('#38BDF8'));
  private uRimColor = uniform(new THREE.Color('#A78BFA'));
  private uPeakColor = uniform(new THREE.Color('#F59E0B'));
  private uCurlFreq = uniform(0.42);
  private uTurbulence = uniform(1.15);
  private uGlassIOR = uniform(1.68);
  private uDispersion = uniform(0.048);
  private uPinchCompress = uniform(0.0);

  private uBloomStrength = uniform(0.72);
  private uBloomThreshold = uniform(0.32);
  private uDofFocusDist = uniform(8.8);
  private uDofFocalLen = uniform(14.0);
  private uChromaticStrength = uniform(0.0022);
  private uAnamorphicIntensity = uniform(0.52);

  // Target values for exponential color/tuning damping
  private targetTurbulence = 1.15;
  private targetCurlFreq = 0.42;
  private targetGlassIOR = 1.68;
  private targetDispersion = 0.048;
  private targetBloomStrength = 0.72;
  private targetBloomThreshold = 0.32;
  private targetDofFocalLen = 14.0;
  private targetChromatic = 0.0022;
  private targetAnamorphic = 0.52;

  constructor(container: HTMLElement, initialPreset: VfxPreset, callbacks: EngineCallbacks = {}) {
    this.container = container;
    this.callbacks = callbacks;
    this.isSoftwareGl = detectSoftwareWebGL();
    this.applyPreset(initialPreset, true);
  }

  public async init(): Promise<void> {
    if (this.isDisposed) return;

    const width = Math.max(1, this.container.clientWidth || window.innerWidth);
    const height = Math.max(1, this.container.clientHeight || window.innerHeight);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#05070B');
    this.scene.fog = new THREE.FogExp2('#05070B', 0.028);

    this.camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 120);
    this.camera.position.set(0, 0.25, 8.8);

    this.renderer = new THREE.WebGPURenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(width, height);

    const canvas = this.renderer.domElement;
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.setAttribute('data-testid', 'singularity-canvas');
    this.container.appendChild(canvas);

    canvas.addEventListener('webglcontextlost', this.handleContextLost);

    try {
      await this.renderer.init();
    } catch (err) {
      this.callbacks.onError?.(
        err instanceof Error ? err.message : 'Failed to initialize 3D graphics backend.'
      );
      return;
    }

    if (this.isDisposed) return;

    const backendAny = this.renderer.backend as unknown as { isWebGPUBackend?: boolean };
    this.backendKind = backendAny?.isWebGPUBackend ? 'webgpu' : 'webgl2';

    this.setupLightingAndEnvironment();
    this.setupGPGPUParticles();
    this.setupSingularityAssembly();
    this.setupVolumetricStage();
    this.setupPeerFilaments();
    this.setupPostProcessing();

    // Initialize particle compute buffer once
    this.renderer.compute(this.computeInit);

    window.addEventListener('resize', this.handleResize);
    this.lastTimestamp = performance.now();
    this.lastTelemetryAt = this.lastTimestamp;

    this.emitTelemetry();
    this.frameId = requestAnimationFrame(this.tick);
  }

  private setupLightingAndEnvironment() {
    try {
      this.pmremGenerator = new THREE.PMREMGenerator(this.renderer);
      const envTex = this.pmremGenerator.fromScene(
        new RoomEnvironment(),
        0.04,
        0.1,
        100,
        { size: this.isSoftwareGl ? 64 : 256 }
      ).texture;
      this.scene.environment = envTex;
    } catch {
      // Fallback if PMREM fails on restricted WebGPU context
    }

    const hemiLight = new THREE.HemisphereLight('#7DD3FC', '#090D16', 0.85);
    this.scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight('#FFF3E0', 2.4);
    keyLight.position.set(5, 6, 7);
    this.scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight('#A78BFA', 1.8);
    rimLight.position.set(-6, -3, -5);
    this.scene.add(rimLight);
  }

  private setupGPGPUParticles() {
    const positions = instancedArray(PARTICLE_COUNT, 'vec3');
    const velocities = instancedArray(PARTICLE_COUNT, 'vec3');
    const seeds = instancedArray(PARTICLE_COUNT, 'vec3');

    this.computeInit = Fn(() => {
      const pos = positions.element(instanceIndex);
      const vel = velocities.element(instanceIndex);
      const seed = seeds.element(instanceIndex);

      const h1 = hash(instanceIndex);
      const h2 = hash(instanceIndex.add(19283));
      const h3 = hash(instanceIndex.add(84731));
      const h4 = hash(instanceIndex.add(55109));

      const theta = h1.mul(Math.PI * 2.0);
      const phi = h2.mul(2.0).sub(1.0).acos();
      // Nested orbital shells: accretion halo + mid curl ribbons + outer field
      const shell = select(
        h3.lessThan(0.38),
        float(1.55).add(h4.mul(1.1)),
        select(h3.lessThan(0.84), float(2.5).add(h4.mul(2.6)), float(5.1).add(h4.mul(3.8)))
      );

      const sinPhi = sin(phi);
      const px = sinPhi.mul(cos(theta)).mul(shell);
      const py = cos(phi).mul(shell).mul(0.68);
      const pz = sinPhi.mul(sin(theta)).mul(shell);

      pos.assign(vec3(px, py, pz));
      vel.assign(vec3(sin(theta).negate(), float(0.15), cos(theta)).mul(0.45));
      seed.assign(vec3(shell, h1, h2));
    })().compute(PARTICLE_COUNT);

    // Divergence-free 3D curl field via gyroid potential cross derivatives
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const evalCurlField = Fn(([p, t, freq]: [any, any, any]) => {
      const q = p.mul(freq).add(vec3(t.mul(0.24), t.mul(-0.18), t.mul(0.15)));
      const cx = cos(q.y.mul(1.7)).mul(sin(q.z.mul(1.3))).sub(sin(q.z.mul(1.9)).mul(cos(q.y.mul(1.1))));
      const cy = cos(q.z.mul(1.5)).mul(sin(q.x.mul(1.6))).sub(sin(q.x.mul(1.4)).mul(cos(q.z.mul(1.8))));
      const cz = cos(q.x.mul(1.8)).mul(sin(q.y.mul(1.4))).sub(sin(q.y.mul(1.5)).mul(cos(q.x.mul(1.7))));
      return vec3(cx, cy, cz);
    });

    this.computeAdvect = Fn(() => {
      const pos = positions.element(instanceIndex);
      const vel = velocities.element(instanceIndex);
      const seed = seeds.element(instanceIndex);
      const dt = this.uDt;

      const toCenter = pos.sub(this.uSingularityCenter);
      const dist = max(length(toCenter), 0.12);
      const dir = toCenter.div(dist);

      // 1. Divergence-free 3D Curl-Noise turbulence
      const curl = evalCurlField(toCenter, time, this.uCurlFreq).mul(this.uTurbulence);

      // 2. Precessing Magnetic Dipole Lorentz Torque + Keplerian Differential Shear
      const dipoleAxis = normalize(
        vec3(sin(time.mul(0.22)).mul(0.28), float(1.0), cos(time.mul(0.17)).mul(0.28))
      );
      const rCubed = max(dist.mul(dist).mul(dist), 0.08);
      const mDotR = dot(dipoleAxis, dir);
      const bField = dir.mul(mDotR.mul(3.0)).sub(dipoleAxis).div(rCubed);
      const lorentz = cross(vel, bField).mul(1.45);

      const keplerSpeed = float(1.38).div(pow(max(dist, 0.35), 0.45));
      const swirl = cross(dipoleAxis, dir).mul(keplerSpeed);
      const targetRadius = seed.x.mul(float(1.0).sub(this.uPinchCompress.mul(0.42)));
      const radialSpring = dir.mul(targetRadius.sub(dist)).mul(1.65);

      // 3. Multi-window drag inertia injection
      const inertia = this.uWindowInertia.mul(0.85);

      // 4. Interactive Force Well (Gravity / Wind / Hand)
      const toForce = this.uForceOrigin.sub(pos);
      const forceDist = max(length(toForce), 0.25);
      const forceDir = toForce.div(forceDist);
      const falloff = float(1.0).div(forceDist.mul(forceDist).mul(0.28).add(0.45));

      const modeForce = vec3(0.0).toVar();
      If(this.uForceMode.lessThan(0.5), () => {
        // Mode 0: Mouse Gravity Attractor + orbital lift
        const tang = cross(dipoleAxis, forceDir);
        modeForce.assign(forceDir.mul(2.8).add(tang.mul(1.35)).mul(falloff).mul(this.uForceStrength));
      })
        .ElseIf(this.uForceMode.lessThan(1.5), () => {
          // Mode 1: FaceMesh Wind / Blow cone
          const blowDir = normalize(vec3(this.uForceOrigin.x.mul(0.45), this.uForceOrigin.y.mul(0.45), -1.0));
          modeForce.assign(blowDir.mul(this.uForceStrength).mul(7.5).add(curl.mul(this.uForceStrength).mul(2.2)));
        })
        .ElseIf(this.uForceMode.lessThan(2.5), () => {
          // Mode 2: Hand PINCH -> condense and charge toward hand/core
          modeForce.assign(forceDir.mul(5.2).mul(falloff).mul(this.uForceStrength));
        })
        .ElseIf(this.uForceMode.lessThan(3.5), () => {
          // Mode 3: Hand PALM -> wide curl vortex
          const vortex = cross(dipoleAxis, forceDir);
          modeForce.assign(vortex.mul(5.8).add(forceDir.mul(0.9)).mul(falloff).mul(this.uForceStrength));
        })
        .Else(() => {
          // Mode 4: Hand SPREAD -> radial burst outward
          modeForce.assign(dir.mul(7.5).mul(this.uForceStrength));
        });

      // 5. Expanding Shockwave Torus/Sphere Pulse
      const toShock = pos.sub(this.uShockOrigin);
      const shockDist = max(length(toShock), 0.08);
      const shockBand = exp(pow(shockDist.sub(this.uShockRadius), 2.0).mul(-2.2));
      const shockForce = toShock.div(shockDist).mul(shockBand).mul(this.uShockEnergy).mul(14.0);

      // Symplectic Semi-Implicit Euler integration with viscous damping
      const totalAccel = curl.add(swirl).add(lorentz).add(radialSpring).add(inertia).add(modeForce).add(shockForce);
      vel.addAssign(totalAccel.mul(dt));
      vel.mulAssign(float(1.0).sub(clamp(dt.mul(1.85), 0.0, 0.25)));

      // Clamp speed for numerical stability
      const speed = length(vel);
      If(speed.greaterThan(11.0), () => {
        vel.assign(vel.div(speed).mul(11.0));
      });

      pos.addAssign(vel.mul(dt));

      // Keep particles inside world bounding sphere
      If(dist.greaterThan(11.5), () => {
        pos.assign(this.uSingularityCenter.add(dir.mul(targetRadius)));
        vel.mulAssign(0.25);
      });
    })().compute(PARTICLE_COUNT);

    // Instanced Sprites using PointsNodeMaterial (.toAttribute() works on both WebGPU & WebGL2)
    const posAttr = positions.toAttribute();
    const velAttr = velocities.toAttribute();
    const seedAttr = seeds.toAttribute();

    const particleMaterial = new THREE.PointsNodeMaterial();
    particleMaterial.positionNode = posAttr;

    particleMaterial.sizeNode = Fn(() => {
      const vel = velAttr;
      const speed = length(vel);
      const seed = seedAttr;
      const base = mix(float(0.022), float(0.048), seed.y);
      return base.add(clamp(speed.mul(0.011), 0.0, 0.042));
    })();

    const vVel = velAttr.toVarying();
    const vSeed = seedAttr.toVarying();

    particleMaterial.colorNode = Fn(() => {
      const speed = length(vVel);
      const tVel = clamp(speed.div(4.8), 0.0, 1.0);
      const c1 = mix(this.uMidColor, this.uRimColor, vSeed.z);
      const c2 = mix(c1, this.uPeakColor, pow(tVel, 1.55));
      return c2.mul(float(0.85).add(tVel.mul(1.25)));
    })();

    particleMaterial.opacityNode = Fn(() => {
      const d = length(uv().sub(0.5));
      const softCircle = smoothstep(0.5, 0.08, d);
      const shimmer = sin(time.mul(2.2).add(vSeed.y.mul(18.0))).mul(0.18).add(0.82);
      return softCircle.mul(shimmer).mul(0.86);
    })();

    particleMaterial.transparent = true;
    particleMaterial.depthWrite = false;
    particleMaterial.blending = THREE.AdditiveBlending;

    const particleSprites = new THREE.Sprite(particleMaterial);
    particleSprites.count = PARTICLE_COUNT;
    particleSprites.frustumCulled = false;
    this.scene.add(particleSprites);
  }

  private setupSingularityAssembly() {
    this.singularityGroup = new THREE.Group();
    this.scene.add(this.singularityGroup);

    // 1. Raymarched Liquid-Glass SDF Core inside bounding proxy sphere
    const proxyGeo = new THREE.SphereGeometry(2.75, 48, 32);
    const raymarchMat = new THREE.MeshBasicNodeMaterial();
    raymarchMat.transparent = true;
    raymarchMat.depthWrite = false;
    raymarchMat.side = THREE.FrontSide;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const smin = Fn(([a, b, k]: [any, any, any]) => {
      const h = clamp(float(0.5).add(float(0.5).mul(b.sub(a)).div(k)), 0.0, 1.0);
      return mix(b, a, h).sub(k.mul(h).mul(float(1.0).sub(h)));
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gyroid = Fn(([p]: [any]) => {
      return p.sin().dot(p.yzx.cos());
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mapSDF = Fn(([p]: [any]) => {
      const t = time.mul(0.85);
      const breathe = sin(t.mul(1.6)).mul(0.035).add(1.0).sub(this.uPinchCompress.mul(0.22));
      const warp = gyroid(p.mul(2.6).add(vec3(t.mul(0.7), t.mul(-0.5), t.mul(0.4)))).mul(0.055);
      const ripple = sin(length(p).mul(9.0).sub(this.uShockRadius.mul(5.0)))
        .mul(this.uShockEnergy)
        .mul(0.05);

      const core = length(p).sub(float(0.82).mul(breathe)).add(warp).add(ripple);

      // Undulating precessing equatorial accretion torus smooth-unioned with core
      const tiltA = t.mul(0.38);
      const cA = cos(tiltA);
      const sA = sin(tiltA);
      const tp = vec3(
        p.x.mul(cA).sub(p.z.mul(sA)),
        p.y.mul(0.91).add(p.z.mul(0.41)),
        p.x.mul(sA).add(p.z.mul(cA))
      );
      const torWave = sin(tp.x.mul(2.8).add(t.mul(1.7))).mul(cos(tp.z.mul(2.8))).mul(0.025);
      const qTor = vec2(length(vec2(tp.x, tp.z)).sub(1.14), tp.y);
      const torusD = length(qTor).sub(float(0.105).add(torWave));

      // Three smooth-unioned orbiting satellite droplets
      const orb1Pos = vec3(cos(t.mul(1.15)).mul(1.22), sin(t.mul(0.9)).mul(0.52), sin(t.mul(1.15)).mul(1.22));
      const orb2Pos = vec3(sin(t.mul(-0.95)).mul(1.08), cos(t.mul(1.25)).mul(0.84), cos(t.mul(-0.95)).mul(0.94));
      const orb3Pos = vec3(cos(t.mul(0.7).add(2.1)).mul(0.98), sin(t.mul(-1.1).add(1.0)).mul(0.96), sin(t.mul(0.7)).mul(0.88));

      const d1 = length(p.sub(orb1Pos)).sub(0.31);
      const d2 = length(p.sub(orb2Pos)).sub(0.26);
      const d3 = length(p.sub(orb3Pos)).sub(0.23);

      const m0 = smin(core, torusD, float(0.28));
      const m1 = smin(m0, d1, float(0.40));
      const m2 = smin(m1, d2, float(0.36));
      return smin(m2, d3, float(0.33));
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const calcNormal = Fn(([p]: [any]) => {
      const e = float(0.004);
      const k1 = vec3(1.0, -1.0, -1.0);
      const k2 = vec3(-1.0, -1.0, 1.0);
      const k3 = vec3(-1.0, 1.0, -1.0);
      const k4 = vec3(1.0, 1.0, 1.0);
      return normalize(
        k1.mul(mapSDF(p.add(k1.mul(e))))
          .add(k2.mul(mapSDF(p.add(k2.mul(e)))))
          .add(k3.mul(mapSDF(p.add(k3.mul(e)))))
          .add(k4.mul(mapSDF(p.add(k4.mul(e)))))
      );
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sampleCausticSpectrum = Fn(([dir, pos]: [any, any]) => {
      const phase = gyroid(pos.mul(2.3).add(dir.mul(1.9)).add(time.mul(0.45)));
      const causticVein = pow(clamp(float(1.0).sub(abs(phase)), 0.0, 1.0), 3.4);
      const skyElev = clamp(dir.y.mul(0.5).add(0.5), 0.0, 1.0);
      const deepBody = this.uCoreColor.mul(0.26);
      const veinGlow = mix(this.uMidColor, this.uRimColor, pow(skyElev, 1.4)).mul(causticVein.mul(1.38));
      return deepBody.add(veinGlow);
    });

    const raymarchColor = Fn(() => {
      const localCam = cameraPosition.sub(this.uSingularityCenter);
      const roWorld = positionWorld.sub(this.uSingularityCenter);
      const camDist = length(localCam);
      const ro = select(camDist.lessThan(2.74), localCam, roWorld);
      const rd = normalize(positionWorld.sub(cameraPosition));

      const tDist = float(0.0).toVar();
      const hit = float(0.0).toVar();
      const pHit = vec3(0.0).toVar();

      Loop(28, () => {
        const p = ro.add(rd.mul(tDist));
        const d = mapSDF(p);
        If(d.lessThan(0.01), () => {
          hit.assign(1.0);
          pHit.assign(p);
          Break();
        });
        If(tDist.greaterThan(5.4), () => {
          Break();
        });
        tDist.addAssign(max(d.mul(0.92), 0.018));
      });

      If(hit.lessThan(0.5), () => {
        Discard();
      });

      const n = calcNormal(pHit);
      const v = rd.negate();
      const nDotV = clamp(dot(n, v), 0.0, 1.0);
      const fresnel = pow(float(1.0).sub(nDotV), 3.8);

      // Chromatic RGB Refraction / Dispersion through dark obsidian glass
      const etaBase = float(1.0).div(this.uGlassIOR);
      const rRay = refract(rd, n, etaBase.sub(this.uDispersion));
      const gRay = refract(rd, n, etaBase);
      const bRay = refract(rd, n, etaBase.add(this.uDispersion));

      const specR = sampleCausticSpectrum(rRay, pHit).x;
      const specG = sampleCausticSpectrum(gRay, pHit).y;
      const specB = sampleCausticSpectrum(bRay, pHit).z;

      // Beer-Lambert internal chord optical absorption
      const dInner = mapSDF(pHit.add(gRay.mul(0.42)));
      const opticalDepth = clamp(dInner.negate().mul(2.2), 0.08, 1.45);
      const transmittance = exp(opticalDepth.negate().mul(1.35));
      const refracted = mix(this.uCoreColor.mul(0.14), vec3(specR, specG, specB), transmittance).mul(0.95);

      // Crisp Studio Softbox Specular Highlights
      const refl = reflect(rd, n);
      const keySoftbox = pow(clamp(dot(refl, normalize(vec3(0.55, 0.72, 0.42))), 0.0, 1.0), 34.0);
      const rimSoftbox = pow(clamp(dot(refl, normalize(vec3(-0.7, -0.25, -0.6))), 0.0, 1.0), 20.0);
      const specular = vec3(0.95, 0.98, 1.0)
        .mul(keySoftbox.mul(1.45))
        .add(this.uRimColor.mul(rimSoftbox.mul(0.85)));

      // Controlled internal energy & shockwave rim pulse (never washes out core)
      const energyMask = clamp(this.uPinchCompress.mul(0.55).add(this.uShockEnergy.mul(0.35)), 0.0, 0.8);
      const subsurface = this.uPeakColor.mul(fresnel).mul(energyMask).mul(0.85);

      const rimGlow = mix(this.uMidColor, this.uRimColor, 0.42).mul(fresnel).mul(1.55);
      return refracted.add(subsurface).add(rimGlow).add(specular);
    });

    raymarchMat.colorNode = raymarchColor();
    raymarchMat.opacityNode = float(0.98);

    const coreProxy = new THREE.Mesh(proxyGeo, raymarchMat);
    coreProxy.renderOrder = 2;
    this.singularityGroup.add(coreProxy);

    // 2. 3-Axis Composite Metallic Astrolabe Rings
    const outerRingGeo = new THREE.TorusGeometry(1.78, 0.014, 12, 96);
    const outerRingMat = new THREE.MeshStandardNodeMaterial();
    outerRingMat.colorNode = color('#162033');
    outerRingMat.emissiveNode = this.uMidColor.mul(0.35);
    outerRingMat.metalnessNode = float(0.92);
    outerRingMat.roughnessNode = float(0.18);
    this.gyroOuterRing = new THREE.Mesh(outerRingGeo, outerRingMat);
    this.gyroOuterRing.rotation.set(Math.PI * 0.34, Math.PI * 0.14, 0);
    this.singularityGroup.add(this.gyroOuterRing);

    const innerRingGeo = new THREE.TorusGeometry(1.42, 0.01, 12, 84);
    const innerRingMat = new THREE.MeshStandardNodeMaterial();
    innerRingMat.colorNode = color('#252C3E');
    innerRingMat.emissiveNode = this.uRimColor.mul(0.28);
    innerRingMat.metalnessNode = float(0.65);
    innerRingMat.roughnessNode = float(0.48);
    this.gyroInnerRing = new THREE.Mesh(innerRingGeo, innerRingMat);
    this.gyroInnerRing.rotation.set(-Math.PI * 0.28, Math.PI * 0.42, 0);
    this.singularityGroup.add(this.gyroInnerRing);

    const polarRingGeo = new THREE.TorusGeometry(1.6, 0.008, 10, 88);
    const polarRingMat = new THREE.MeshStandardNodeMaterial();
    polarRingMat.colorNode = color('#1B2436');
    polarRingMat.emissiveNode = this.uPeakColor.mul(0.22);
    polarRingMat.metalnessNode = float(0.84);
    polarRingMat.roughnessNode = float(0.28);
    this.gyroPolarRing = new THREE.Mesh(polarRingGeo, polarRingMat);
    this.gyroPolarRing.rotation.set(Math.PI * 0.48, -Math.PI * 0.22, Math.PI * 0.15);
    this.singularityGroup.add(this.gyroPolarRing);

    // 3. Expanding Click / Spread Shockwave Ring
    const shockGeo = new THREE.TorusGeometry(1.0, 0.034, 12, 84);
    const shockMat = new THREE.MeshBasicNodeMaterial();
    shockMat.colorNode = mix(this.uMidColor, this.uPeakColor, this.uShockEnergy).mul(2.1);
    shockMat.opacityNode = clamp(this.uShockEnergy.mul(1.2), 0.0, 0.95);
    shockMat.transparent = true;
    shockMat.depthWrite = false;
    shockMat.blending = THREE.AdditiveBlending;
    this.shockwaveRing = new THREE.Mesh(shockGeo, shockMat);
    this.shockwaveRing.visible = false;
    this.scene.add(this.shockwaveRing);
  }

  private setupVolumetricStage() {
    // 1. Deep 3D Parallax Starfield (r = 16 .. 46) for strong depth perception on orbit
    const starPositions = new Float32Array(DEEP_STAR_COUNT * 3);
    const starColors = new Float32Array(DEEP_STAR_COUNT * 3);
    const cCyan = new THREE.Color('#7DD3FC');
    const cViolet = new THREE.Color('#C4B5FD');
    const cSlate = new THREE.Color('#E2E8F0');
    const tmpCol = new THREE.Color();

    for (let i = 0; i < DEEP_STAR_COUNT; i++) {
      // Deterministic golden-ratio sphere distribution + shell depth
      const u = ((i * 0.61803398875) % 1);
      const v = ((i * 0.38196601125 + 0.17) % 1);
      const theta = u * Math.PI * 2;
      const phi = Math.acos(2 * v - 1);
      const r = 16 + ((i * 7919) % 3000) / 100;

      const sinPhi = Math.sin(phi);
      starPositions[i * 3] = sinPhi * Math.cos(theta) * r;
      starPositions[i * 3 + 1] = Math.cos(phi) * r;
      starPositions[i * 3 + 2] = sinPhi * Math.sin(theta) * r;

      const mod = i % 5;
      tmpCol.copy(mod === 0 ? cCyan : mod === 1 ? cViolet : cSlate);
      const lum = 0.45 + ((i * 3571) % 100) / 180;
      starColors[i * 3] = tmpCol.r * lum;
      starColors[i * 3 + 1] = tmpCol.g * lum;
      starColors[i * 3 + 2] = tmpCol.b * lum;
    }

    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
    const starMat = new THREE.PointsMaterial({
      size: 1.8,
      sizeAttenuation: false,
      vertexColors: true,
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
    });
    this.deepStars = new THREE.Points(starGeo, starMat);
    this.scene.add(this.deepStars);

    // 2. Geodesic Spatial Containment Cage around singularity
    const icoEdges = new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(3.35, 1));
    this.geodesicMat = new THREE.LineBasicMaterial({
      color: '#38BDF8',
      transparent: true,
      opacity: 0.11,
      depthWrite: false,
    });
    this.geodesicCage = new THREE.LineSegments(icoEdges, this.geodesicMat);
    this.singularityGroup.add(this.geodesicCage);

    // 3. Calibrated Equatorial Spatial Reference Ring
    const horizonGeo = new THREE.TorusGeometry(4.1, 0.008, 8, 128);
    const horizonMat = new THREE.MeshBasicNodeMaterial();
    horizonMat.colorNode = this.uMidColor;
    horizonMat.opacityNode = float(0.16);
    horizonMat.transparent = true;
    horizonMat.depthWrite = false;
    horizonMat.blending = THREE.AdditiveBlending;
    this.horizonRing = new THREE.Mesh(horizonGeo, horizonMat);
    this.horizonRing.rotation.set(Math.PI * 0.48, 0.12, 0);
    this.singularityGroup.add(this.horizonRing);

    // 4. Soft Volumetric Atmospheric Corona Shell (fades smoothly to 0 at silhouette)
    const coronaGeo = new THREE.SphereGeometry(2.35, 32, 24);
    const coronaMat = new THREE.MeshBasicNodeMaterial();
    coronaMat.colorNode = mix(this.uMidColor, this.uRimColor, 0.45).mul(0.85);
    coronaMat.opacityNode = Fn(() => {
      const viewDir = normalize(cameraPosition.sub(positionWorld));
      const surfNorm = normalize(positionWorld.sub(this.uSingularityCenter));
      const facing = clamp(abs(dot(viewDir, surfNorm)), 0.0, 1.0);
      const softHalo = pow(facing, 2.8);
      return softHalo.mul(float(0.18).add(this.uShockEnergy.mul(0.18)));
    })();
    coronaMat.side = THREE.BackSide;
    coronaMat.transparent = true;
    coronaMat.depthWrite = false;
    coronaMat.blending = THREE.AdditiveBlending;
    const coronaMesh = new THREE.Mesh(coronaGeo, coronaMat);
    coronaMesh.renderOrder = 1;
    this.singularityGroup.add(coronaMesh);
  }

  private setupPeerFilaments() {
    const segGeo = new THREE.CylinderGeometry(0.016, 0.008, 1.0, 8, 1, true);
    for (let i = 0; i < MAX_PEER_FILAMENTS; i++) {
      const mat = new THREE.MeshBasicNodeMaterial();
      mat.colorNode = Fn(() => {
        const pulse = sin(uv().y.mul(14.0).sub(time.mul(5.0))).mul(0.4).add(0.8);
        return this.uRimColor.mul(pulse).mul(1.6);
      })();
      mat.opacityNode = Fn(() => {
        const fadeEnds = sin(uv().y.mul(Math.PI));
        return fadeEnds.mul(0.75);
      })();
      mat.transparent = true;
      mat.depthWrite = false;
      mat.blending = THREE.AdditiveBlending;

      const mesh = new THREE.Mesh(segGeo, mat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.filamentMeshes.push(mesh);
    }
  }

  private setupPostProcessing() {
    if (this.isSoftwareGl) {
      this.renderPipeline = null;
      return;
    }

    try {
      const pipeline = new THREE.RenderPipeline(this.renderer);
      const scenePass = pass(this.scene, this.camera);
      const sceneColor = scenePass.getTextureNode('output');
      const viewZ = scenePass.getViewZNode();

      // 1. Selective HDR Bloom
      const bloomPass = bloom(sceneColor, 0.72, 0.45, 0.32);
      bloomPass.strength = this.uBloomStrength;
      bloomPass.threshold = this.uBloomThreshold;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let chain: any = sceneColor.add(bloomPass);

      // 2. Bokeh Depth of Field locked onto singularity distance
      chain = dof(chain, viewZ, this.uDofFocusDist, this.uDofFocalLen, float(0.85));

      // 3. Anamorphic Horizontal Lens Streak via directional Gaussian blur of bloom peaks
      const anamorphicStreak = gaussianBlur(
        convertToTexture(bloomPass),
        vec2(7.0, 0.12),
        4,
        { resolutionScale: 0.5 }
      );
      chain = chain.add(anamorphicStreak.mul(this.uMidColor).mul(this.uAnamorphicIntensity));

      // 4. Chromatic Aberration + Cinema Vignette
      chain = chromaticAberration(chain, this.uChromaticStrength, vec2(0.5, 0.5), float(1.08));

      const vignette = Fn(() => {
        const dist = length(screenUV.sub(0.5));
        const vig = clamp(float(1.0).sub(pow(dist.mul(1.22), 2.1).mul(0.58)), 0.35, 1.0);
        return chain.mul(vec4(vig, vig, vig, 1.0));
      });

      pipeline.outputNode = vignette();
      this.renderPipeline = pipeline;
    } catch {
      this.renderPipeline = null;
    }
  }

  public applyPreset(preset: VfxPreset, immediate = false) {
    _targetCoreColor.set(preset.coreColor);
    _targetMidColor.set(preset.midColor);
    _targetRimColor.set(preset.rimColor);
    _targetPeakColor.set(preset.peakColor);

    this.targetCurlFreq = preset.curlFrequency;
    this.targetTurbulence = preset.turbulence;
    this.targetGlassIOR = preset.glassIOR;
    this.targetDispersion = preset.dispersion;
    this.targetBloomStrength = preset.bloomStrength;
    this.targetBloomThreshold = preset.bloomThreshold;
    this.targetDofFocalLen = preset.dofFocalLength;
    this.targetChromatic = preset.chromaticStrength;
    this.targetAnamorphic = preset.anamorphicIntensity;

    if (immediate) {
      this.uCoreColor.value.copy(_targetCoreColor);
      this.uMidColor.value.copy(_targetMidColor);
      this.uRimColor.value.copy(_targetRimColor);
      this.uPeakColor.value.copy(_targetPeakColor);
      this.uCurlFreq.value = this.targetCurlFreq;
      this.uTurbulence.value = this.targetTurbulence;
      this.uGlassIOR.value = this.targetGlassIOR;
      this.uDispersion.value = this.targetDispersion;
      this.uBloomStrength.value = this.targetBloomStrength;
      this.uBloomThreshold.value = this.targetBloomThreshold;
      this.uDofFocalLen.value = this.targetDofFocalLen;
      this.uChromaticStrength.value = this.targetChromatic;
      this.uAnamorphicIntensity.value = this.targetAnamorphic;
    }
  }

  public updateTuning(tuning: VfxTuning) {
    this.targetBloomStrength = tuning.bloomStrength;
    this.targetDispersion = tuning.dispersion;
    this.targetTurbulence = tuning.turbulence;
    this.targetDofFocalLen = tuning.dofFocalLength;
  }

  public setSpatialSync(offsetX: number, offsetY: number, nodeCount: number, links: PeerLink[]) {
    this.targetOffsetX = offsetX;
    this.targetOffsetY = offsetY;
    this.nodeCount = nodeCount;
    this.peerLinks = links;
  }

  public setPointer(normX: number, normY: number) {
    this.pointerX = normX;
    this.pointerY = normY;
  }

  public orbitBy(deltaYaw: number, deltaPitch: number) {
    this.orbitYawSpring.target += deltaYaw;
    this.orbitPitchSpring.target = THREE.MathUtils.clamp(
      this.orbitPitchSpring.target + deltaPitch,
      -1.22,
      1.22
    );
  }

  public dollyBy(deltaRadius: number) {
    this.orbitRadiusSpring.target = THREE.MathUtils.clamp(
      this.orbitRadiusSpring.target + deltaRadius,
      4.6,
      16.5
    );
  }

  public resetCamera() {
    this.orbitYawSpring.target = 0;
    this.orbitPitchSpring.target = 0.08;
    this.orbitRadiusSpring.target = 8.8;
  }

  public setInteractionInput(
    mode: InteractionMode,
    blowStrength: number,
    emitterX: number,
    emitterY: number,
    gesture: HandGesture,
    handEnergy: number
  ) {
    this.interactionMode = mode;
    this.blowStrength = blowStrength;
    this.handGesture = gesture;
    this.handEnergy = handEnergy;

    if (mode === 'WIND' || mode === 'HAND') {
      this.pointerX = emitterX;
      this.pointerY = emitterY;
    }
  }

  public triggerShockwave(normX = 0, normY = 0, energy = 1.0) {
    this.activeShockwaveRadius = 0.25;
    this.activeShockwaveEnergy = Math.min(1.5, Math.max(0.4, energy));
    this.trauma = Math.min(1.0, this.trauma + 0.55 * energy);
    this.fovSpring.target = 54.0;

    if (this.camera && this.singularityGroup) {
      this.camera.getWorldDirection(_vecC).negate();
      _interactionPlane.setFromNormalAndCoplanarPoint(_vecC, this.singularityGroup.position);
      _pointerNdc.set(normX, normY);
      _raycaster.setFromCamera(_pointerNdc, this.camera);
      _raycaster.ray.intersectPlane(_interactionPlane, _vecA);
      this.uShockOrigin.value.copy(_vecA);
      this.shockwaveRing.position.copy(_vecA);
      this.shockwaveRing.quaternion.copy(this.camera.quaternion);
    }
  }

  private tick = (now: number) => {
    if (this.isDisposed) return;

    const rawDt = (now - this.lastTimestamp) / 1000;
    this.lastTimestamp = now;
    const dt = Math.min(Math.max(rawDt, 0.001), 0.05);
    this.uDt.value = dt;

    // 1. Track window drag velocity -> second-order spring inertia
    const curWinX = typeof window !== 'undefined' ? window.screenX : 0;
    const curWinY = typeof window !== 'undefined' ? window.screenY : 0;
    const dragVx = ((curWinX - this.prevWindowX) * 0.012) / Math.max(dt, 0.016);
    const dragVy = -((curWinY - this.prevWindowY) * 0.012) / Math.max(dt, 0.016);
    this.prevWindowX = curWinX;
    this.prevWindowY = curWinY;

    this.uWindowInertia.value.set(
      THREE.MathUtils.clamp(-dragVx * 0.14, -6, 6),
      THREE.MathUtils.clamp(-dragVy * 0.14, -6, 6),
      0
    );

    // 2. Step second-order CHOP springs
    this.offsetSpring.tx = this.targetOffsetX;
    this.offsetSpring.ty = this.targetOffsetY;
    stepSpringVec3(this.offsetSpring, dt, { stiffness: 95, damping: 14 });

    this.parallaxSpring.tx = this.pointerX * 0.52;
    this.parallaxSpring.ty = this.pointerY * 0.36;
    stepSpringVec3(this.parallaxSpring, dt, { stiffness: 70, damping: 13 });

    stepSpringScalar(this.orbitYawSpring, dt, { stiffness: 75, damping: 14 });
    stepSpringScalar(this.orbitPitchSpring, dt, { stiffness: 75, damping: 14 });
    stepSpringScalar(this.orbitRadiusSpring, dt, { stiffness: 85, damping: 15 });

    this.fovSpring.target = 50 + (this.handGesture === 'SPREAD' ? 4.5 : this.blowStrength * 3.0);
    stepSpringScalar(this.fovSpring, dt, { stiffness: 80, damping: 14 });

    this.pinchSpring.target = this.handGesture === 'PINCH' ? this.handEnergy : 0;
    stepSpringScalar(this.pinchSpring, dt, { stiffness: 120, damping: 16 });
    this.uPinchCompress.value = this.pinchSpring.value;

    this.trauma = decayTrauma(this.trauma, 1.8, dt);

    // 3. Apply singularity world position, astrolabe rings & volumetric stage
    this.uSingularityCenter.value.set(this.offsetSpring.x, this.offsetSpring.y, 0);
    this.singularityGroup.position.copy(this.uSingularityCenter.value);

    const spinBoost = 1 + this.activeShockwaveEnergy * 1.4 + this.blowStrength * 0.9;
    this.gyroOuterRing.rotation.z += dt * 0.22 * spinBoost;
    this.gyroOuterRing.rotation.x += dt * 0.09;
    this.gyroInnerRing.rotation.y -= dt * 0.31 * spinBoost;
    this.gyroInnerRing.rotation.z -= dt * 0.12;
    this.gyroPolarRing.rotation.x += dt * 0.19 * spinBoost;
    this.gyroPolarRing.rotation.y += dt * 0.15;

    this.geodesicCage.rotation.y += dt * 0.055;
    this.geodesicCage.rotation.x -= dt * 0.032;
    this.geodesicMat.color.copy(this.uMidColor.value);
    this.geodesicMat.opacity = 0.09 + this.activeShockwaveEnergy * 0.14 + this.pinchSpring.value * 0.1;
    this.horizonRing.rotation.z -= dt * 0.08;
    this.deepStars.rotation.y += dt * 0.006;

    // 4. Spherical Orbital Camera Rig + Parallax + Trauma Shake + DOF Focus
    const shake = this.trauma * this.trauma;
    const shakeX = Math.sin(now * 0.043) * shake * 0.12;
    const shakeY = Math.cos(now * 0.057) * shake * 0.1;

    const effYaw = this.orbitYawSpring.value + this.parallaxSpring.x * 0.16;
    const effPitch = THREE.MathUtils.clamp(
      this.orbitPitchSpring.value + this.parallaxSpring.y * 0.12,
      -1.24,
      1.24
    );
    const radius = this.orbitRadiusSpring.value;
    const cosPitch = Math.cos(effPitch);

    const lookX = this.offsetSpring.x * 0.35;
    const lookY = this.offsetSpring.y * 0.35;

    this.camera.position.set(
      lookX + Math.sin(effYaw) * cosPitch * radius + shakeX,
      lookY + Math.sin(effPitch) * radius + shakeY,
      Math.cos(effYaw) * cosPitch * radius
    );
    this.camera.lookAt(lookX, lookY, 0);

    if (Math.abs(this.camera.fov - this.fovSpring.value) > 0.01) {
      this.camera.fov = this.fovSpring.value;
      this.camera.updateProjectionMatrix();
    }
    this.uDofFocusDist.value = this.camera.position.distanceTo(this.singularityGroup.position);

    // 5. Update Interactive Force Uniforms on camera-aligned interaction plane
    this.camera.getWorldDirection(_vecC).negate();
    _interactionPlane.setFromNormalAndCoplanarPoint(_vecC, this.singularityGroup.position);
    _pointerNdc.set(this.pointerX, this.pointerY);
    _raycaster.setFromCamera(_pointerNdc, this.camera);
    _raycaster.ray.intersectPlane(_interactionPlane, _vecB);
    this.uForceOrigin.value.copy(_vecB);

    if (this.interactionMode === 'GRAVITY') {
      this.uForceMode.value = 0;
      this.uForceStrength.value = 0.72;
    } else if (this.interactionMode === 'WIND') {
      this.uForceMode.value = 1;
      this.uForceStrength.value = this.blowStrength;
    } else {
      if (this.handGesture === 'PINCH') {
        this.uForceMode.value = 2;
        this.uForceStrength.value = Math.max(0.4, this.handEnergy);
      } else if (this.handGesture === 'PALM') {
        this.uForceMode.value = 3;
        this.uForceStrength.value = Math.max(0.4, this.handEnergy);
      } else if (this.handGesture === 'SPREAD') {
        this.uForceMode.value = 4;
        this.uForceStrength.value = Math.max(0.5, this.handEnergy);
      } else {
        this.uForceMode.value = 0;
        this.uForceStrength.value = 0.35;
      }
    }

    // 6. Advance Shockwave
    if (this.activeShockwaveEnergy > 0.005) {
      this.activeShockwaveRadius += dt * 7.8;
      this.activeShockwaveEnergy = Math.max(0, this.activeShockwaveEnergy - dt * 1.15);
      this.uShockRadius.value = this.activeShockwaveRadius;
      this.uShockEnergy.value = this.activeShockwaveEnergy;

      this.shockwaveRing.visible = true;
      this.shockwaveRing.scale.setScalar(this.activeShockwaveRadius);
    } else {
      this.uShockEnergy.value = 0;
      this.shockwaveRing.visible = false;
    }

    // 7. Update Multi-Window Silk Filaments
    for (let i = 0; i < MAX_PEER_FILAMENTS; i++) {
      const mesh = this.filamentMeshes[i];
      const link = this.peerLinks[i];
      if (!link || link.distance < 0.05) {
        mesh.visible = false;
        continue;
      }
      mesh.visible = true;
      _vecA.copy(this.singularityGroup.position);
      _vecB.set(this.offsetSpring.x + link.dx, this.offsetSpring.y + link.dy, 0);
      _vecC.subVectors(_vecB, _vecA);
      const len = _vecC.length();
      mesh.position.addVectors(_vecA, _vecB).multiplyScalar(0.5);
      mesh.scale.set(1, len, 1);
      _vecC.normalize();
      _quatA.setFromUnitVectors(_upAxis, _vecC);
      mesh.quaternion.copy(_quatA);
    }

    // 8. Smoothly damp preset colors & shader uniforms
    const dampT = 1 - Math.exp(-6.0 * dt);
    this.uCoreColor.value.lerp(_targetCoreColor, dampT);
    this.uMidColor.value.lerp(_targetMidColor, dampT);
    this.uRimColor.value.lerp(_targetRimColor, dampT);
    this.uPeakColor.value.lerp(_targetPeakColor, dampT);

    this.uCurlFreq.value = THREE.MathUtils.lerp(this.uCurlFreq.value, this.targetCurlFreq, dampT);
    this.uTurbulence.value = THREE.MathUtils.lerp(this.uTurbulence.value, this.targetTurbulence, dampT);
    this.uGlassIOR.value = THREE.MathUtils.lerp(this.uGlassIOR.value, this.targetGlassIOR, dampT);
    this.uDispersion.value = THREE.MathUtils.lerp(this.uDispersion.value, this.targetDispersion, dampT);
    this.uBloomStrength.value = THREE.MathUtils.lerp(this.uBloomStrength.value, this.targetBloomStrength, dampT);
    this.uBloomThreshold.value = THREE.MathUtils.lerp(this.uBloomThreshold.value, this.targetBloomThreshold, dampT);
    this.uDofFocalLen.value = THREE.MathUtils.lerp(this.uDofFocalLen.value, this.targetDofFocalLen, dampT);
    this.uChromaticStrength.value = THREE.MathUtils.lerp(this.uChromaticStrength.value, this.targetChromatic, dampT);
    this.uAnamorphicIntensity.value = THREE.MathUtils.lerp(this.uAnamorphicIntensity.value, this.targetAnamorphic, dampT);

    // 9. GPU Compute + Render
    this.renderer.compute(this.computeAdvect);
    if (this.renderPipeline && !this.isSoftwareGl) {
      this.renderPipeline.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }

    // 10. Throttled Telemetry (<= 4Hz)
    this.frameCounter++;
    if (now - this.lastTelemetryAt >= 450) {
      const elapsedSec = (now - this.lastTelemetryAt) / 1000;
      this.currentFps = Math.max(1, Math.round(this.frameCounter / Math.max(elapsedSec, 0.001)));
      this.frameCounter = 0;
      this.lastTelemetryAt = now;
      this.emitTelemetry();
    }

    this.scheduleNextFrame();
  };

  private scheduleNextFrame() {
    if (this.isDisposed) return;

    if (this.isSoftwareGl) {
      this.afterDraw(() => {
        if (!this.isDisposed) {
          this.frameId = requestAnimationFrame(this.tick);
        }
      });
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  }

  private afterDraw(cb: () => void) {
    const backendAny = this.renderer.backend as unknown as { gl?: WebGL2RenderingContext };
    const gl = backendAny?.gl;
    if (gl && typeof gl.fenceSync === 'function') {
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (this.isDisposed) {
          if (sync) gl.deleteSync(sync);
          return;
        }
        const state = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
        if (state === gl.UNSIGNALED) {
          this.frameId = window.setTimeout(poll, 6);
        } else {
          if (sync) gl.deleteSync(sync);
          this.frameId = window.setTimeout(cb, 80);
        }
      };
      this.frameId = window.setTimeout(poll, 6);
    } else {
      this.frameId = window.setTimeout(cb, 80);
    }
  }

  private emitTelemetry() {
    this.callbacks.onTelemetry?.({
      backend: this.backendKind,
      particleCount: PARTICLE_COUNT,
      nodeCount: this.nodeCount,
      fps: this.currentFps,
      isSoftwareGl: this.isSoftwareGl,
      cameraDistance: Number(this.orbitRadiusSpring.value.toFixed(1)),
    });
  }

  private handleResize = () => {
    if (this.isDisposed || !this.renderer || !this.camera) return;
    const width = Math.max(1, this.container.clientWidth || window.innerWidth);
    const height = Math.max(1, this.container.clientHeight || window.innerHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  private handleContextLost = (e: Event) => {
    e.preventDefault();
    this.callbacks.onError?.('Graphics context was interrupted. Reload to restore rendering.');
  };

  public dispose() {
    this.isDisposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    window.removeEventListener('resize', this.handleResize);
    if (this.renderer?.domElement) {
      this.renderer.domElement.removeEventListener('webglcontextlost', this.handleContextLost);
    }
    this.pmremGenerator?.dispose();
    this.scene?.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.Sprite || obj instanceof THREE.Points || obj instanceof THREE.LineSegments) {
        obj.geometry?.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else {
          obj.material?.dispose();
        }
      }
    });
    this.renderer?.dispose();
    if (this.renderer?.domElement?.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
