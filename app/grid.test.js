import test from 'node:test';
import assert from 'node:assert/strict';
import { viewportSize, gridGeometry } from './grid.js';

test('viewportSize : taille de la fenêtre si connue', () => {
  assert.deepEqual(viewportSize({ innerWidth: 3840, innerHeight: 2160 }), { width: 3840, height: 2160 });
});

test('viewportSize : fenêtre 0×0 au démarrage → document, écran, puis 1920×1080', () => {
  const doc = { documentElement: { clientWidth: 1280, clientHeight: 720 } };
  assert.deepEqual(viewportSize({ innerWidth: 0, innerHeight: 0, document: doc }), { width: 1280, height: 720 });
  assert.deepEqual(viewportSize({ innerWidth: 0, innerHeight: 0, screen: { width: 1920, height: 1080 } }), { width: 1920, height: 1080 });
  assert.deepEqual(viewportSize({ innerWidth: 0, innerHeight: 0 }), { width: 1920, height: 1080 });
});

test('gridGeometry : cases, marges et espacements', () => {
  const geo = gridGeometry({ cols: 12, rows: 6 }, 48, 24);
  assert.equal(geo.colW, (1920 - 96 - 24 * 11) / 12);
  assert.deepEqual(geo.rect({ col: 1, row: 1, w: 1, h: 1 }), { left: 48, top: 48, width: geo.colW, height: geo.rowH });
  const full = geo.rect({ col: 1, row: 1, w: 12, h: 6 });
  assert.equal(Math.round(full.left + full.width), 1920 - 48);
  assert.equal(Math.round(full.top + full.height), 1080 - 48);
});
