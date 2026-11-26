import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSpringScalar,
  createSpringVec3,
  dampValue,
  decayTrauma,
  stepSpringScalar,
  stepSpringVec3,
} from './springPhysics';
import {
  computeLocalSingularityOffset,
  computePeerLinks,
  computeWorldBounds,
  normalizeMinimapNodes,
  pruneStalePeers,
} from './spatialSync';
import { extractTuningFromPreset, getPresetById, VFX_PRESETS } from './presets';
import {
  buildMasterMetaprompt,
  DEFAULT_METAPROMPT_MODULES,
} from './metapromptBuilder';
import type { WindowRect } from './types';

test('second-order spring converges cleanly toward target without NaN', () => {
  const s = createSpringScalar(0);
  s.target = 10;
  for (let i = 0; i < 120; i++) {
    stepSpringScalar(s, 0.016, { stiffness: 120, damping: 16 });
  }
  assert.ok(Math.abs(s.value - 10) < 0.05, `Expected ~10, got ${s.value}`);

  const v = createSpringVec3(0, 0, 0);
  v.tx = 5;
  v.ty = -3;
  v.tz = 2;
  for (let i = 0; i < 120; i++) {
    stepSpringVec3(v, 0.032);
  }
  assert.ok(Math.abs(v.x - 5) < 0.05);
  assert.ok(Math.abs(v.y + 3) < 0.05);
  assert.ok(Math.abs(v.z - 2) < 0.05);
});

test('exponential damping and trauma decay stay bounded', () => {
  const damped = dampValue(0, 10, 8, 0.016);
  assert.ok(damped > 0 && damped < 10);
  assert.equal(decayTrauma(0.15, 2.0, 0.1), 0);
  assert.ok(Math.abs(decayTrauma(1.0, 1.5, 0.2) - 0.85) < 1e-6);
});

test('multi-window world bounds, centroid offset, and peer links compute accurately', () => {
  const self: WindowRect = {
    id: 'win-a',
    x: 0,
    y: 0,
    w: 800,
    h: 600,
    updatedAt: 1000,
    mode: 'GRAVITY',
    gesture: 'NONE',
    pointerX: 0,
    pointerY: 0,
  };
  const peerB: WindowRect = {
    id: 'win-b',
    x: 1000,
    y: 0,
    w: 800,
    h: 600,
    updatedAt: 1000,
    mode: 'HAND',
    gesture: 'PINCH',
    pointerX: 0.2,
    pointerY: -0.1,
  };
  const stalePeer: WindowRect = {
    ...peerB,
    id: 'win-stale',
    updatedAt: -5000,
  };

  const pruned = pruneStalePeers({ 'win-b': peerB, 'win-stale': stalePeer }, 1500, 2000);
  assert.deepEqual(Object.keys(pruned), ['win-b']);

  const bounds = computeWorldBounds(self, pruned);
  assert.equal(bounds.nodeCount, 2);
  assert.equal(bounds.width, 1800);
  assert.equal(bounds.height, 600);
  assert.equal(bounds.centerX, 900);
  assert.equal(bounds.centerY, 300);

  // Self center is (400, 300); global center is (900, 300) => dx = +500px
  const offset = computeLocalSingularityOffset(self, bounds, 0.01);
  assert.equal(offset.x, 5);
  assert.equal(offset.y, 0);

  const links = computePeerLinks(self, pruned, 0.01);
  assert.equal(links.length, 1);
  assert.equal(links[0].dx, 10);
  assert.equal(links[0].dy, 0);
  assert.equal(links[0].gesture, 'PINCH');

  const minimap = normalizeMinimapNodes(self, pruned, bounds);
  assert.equal(minimap.length, 2);
  assert.ok(minimap[0].isSelf);
  assert.ok(!minimap[1].isSelf);
});

test('presets and metaprompt builder toggle sections cleanly', () => {
  assert.ok(VFX_PRESETS.length >= 4);
  const cryo = getPresetById('cryo-caustics');
  assert.equal(cryo.name, 'Cryo Caustics');
  const tuning = extractTuningFromPreset(cryo);
  assert.equal(tuning.bloomStrength, cryo.bloomStrength);
  assert.equal(tuning.dispersion, cryo.dispersion);

  const fullPrompt = buildMasterMetaprompt(DEFAULT_METAPROMPT_MODULES);
  assert.ok(fullPrompt.includes('GPGPU 3D CURL-NOISE'));
  assert.ok(fullPrompt.includes('RAYMARCHED LIQUID-GLASS SDF'));
  assert.ok(fullPrompt.includes('MEDIAPIPE VISION PIPELINE'));

  const minimalPrompt = buildMasterMetaprompt({
    gpgpuAdvection: true,
    sdfRaymarching: false,
    springRig: false,
    postProcessing: false,
    multiWindowSync: false,
    mediaPipeVision: false,
  });
  assert.ok(minimalPrompt.includes('GPGPU 3D CURL-NOISE'));
  assert.ok(!minimalPrompt.includes('RAYMARCHED LIQUID-GLASS SDF'));
});
