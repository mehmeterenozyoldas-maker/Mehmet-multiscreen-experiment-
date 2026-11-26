import type { MetapromptModules } from './types';

export const DEFAULT_METAPROMPT_MODULES: MetapromptModules = {
  gpgpuAdvection: true,
  sdfRaymarching: true,
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
    label: 'GPGPU Curl Advection',
    tdAnalog: 'POP / Compute TOP',
    summary: '65,536-particle GPU storage buffers driven by 3D curl noise and attractors.',
  },
  {
    key: 'sdfRaymarching',
    label: 'Raymarched Liquid Glass SDF',
    tdAnalog: 'Raymarch GLSL TOP',
    summary: 'Smooth-union metaballs, FBM surface ripples, Fresnel rim, and RGB dispersion.',
  },
  {
    key: 'springRig',
    label: 'Second-Order Spring Rig',
    tdAnalog: 'CHOP Spring / Lag',
    summary: 'Frame-rate independent stiffness/damping kinematics for inertia and camera parallax.',
  },
  {
    key: 'postProcessing',
    label: 'Cinematic RenderPipeline',
    tdAnalog: 'TOP Bloom + Luma',
    summary: 'HDR selective bloom, bokeh depth of field, chromatic aberration, and anamorphic flare.',
  },
  {
    key: 'multiWindowSync',
    label: 'Multi-Window Spatial Sync',
    tdAnalog: 'TouchIn / Out Sync',
    summary: 'BroadcastChannel desktop coordinate projection with silk inter-window filaments.',
  },
  {
    key: 'mediaPipeVision',
    label: 'Unified MediaPipe Vision',
    tdAnalog: 'MediaPipe CHOP',
    summary: 'Single-stream FaceMesh blow emitter and 21-point Hand gesture sculpting.',
  },
];

