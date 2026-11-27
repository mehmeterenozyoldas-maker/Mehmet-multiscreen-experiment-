import type { MetapromptModules } from './types';

export const DEFAULT_METAPROMPT_MODULES: MetapromptModules = {
  gpgpuAdvection: true,
  sdfRaymarching: true,
  volumetricStage: true,
  springRig: true,
  postProcessing: true,
  multiWindowSync: true,
  mediaPipeVision: true,
};

export interface MetapromptModuleMeta {
  key: keyof MetapromptModules;
  label: string;
  tdAnalog: string;
  summary: string;
}

export const METAPROMPT_MODULE_LIST: MetapromptModuleMeta[] = [
  {
    key: 'gpgpuAdvection',
    label: 'GPGPU Curl + Lorentz Solver',
    tdAnalog: 'POP / Compute TOP',
    summary:
      '65,536-particle storage buffers driven by divergence-free 3D curl, Lorentz dipole torque, and Keplerian shear.',
  },
  {
    key: 'sdfRaymarching',
    label: 'Volumetric Glass SDF & Beer-Lambert',
    tdAnalog: 'Raymarch GLSL TOP',
    summary:
      'CSG smooth-union core + undulating plasma torus, tetrahedral normals, Beer-Lambert absorption, and RGB Cauchy dispersion.',
  },
  {
    key: 'volumetricStage',
    label: '3D Volumetric Stage & Orbital Rig',
    tdAnalog: 'SOP Geo + Camera COMP',
    summary:
      'Spherical spring-damped 3D orbit/dolly rig, deep parallax starfield, geodesic containment lattice, and Fresnel corona shell.',
  },
  {
    key: 'springRig',
    label: 'Second-Order CHOP Kinematics',
    tdAnalog: 'CHOP Spring / Lag',
    summary:
      'Sub-stepped second-order differential springs for orbital inertia, FOV breathing, pinch compression, and quadratic trauma.',
  },
  {
    key: 'postProcessing',
    label: 'Cinematic RenderPipeline',
    tdAnalog: 'TOP Bloom + Luma',
    summary:
      'HDR selective bloom, dynamic bokeh depth of field, directional anamorphic streak flare, and radial chromatic aberration.',
  },
  {
    key: 'multiWindowSync',
    label: 'Multi-Window Spatial Sync',
    tdAnalog: 'TouchIn / Out Sync',
    summary:
      'BroadcastChannel global desktop coordinate projection, shared world-space centroid, and silk inter-window filaments.',
  },
  {
    key: 'mediaPipeVision',
    label: 'Unified MediaPipe Vision',
    tdAnalog: 'MediaPipe CHOP',
    summary:
      'Single-stream sequential FaceMesh blow cone and 21-point Hand gesture sculpting with graceful Gravity fallback.',
  },
];

