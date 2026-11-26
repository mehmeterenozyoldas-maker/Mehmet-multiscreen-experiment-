export interface SpringScalar {
  value: number;
  velocity: number;
  target: number;
}

export interface SpringVec3 {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  tx: number;
  ty: number;
  tz: number;
}

export interface SpringConfig {
  stiffness: number;
  damping: number;
}

export function createSpringScalar(initial = 0): SpringScalar {
  return { value: initial, velocity: 0, target: initial };
}

export function createSpringVec3(x = 0, y = 0, z = 0): SpringVec3 {
  return { x, y, z, vx: 0, vy: 0, vz: 0, tx: x, ty: y, tz: z };
}

/**
 * Second-order spring integrator with sub-step stability for large dt spikes.
 */
export function stepSpringScalar(
  spring: SpringScalar,
  dt: number,
  config: SpringConfig = { stiffness: 120, damping: 16 }
): SpringScalar {
  const clampedDt = Math.min(Math.max(dt, 0), 0.05);
  if (clampedDt === 0) return spring;

  const subSteps = clampedDt > 0.02 ? 2 : 1;
  const h = clampedDt / subSteps;

  for (let i = 0; i < subSteps; i++) {
    const force = (spring.target - spring.value) * config.stiffness;
    const dampForce = -spring.velocity * config.damping;
    const accel = force + dampForce;
    spring.velocity += accel * h;
    spring.value += spring.velocity * h;
  }

  return spring;
}

export function stepSpringVec3(
  spring: SpringVec3,
  dt: number,
  config: SpringConfig = { stiffness: 110, damping: 15 }
): SpringVec3 {
  const clampedDt = Math.min(Math.max(dt, 0), 0.05);
  if (clampedDt === 0) return spring;

  const subSteps = clampedDt > 0.02 ? 2 : 1;
  const h = clampedDt / subSteps;

  for (let i = 0; i < subSteps; i++) {
    const ax = (spring.tx - spring.x) * config.stiffness - spring.vx * config.damping;
    const ay = (spring.ty - spring.y) * config.stiffness - spring.vy * config.damping;
    const az = (spring.tz - spring.z) * config.stiffness - spring.vz * config.damping;

    spring.vx += ax * h;
    spring.vy += ay * h;
    spring.vz += az * h;

    spring.x += spring.vx * h;
    spring.y += spring.vy * h;
    spring.z += spring.vz * h;
  }

  return spring;
}

/**
 * Frame-rate independent exponential damping.
 */
export function dampValue(current: number, target: number, lambda: number, dt: number): number {
  const clampedDt = Math.min(Math.max(dt, 0), 0.1);
  return current + (target - current) * (1 - Math.exp(-lambda * clampedDt));
}

/**
 * Decays camera/core trauma cleanly toward zero.
 */
export function decayTrauma(trauma: number, rate: number, dt: number): number {
  const clampedDt = Math.min(Math.max(dt, 0), 0.1);
  return Math.max(0, trauma - rate * clampedDt);
}