export function buildMasterMetaprompt(modules: MetapromptModules): string {
  const sections: string[] = [];

  sections.push(
`# MASTER METAPROMPT — TOUCHDESIGNER-GRADE WEB3D SPATIAL VFX ENGINE

## 1. ROLE & RENDERING CONSTITUTION
Act as a Principal Graphics Engineer and TouchDesigner Technical Director. Build a real-time, interactive 3D spatial VFX engine in TypeScript + React + Three.js (\`three/webgpu\` & \`three/tsl\`) using \`THREE.WebGPURenderer\` with automatic \`WebGL2\` backend fallback.

Architecture Parity with TouchDesigner:
- Treat GPU compute buffers (\`instancedArray\`) as POP/Compute TOP particle operators.
- Treat TSL node graphs (\`Fn\`, \`uniform\`, \`MeshBasicNodeMaterial\`) as GLSL MAT/TOP shaders.
- Treat second-order spring integrators as CHOP kinematics channels.
- Treat \`THREE.RenderPipeline\` as the final TOP compositing chain.

Hard Constraints:
- Zero GC allocations inside \`requestAnimationFrame\` (pre-allocate \`Vector3\`, \`Color\`, \`Matrix4\` at module scope).
- Detect software WebGL (\`SwiftShader\` / \`llvmpipe\`) via \`WEBGL_debug_renderer_info\` to skip multi-pass post-processing and pace frames via \`afterDraw()\` without altering scene geometry or counts.
- Never apply CSS \`backdrop-filter\` over the active 3D canvas; use solid/translucent obsidian surfaces (\`rgba(11, 15, 23, 0.88)\`) with \`1px\` hairline borders (\`rgba(255, 255, 255, 0.08)\`).`
  );

  if (modules.gpgpuAdvection) {
    sections.push(
`## 2. GPGPU 3D CURL-NOISE PARTICLE ADVECTION (POP / COMPUTE GRAPH)
Allocate 65,536 particles in GPU storage buffers via \`instancedArray(65536, 'vec3')\` for \`positions\`, \`velocities\`, and \`seeds\`.
Implement two TSL compute shaders executed after \`await renderer.init()\`:
1. \`computeInit\`: Distribute particles across nested Fibonacci spherical shells and toroidal orbital bands with deterministic hash seeds.
2. \`computeAdvect\`: Every frame (\`dt\` clamped to \`0.05s\`):
   - Evaluate divergence-free 3D curl noise (\`∇ × Ψ\`) using finite-difference derivatives of animated 3D trigonometric/simplex potential fields.
   - Apply tangential orbital swirl around the local singularity centroid + spring-restoring radial containment.
   - Inject interactive force wells (mouse gravity, FaceMesh blow cone, Hand pinch/vortex/spread) and expanding spherical shockwave impulses.
   - Render via \`THREE.PointsNodeMaterial\` with velocity-mapped chromatic ramps (Core → Mid → Rim → Shockwave Amber Peak) and additive energy blending.`
    );
  }

  if (modules.sdfRaymarching) {
    sections.push(
`## 3. RAYMARCHED LIQUID-GLASS SDF SINGULARITY CORE (RAYMARCH TOP)
Render the central singularity inside a bounding proxy sphere (\`SphereGeometry\`) using a custom TSL \`MeshBasicNodeMaterial\` (\`colorNode\` + \`opacityNode\`):
- Transform camera ray origin and view direction into singularity-local space.
- Raymarch (36–48 steps) an analytical Signed Distance Field combining:
  - A central breathing core sphere perturbed by domain-warped 3D FBM ripples.
  - Three orbiting satellite droplets blended via polynomial smooth-union (\`smin(d1, d2, k)\`).
  - Dynamic pinch compression and shockwave surface ripples.
- On surface intersection:
  - Compute central-difference surface normals (\`∇SDF\`).
  - Evaluate Schlick Fresnel rim reflection (\`(1 - dot(N, V))^4\`).
  - Sample internal caustic spectrum at staggered RGB refracted directions (\`refract(-V, N, 1.0 / (ior ± dispersion))\`) for authentic chromatic optical dispersion.`
    );
  }

  if (modules.springRig) {
    sections.push(
`## 4. SECOND-ORDER SPRING KINEMATICS & CAMERA RIG (CHOP PARITY)
Drive all spatial motion with frame-rate independent second-order springs (\`F = k*(target - x) - c*v\`, sub-stepped when \`dt > 0.02s\`):
- \`windowOffsetSpring\`: Smooths multi-window centroid shifts when dragging browser windows across the desktop.
- \`windowVelocityInertia\`: Converts screen-space drag deltas into physical directional drag inside the GPU particle compute shader.
- \`cameraParallaxSpring\`: Subtle mouse/face/hand parallax tilt and FOV breathing (\`50°\` base + energy-coupled kick).
- \`trauma\`: Decaying quadratic trauma (\`trauma * trauma\`) on click shockwaves and two-hand radial bursts.`
    );
  }

  if (modules.postProcessing) {
    sections.push(
`## 5. CINEMATIC RENDER PIPELINE (TOP COMPOSITOR)
Compose the GPU post-processing chain using \`THREE.RenderPipeline\`:
1. \`scenePass = pass(scene, camera)\` extracting \`output\` color and \`viewZ\` depth nodes.
2. Selective HDR \`bloom(sceneColor)\` with tunable luminance threshold, strength, and radius.
3. \`dof(bloomed, viewZNode, focusDistance, focalLength, bokehScale)\` locked dynamically to camera-to-singularity distance.
4. Custom TSL Anamorphic Horizontal Lens Streak node (wide horizontal directional highlight sampling across bright emissive peaks).
5. Radial \`chromaticAberration\` + subtle cinema vignette grading.
6. Gate \`RenderPipeline\` behind \`!isSoftwareGl\` so software WebGL renders directly via \`renderer.render(scene, camera)\`.`
    );
  }

  if (modules.multiWindowSync) {
    sections.push(
`## 6. MULTI-WINDOW BROADCASTCHANNEL SPATIAL SYNC
Synchronize arbitrary desktop browser windows into one continuous 3D volumetric stage via \`BroadcastChannel\`:
- Broadcast \`{ id, x: window.screenX, y: window.screenY, w: window.innerWidth, h: window.innerHeight, mode, gesture, updatedAt }\` at ~30Hz and on resize/move.
- Prune stale peers after 2400ms; compute global \`WorldBounds\` across self + active peers.
- Compute \`localSingularityOffset = (bounds.center - self.center) * worldScalePerPixel\` so the raymarched singularity floats at the shared geometric centroid across window bezels.
- Render dynamic silk energy filaments (\`TubeGeometry\` / volumetric ribbons) connecting the local core to remote peer centroids in Electric Violet (\`#A78BFA\`).`
    );
  }

  if (modules.mediaPipeVision) {
    sections.push(
`## 7. UNIFIED SINGLE-STREAM MEDIAPIPE VISION PIPELINE
Run \`FaceLandmarker\` and \`HandLandmarker\` (\`@mediapipe/tasks-vision\`) sequentially on a single shared \`getUserMedia\` video stream inside an adaptive \`requestAnimationFrame\` scheduler (never open two concurrent webcam streams):
- \`WIND\` Mode (Face): Map nose tip landmark to spatial wind emitter coordinates; compute mouth aperture / pucker ratio to drive turbulent blow force into the GPGPU compute shader.
- \`HAND\` Mode (Hands): Extract 21-point hand landmarks—thumb-index pinch condenses and charges the core (\`PINCH\`), open palm drives a curl-noise vortex (\`PALM\`), and two-hand separation triggers a radial field burst (\`SPREAD\`).
- Always degrade gracefully to mouse Gravity + click shockwaves if camera permissions are denied or unavailable.`
    );
  }

  sections.push(
`## 8. OBSIDIAN STUDIO HUD & ANTI-PATTERN GUARDRAILS
- Keep the central 3D viewport 100% unobstructed. Consolidate all controls into a single collapsible bottom dock (\`H\` hotkey for Cinema/Zen mode).
- Use \`Outfit\` for display titles, \`Plus Jakarta Sans\` for single-line controls (\`whitespace-nowrap\`), and \`JetBrains Mono\` with \`tabular-nums\` for coordinates and metrics.
- Ban static metadata pills, animated pulsing status dots, thick left accent borders, and \`backdrop-filter\` over the live canvas.`
  );

  return sections.join('\n\n');
}
