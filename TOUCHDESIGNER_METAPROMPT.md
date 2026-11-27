# Neural Singularity — Computational 3D TouchDesigner-Grade Master Metaprompt

Use this standalone blueprint (or customize modules live inside the in-app **Metaprompt Studio**) to generate or extend real-time, TouchDesigner-caliber computational 3D spatial VFX engines on the web using Three.js WebGPU + TSL.

---

## 1. Role, Mathematical Constitution & TouchDesigner Parity
Act as a Principal Computational Graphics Engineer and TouchDesigner Technical Director. Build a real-time, deeply 3D, physically reactive spatial VFX simulation in TypeScript + React + Three.js (`three/webgpu` & `three/tsl`) targeting `THREE.WebGPURenderer` with automatic `WebGL2` Transform Feedback fallback.

### Operator Parity
- **POP / Compute TOP** -> `instancedArray` GPU storage buffers + `Fn().compute(N)` symplectic integrators
- **Raymarch GLSL TOP** -> Analytical CSG Signed Distance Fields + Beer-Lambert optical ray transport in TSL node materials
- **SOP / Geo COMP + Camera COMP** -> Deep 3D parallax starfield, geodesic spatial containment cage, Fresnel corona shell, and spring-damped spherical orbital camera rig
- **CHOP Spring / Lag** -> Sub-stepped second-order harmonic oscillators (`d²x/dt² = k(x_target - x) - c·dx/dt`)
- **TOP Post Compositor** -> `THREE.RenderPipeline` (`pass`, `bloom`, `dof`, `gaussianBlur`, `chromaticAberration`)

### Performance & Numerical Guardrails
- **Zero GC inside `requestAnimationFrame`**: Pre-allocate `Vector3`, `Vector2`, `Quaternion`, `Color`, `Raycaster`, and `Plane` instances at module scope.
- **Software-GL Adaptation**: Detect `SwiftShader` / `llvmpipe` via `WEBGL_debug_renderer_info` to bypass multi-pass `RenderPipeline` and pace frames via `afterDraw()` without altering particle count or 3D scene topology.
- **No CSS `backdrop-filter` over Live Canvases**: Use obsidian surfaces (`rgba(11, 15, 23, 0.90)`) with `1px` hairline borders (`rgba(255, 255, 255, 0.08)`).

---

## 2. GPGPU Curl-Noise, Lorentz Dipole & Keplerian Solver (`POP / Compute TOP`)
Allocate `65,536` particles across GPU `vec3` storage buffers (`positions`, `velocities`, `seeds`) via `instancedArray(65536, 'vec3')`.

1. **Multi-Shell Seeding (`computeInit`)**: Distribute particles deterministically across nested spherical accretion halos (`r ∈ [1.55, 2.65]`), curl ribbons (`r ∈ [2.5, 5.1]`), and outer volumetric shells (`r ∈ [5.1, 8.9]`).
2. **Force-Field Superposition (`computeAdvect`, `Δt ≤ 0.05s`)**:
   - **Divergence-Free 3D Curl**: Evaluate `u_curl(p) = ∇ × Ψ(p, t)` via continuous 3D gyroid potential cross-derivatives scaled by `uCurlFreq` and `uTurbulence`.
   - **Lorentz Magnetic Dipole Torque**: Model a precessing dipole axis `m(t)` and dipole magnetic field `B(r) = (3·dot(m, r̂)·r̂ - m) / max(|r|³, 0.04)`, injecting `F_lorentz = q · (v × B(r))` so particles trace authentic 3D arched magnetic flux tubes and polar jets.
   - **Keplerian Shear & Radial Shell Spring**: Apply differential orbital velocity `ω(r) ∝ r^(-0.45) · (m × r̂)` balanced by a pinch-compressible harmonic restoring force.
   - **Desktop Inertia & Interactive Wells**: Inject `uWindowInertia`, mode-specific force fields (Gravity, FaceMesh Wind Cone, Hand Pinch/Vortex/Spread), and Gaussian-envelope spherical shockwave impulses.
3. **Symplectic Semi-Implicit Euler & Rendering**: Integrate velocity first (`v_{t+Δt} = damp(v_t + a_t·Δt)`), then position (`x_{t+Δt} = x_t + v_{t+Δt}·Δt`), rendering via `THREE.Sprite` + `THREE.PointsNodeMaterial` with speed-coupled scaling and chromatic velocity ramps.

---

## 3. Volumetric CSG SDF Singularity & Beer-Lambert Optics (`Raymarch GLSL TOP`)
Render the central singularity inside a bounding proxy sphere (`SphereGeometry(2.75)`) using a custom TSL `MeshBasicNodeMaterial`:
- **Dynamic CSG SDF (`mapSDF`)**: Smooth-union (`smin`) a breathing gyroid-warped core sphere, a precessing undulating equatorial accretion torus (`sdTorus`), and three non-coplanar orbiting satellite droplets.
- **Tetrahedral Normals & Optical Transport**: Compute 4-tap tetrahedral SDF gradients (`∇SDF`), Schlick Fresnel rim glow (`(1 - N·V)^3.8`), staggered RGB Cauchy `refract()` dispersion sampling internal caustic veins, and **Beer-Lambert volumetric absorption** `T = exp(-σ_a · τ)` probed along the internal refracted chord.

---

## 4. 3D Volumetric Stage & Spherical Orbital Camera Rig (`SOP Geo + Camera COMP`)
- **Multi-Strata Depth Architecture**: Combine a `2,400`-point deep 3D parallax starfield (`r ∈ [16, 46]`), a slowly rotating geodesic icosahedral containment lattice (`EdgesGeometry(IcosahedronGeometry(3.35, 1))`), a calibrated equatorial horizon ring (`r = 4.1`), 3-axis counter-rotating astrolabe rings, and an additive `BackSide` Fresnel volumetric corona shell (`r = 2.15`).
- **Orbital Spring Camera Rig**: Parameterize camera pose in spherical coordinates `(orbitRadius, orbitYaw, orbitPitch)` driven by second-order springs—supporting pointer drag-to-orbit (`> 5px`), short-click shockwaves (`≤ 5px`), scroll-wheel dolly zoom (`4.6..16.5`), and double-click / `R` camera reset.

---

## 5. Second-Order CHOP Kinematics & Cinematic RenderPipeline (`TOP Compositor`)
- Smooth multi-window centroid offsets, camera orbit/parallax, FOV breathing, pinch compression, and quadratic trauma (`trauma²`) via sub-stepped second-order springs.
- Chain `THREE.RenderPipeline` (`pass` -> HDR `bloom` -> dynamic `dof` -> directional horizontal `gaussianBlur` anamorphic streak -> radial `chromaticAberration` -> cinema vignette), gated behind `!isSoftwareGl`.

---

## 6. Multi-Window Sync & Unified Single-Stream MediaPipe Vision
- Synchronize arbitrary desktop browser windows via `BroadcastChannel` (`WorldBounds`, `localSingularityOffset`, Electric Violet inter-window silk filaments, and cross-window `SHOCKWAVE` impulses).
- Share a single `getUserMedia` stream sequentially across `FaceLandmarker` (`WIND`) and `HandLandmarker` (`HAND`), degrading cleanly to Mouse Gravity + 3D Orbit whenever camera access is unavailable.
