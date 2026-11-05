import test from 'node:test';
import assert from 'node:assert/strict';
import { viewportSize } from './grid.js';

test('viewportSize : taille de la fenêtre si connue', () => {
  assert.deepEqual(viewportSize({ innerWidth: 3840, innerHeight: 2160 }), { width: 3840, height: 2160 });
});

test('viewportSize : fenêtre 0×0 au démarrage → document, écran, puis 1920×1080', () => {
  const doc = { documentElement: { clientWidth: 1280, clientHeight: 720 } };
  assert.deepEqual(viewportSize({ innerWidth: 0, innerHeight: 0, document: doc }), { width: 1280, height: 720 });
  assert.deepEqual(viewportSize({ innerWidth: 0, innerHeight: 0, screen: { width: 1920, height: 1080 } }), { width: 1920, height: 1080 });
  assert.deepEqual(viewportSize({ innerWidth: 0, innerHeight: 0 }), { width: 1920, height: 1080 });
});