export function buildMasterMetaprompt(modules: MetapromptModules): string {
  const sections: string[] = [];

  sections.push(
`# MASTER METAPROMPT — COMPUTATIONAL 3D SPATIAL VFX ENGINE (TOUCHDESIGNER PARITY)

## 1. ROLE, MATHEMATICAL CONSTITUTION & OPERATOR GRAPH
Act as a Principal Computational Graphics Engineer and TouchDesigner Technical Director. Architect a real-time, deeply 3D, physically reactive spatial VFX simulation in TypeScript + React + Three.js (\`three/webgpu\` & \`three/tsl\`) targeting \`THREE.WebGPURenderer\` with automatic \`WebGL2\` Transform Feedback fallback.

### TouchDesigner Node-Graph Parity
- **POP / Compute TOP** -> GPU \`instancedArray\` storage buffers + \`Fn().compute(N)\` symplectic integrators
- **Raymarch GLSL TOP** -> Analytical CSG Signed Distance Fields + optical ray transport in TSL node materials
- **SOP / Geo COMP + Camera COMP** -> Multi-strata 3D volumetric geometry, geodesic spatial cages, and spherical spring-damped orbital camera rig
- **CHOP Spring / Lag** -> Sub-stepped second-order harmonic oscillators (\`d²x/dt² = k(x_target - x) - c·dx/dt\`)
- **TOP Post Compositor** -> \`THREE.RenderPipeline\` (\`pass\`, \`bloom\`, \`dof\`, \`gaussianBlur\`, \`chromaticAberration\`)

### Computational & Numerical Discipline
- **Zero GC inside \`requestAnimationFrame\`**: Pre-allocate all \`Vector3\`, \`Vector2\`, \`Quaternion\`, \`Color\`, \`Raycaster\`, and \`Plane\` scratch structures at module scope.
- **Software-GL Adaptation**: Detect \`SwiftShader\` / \`llvmpipe\` via \`WEBGL_debug_renderer_info\` to bypass multi-pass \`RenderPipeline\` and pace frames via WebGL2 sync fences (\`afterDraw()\`) without altering particle count or 3D scene topology.
- **No CSS \`backdrop-filter\` over Live WebGPU/WebGL Canvases**: Use crisp obsidian surfaces (\`rgba(11, 15, 23, 0.90)\`) with \`1px\` hairline borders (\`rgba(255, 255, 255, 0.08)\`).`
  );

  if (modules.gpgpuAdvection) {
    sections.push(
`## 2. GPGPU CURL-NOISE, LORENTZ DIPOLE & KEPLERIAN SOLVER (POP / COMPUTE TOP)
Allocate \`N = 65,536\` particles across three GPU \`vec3\` storage buffers (\`positions\`, \`velocities\`, \`seeds\`) via \`instancedArray(65536, 'vec3')\`. Execute \`computeInit\` once post-\`renderer.init()\`, then dispatch \`computeAdvect\` every frame (\`Δt ≤ 0.05s\`):

1. **Multi-Shell Fibonacci / Toroidal Seeding (\`computeInit\`)**:
   - Sample deterministic hashes \`h1..h4\` per \`instanceIndex\` across three stratified radial regimes: inner accretion halo (\`r ∈ [1.55, 2.65]\`), mid curl-ribbon torus (\`r ∈ [2.5, 5.1]\`), and outer volumetric field (\`r ∈ [5.1, 8.9]\`).
2. **Continuous Force-Field Superposition (\`computeAdvect\`)**:
   - **Divergence-Free 3D Curl Potential**: Compute \`u_curl(p) = ∇ × Ψ(p, t)\` using continuous 3D gyroid cross-derivatives scaled by \`uCurlFreq\` and \`uTurbulence\`, guaranteeing incompressible fluid vorticity.
   - **Lorentz Magnetic Dipole Torque**: Model a precessing dipole axis \`m(t) = normalize(0.28·sin(0.22t), 1, 0.28·cos(0.17t))\`. Evaluate the dipole vector field:
     \`B(r) = (3·dot(m, r̂)·r̂ - m) / max(|r|³, 0.04)\`
     Inject \`F_lorentz = q · (v × B(r))\` so particles spiral dynamically along arched magnetic flux lines and polar jets.
   - **Keplerian Differential Shear & Radial Containment**: Apply tangential shear \`ω(r) = k_orbit · r^(-0.45) · (m × r̂)\` balanced by a pinch-compressible harmonic shell spring \`k_rad · (r_target - |r|) · r̂\`.
   - **Interactive Force Wells & Desktop Inertia**: Superimpose \`uWindowInertia\` (screen-space drag impulse), mode-specific force fields (3D Gravity attractor, FaceMesh blow cone, Hand Pinch/Vortex/Spread), and Gaussian-envelope spherical shockwave impulses \`A·exp(-2.2·(|r - r_shock| - R_shock)²)\`.
3. **Symplectic Semi-Implicit Euler Integration & Rendering**:
   - Update velocity first (\`v_{t+Δt} = v_t·damp + a_t·Δt\`, clamped \`|v| ≤ 11.0\`), then advance position (\`x_{t+Δt} = x_t + v_{t+Δt}·Δt\`).
   - Render via \`THREE.Sprite\` + \`THREE.PointsNodeMaterial\` (\`.toAttribute()\` + \`.toVarying()\`) with speed-modulated sprite scaling, additive energy blending, and chromatic velocity ramp (\`uMidColor → uRimColor → uPeakColor\`).`
    );
  }

  if (modules.sdfRaymarching) {
    sections.push(
`## 3. VOLUMETRIC CSG SDF SINGULARITY & BEER-LAMBERT OPTICS (RAYMARCH GLSL TOP)
Render the central singularity inside a bounding proxy sphere (\`SphereGeometry(2.75)\`) using a custom TSL \`MeshBasicNodeMaterial\`:

1. **Dynamic CSG Signed Distance Field (\`mapSDF(p)\`)**:
   - **Breathing Core + Gyroid FBM**: \`d_core = |p| - 0.86·breathe(t, uPinchCompress) + 0.055·gyroid(2.6p + vel_t) + shockRipple(|p|, R_shock)\`.
   - **Undulating Equatorial Accretion Torus (\`sdTorus\`)**: Rotate \`p\` into a slowly precessing tilted torus frame and evaluate \`d_torus = |( |p_xz| - 1.12, p_y )| - (0.11 + wave(p_xz, t))\` so the singularity exhibits unmistakable 3D sculptural dimensionality from every orbit angle.
   - **Smooth-Union Orbital Satellites**: Blend three non-coplanar orbiting droplets (\`d1, d2, d3\`) with the core and torus using polynomial smooth-minimum \`smin(a, b, k) = mix(b, a, h) - k·h·(1 - h)\`.
2. **Tetrahedral Gradients & Optical Ray Transport**:
   - Compute 4-tap tetrahedral normals \`N = normalize(Σ k_i · mapSDF(p + ε·k_i))\`.
   - Evaluate Schlick Fresnel rim reflectance \`F = (1 - dot(N, V))^3.8\`.
   - **Staggered RGB Cauchy Dispersion**: Refract view ray \`rd\` through \`η_R = 1/IOR - δ\`, \`η_G = 1/IOR\`, \`η_B = 1/IOR + δ\` via \`refract(rd, N, η)\`, sampling internal procedural caustic filaments along each dispersed channel.
   - **Beer-Lambert Volumetric Absorption**: Probe internal SDF depth along the refracted green ray \`d_inner = mapSDF(pHit + 0.42·gRay)\` to estimate optical chord thickness \`τ = clamp(-2.2·d_inner, 0.08, 1.45)\`, attenuating transmitted spectrum by \`exp(-1.35·τ)\` toward deep obsidian glass \`uCoreColor\`.`
    );
  }

  if (modules.volumetricStage) {
    sections.push(
`## 4. 3D VOLUMETRIC STAGE & SPHERICAL ORBITAL CAMERA RIG (SOP GEO + CAMERA COMP)
Transform the viewport from a flat 2D frame into an explorable 3D spatial instrument:

1. **Multi-Strata 3D Spatial Architecture**:
   - **Deep Volumetric Parallax Starfield**: Distribute \`2,400\` spectral points across spherical shells \`r ∈ [16, 46]\` tinted across deep slate, optical cyan, and violet so camera orbits immediately convey monumental 3D parallax depth.
   - **Geodesic Spatial Containment Cage**: Surround the accretion volume with an \`EdgesGeometry(IcosahedronGeometry(3.35, 1))\` wireframe lattice that rotates slowly in 3D and subtly modulates opacity with shockwave & pinch energy.
   - **3-Axis Metallic Astrolabe + Calibrated Equatorial Horizon Ring**: Layer three non-coplanar orbital rings (\`gyroOuterRing\`, \`gyroInnerRing\`, \`gyroPolarRing\`) plus an outer equatorial reference ring (\`r = 4.1\`).
   - **Additive Volumetric Fresnel Corona Shell**: Wrap the core in a \`BackSide\` translucent sphere (\`r = 2.15\`) computing view-edge atmospheric scatter \`pow(1 - |dot(N_view, V)|, 3.2)\`.
2. **Spring-Damped Spherical Orbital Camera Rig**:
   - Parameterize camera pose in spherical coordinates \`(orbitRadius, orbitYaw, orbitPitch)\` around \`0.35 · singularityCenter\`, each smoothed by an independent second-order spring.
   - **Immersive Controls**: Pointer drag (> 5px) orbits azimuth & elevation (\`pitch ∈ [-1.22, 1.22] rad\`); short click (≤ 5px) emits a 3D raycast shockwave; scroll wheel smoothly dollies zoom (\`radius ∈ [4.6, 16.5]\`); double-click or \`R\` smoothly springs back to canonical hero framing.`
    );
  }

  if (modules.springRig) {
    sections.push(
`## 5. SECOND-ORDER SPRING KINEMATICS (CHOP SPRING / LAG PARITY)
Drive all camera, offset, and energy channels with sub-stepped second-order differential equations (\`subSteps = dt > 0.02 ? 2 : 1\`, \`dt ≤ 0.05s\`):
- \`offsetSpring\` (\`Vec3\`, \`k=95, c=14\`): Smooths multi-window world-centroid shifts when dragging windows across monitors.
- \`orbitYawSpring\`, \`orbitPitchSpring\`, \`orbitRadiusSpring\`: Fluid physical inertia on 3D camera orbit and scroll dolly.
- \`parallaxSpring\` (\`Vec3\`, \`k=70, c=13\`): Layers subtle pointer/head parallax atop the orbital spherical frame.
- \`fovSpring\` (\`k=80, c=14\`): Dynamic \`50°\` base lens breathing coupled to shockwaves, wind gusts, and two-hand radial bursts.
- \`trauma\`: Linear decay feeding quadratic camera shake (\`trauma²\`) for tactile physical impact.`
    );
  }

  if (modules.postProcessing) {
    sections.push(
`## 6. CINEMATIC RENDER PIPELINE (TOP COMPOSITOR)
Compose the final GPU compositing graph via \`THREE.RenderPipeline\` (gated by \`!isSoftwareGl\`):
1. \`scenePass = pass(scene, camera)\` extracting \`output\` color and \`viewZ\` linear depth.
2. Selective HDR \`bloom(sceneColor)\` with runtime-tunable luminance threshold and strength.
3. Dynamic bokeh \`dof(chain, viewZ, focusDist, focalLen, 0.85)\` auto-focused onto \`distance(camera, singularity)\`.
4. Directional horizontal **Anamorphic Lens Streak** via \`gaussianBlur(convertToTexture(bloomPass), vec2(7.0, 0.12), 4, { resolutionScale: 0.5 })\` tinted by \`uMidColor\`.
5. Radial \`chromaticAberration\` + subtle cinema edge vignette grading.`
    );
  }

  if (modules.multiWindowSync) {
    sections.push(
`## 7. MULTI-WINDOW BROADCASTCHANNEL SPATIAL SYNC
Unify multiple browser windows into a single continuous 3D desktop stage via \`BroadcastChannel\`:
- Broadcast \`{ id, x: screenX, y: screenY, w: innerWidth, h: innerHeight, mode, gesture, updatedAt }\` at ~25Hz and on move/resize.
- Prune stale peers (> 2400ms), compute global \`WorldBounds\`, and map \`localSingularityOffset = (bounds.center - self.center) * worldScalePerPixel\`.
- Connect active peer centroids with pulsing additive silk filaments in Electric Violet (\`#A78BFA\`) and synchronize \`SHOCKWAVE\` impulses across all nodes.`
    );
  }

  if (modules.mediaPipeVision) {
    sections.push(
`## 8. UNIFIED SINGLE-STREAM MEDIAPIPE VISION PIPELINE
Run \`FaceLandmarker\` and \`HandLandmarker\` (\`@mediapipe/tasks-vision\`) sequentially on one shared \`getUserMedia\` video stream inside an adaptive \`requestAnimationFrame\` scheduler (~24Hz inference):
- **WIND (FaceMesh)**: Map nose tip to 3D emitter origin and mouth aperture/pucker ratio to turbulent directional blow force.
- **HAND (21-Point Landmarks)**: Map thumb-index pinch to \`PINCH\` core condensation, open palm to \`PALM\` curl vortex, and two-hand spread to \`SPREAD\` radial shock burst.
- Degrade cleanly to Mouse Gravity + 3D Orbit + Click Shockwaves whenever webcam access is denied or unavailable.`
    );
  }

  sections.push(
`## 9. OBSIDIAN STUDIO HUD & IMMERSIVE ERGONOMICS
- Keep >90% of the 3D stage unobstructed. Consolidate mode switching, VFX optical tuning, topology minimap, and Metaprompt Studio into a single collapsible bottom dock (\`H\` toggles Cinema/Zen mode; \`R\` resets 3D orbit).
- Typography: \`Outfit\` display headers, \`Plus Jakarta Sans\` single-line controls (\`whitespace-nowrap\`), \`JetBrains Mono\` (\`tabular-nums\`) for telemetry and parameters.
- Zero pill clutter, zero pulsing status dots, and zero CSS \`backdrop-filter\` over the live 3D canvas.`
  );

  return sections.join('\n\n');
}
