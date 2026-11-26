# Neural Singularity — TouchDesigner-Grade Web3D Master Metaprompt

Use this standalone specification (or customize it live inside the in-app **Metaprompt Studio**) to generate or extend real-time, TouchDesigner-caliber 3D spatial VFX engines on the web using Three.js WebGPU + TSL.

---

## 1. Role & Rendering Constitution
Act as a Principal Graphics Engineer and TouchDesigner Technical Director. Build a real-time, interactive 3D spatial VFX engine in TypeScript + React + Three.js (`three/webgpu` & `three/tsl`) using `THREE.WebGPURenderer` with automatic `WebGL2` backend fallback.

### TouchDesigner Operator Parity
- **POP / Compute TOP** -> `instancedArray` GPU storage buffers + `Fn().compute(count)` shaders
- **GLSL MAT / Raymarch TOP** -> TSL node graphs (`MeshBasicNodeMaterial`, `MeshStandardNodeMaterial`)
- **CHOP Spring / Lag** -> Frame-rate independent second-order spring kinematics (`stiffness`, `damping`)
- **TOP Post Compositor** -> `THREE.RenderPipeline` (`pass`, `bloom`, `dof`, `gaussianBlur`, `chromaticAberration`)

### Performance & Rendering Guardrails
- Zero Garbage Collection inside the render loop: pre-allocate `Vector3`, `Quaternion`, `Color`, `Raycaster`, and `Plane` instances at module scope.
- Detect software WebGL (`SwiftShader`, `llvmpipe`, `softpipe`) via `WEBGL_debug_renderer_info` to skip multi-pass `RenderPipeline` and pace frames via `afterDraw()` without altering scene geometry or counts.
- Never apply CSS `backdrop-filter` over the live GPU canvas; use solid/translucent obsidian surfaces (`rgba(11, 15, 23, 0.88)`) with `1px` hairline borders (`rgba(255, 255, 255, 0.08)`).

---

## 2. GPGPU 3D Curl-Noise Particle Advection
- Allocate 65,536 particles in GPU storage buffers (`positions`, `velocities`, `seeds`) via `instancedArray(65536, 'vec3')`.
- Seed particles across nested spherical accretion shells and orbital ribbons in `computeInit`.
- In `computeAdvect` (invoked synchronously after `await renderer.init()`):
  - Evaluate divergence-free 3D gyroid curl turbulence scaled by `curlFrequency` and `turbulence`.
  - Apply tangential orbital swirl around the local singularity centroid plus radial harmonic containment.
  - Inject desktop window-drag inertia (`uWindowInertia`) so moving browser windows physically sloshes the particle field.
  - Apply mode-dependent force wells (Mouse Gravity, FaceMesh Wind Cone, Hand Pinch / Palm Vortex / Two-Hand Spread) and expanding spherical shockwave impulses.
- Render particles with `THREE.Sprite` + `THREE.PointsNodeMaterial` (`count = 65536`) so particle sizing (`sizeNode`), velocity-mapped chromatic ramps, and soft circular falloff render consistently across both WebGPU and WebGL2.

---

## 3. Raymarched Liquid-Glass SDF Singularity Core
- Render the central singularity inside a bounding proxy sphere (`SphereGeometry`) using a custom TSL `MeshBasicNodeMaterial`.
- Raymarch an analytical SDF combining:
  - A breathing central core perturbed by 3D domain-warped gyroid ripples and shockwave surface waves.
  - Three orbiting satellite droplets merged seamlessly via polynomial smooth-union (`smin`).
- Compute 4-tap tetrahedral SDF normals (`∇SDF`), Schlick Fresnel rim glow, studio softbox reflections, and staggered RGB `refract()` dispersion (`ior ± dispersion`) sampling internal caustic filaments.

---

## 4. Second-Order Spring Kinematics & Camera Rig
- Smooth multi-window centroid shifts (`offsetSpring`), camera mouse/head parallax (`parallaxSpring`), FOV breathing (`fovSpring`), and hand-pinch core compression (`pinchSpring`) with sub-stepped second-order springs (`dt` clamped to `0.05s`).
- Apply decaying quadratic trauma (`trauma * trauma`) on click shockwaves and two-hand field bursts.

---

## 5. Cinematic Post-Processing Stack (`RenderPipeline`)
1. `scenePass = pass(scene, camera)` extracting `output` color and `viewZ` depth nodes.
2. Selective HDR `bloom(sceneColor)` with tunable strength and luminance threshold.
3. Bokeh `dof()` dynamically locked to camera-to-singularity focus distance.
4. Horizontal anamorphic streak flare via directional `gaussianBlur(convertToTexture(bloomPass), vec2(7.0, 0.12))`.
5. Radial `chromaticAberration` + subtle edge vignette grading.

---

## 6. Multi-Window BroadcastChannel Spatial Sync
- Broadcast screen bounds (`x`, `y`, `w`, `h`, `mode`, `gesture`, `updatedAt`) at ~22–30Hz over `BroadcastChannel`.
- Prune stale peers (`> 2400ms`), compute global `WorldBounds`, and project `localSingularityOffset = (bounds.center - self.center) * worldScalePerPixel`.
- Connect peer window centers with animated additive silk filaments in Electric Violet (`#A78BFA`) and broadcast `SHOCKWAVE` impulses across all open windows.

---

## 7. Unified Single-Stream MediaPipe Vision
- Share a single `getUserMedia` stream sequentially across `FaceLandmarker` (`WIND` mode) and `HandLandmarker` (`HAND` mode) inside an adaptive `requestAnimationFrame` scheduler (~24Hz inference).
- Map nose tip + mouth aperture/width pucker ratio to spatial blow force, and map 21-point hand landmarks to `PINCH`, `PALM`, and two-hand `SPREAD` sculpting gestures, always degrading gracefully to Mouse Gravity if camera access is unavailable.
