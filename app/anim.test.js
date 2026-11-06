import { test } from 'node:test';
import assert from 'node:assert/strict';
import { animTiming, animMode, staggerDelays, enterClass, leaveClass } from './anim.js';

test('animMode : valeurs inconnues → full', () => {
  assert.equal(animMode('reduced'), 'reduced');
  assert.equal(animMode('none'), 'none');
  assert.equal(animMode(undefined), 'full');
  assert.equal(animMode('bizarre'), 'full');
});

test('animTiming : aucune animation = durées nulles, réduites = sans cascade', () => {
  assert.deepEqual(animTiming('none'), { enter: 0, leave: 0, stagger: 0, panel: 0 });
  assert.equal(animTiming('reduced').stagger, 0);
  assert.ok(animTiming('full').stagger > 0);
});

test('staggerDelays : ordre ligne par ligne, plafonné', () => {
  const ws = [
    { id: 'b', col: 7, row: 1 },
    { id: 'c', col: 1, row: 4 },
    { id: 'a', col: 1, row: 1 },
  ];
  assert.deepEqual(staggerDelays(ws, 100), { a: 0, b: 100, c: 200 });
  assert.deepEqual(staggerDelays(ws, 100, 150), { a: 0, b: 100, c: 150 });
  assert.deepEqual(staggerDelays(ws, 0), { a: 0, b: 0, c: 0 });
});

test('enterClass / leaveClass selon le sens', () => {
  assert.equal(enterClass(0), 'cell-in');
  assert.equal(enterClass(1), 'cell-in-next');
  assert.equal(enterClass(-1), 'cell-in-prev');
  assert.equal(leaveClass(1), 'cell-out-next');
  assert.equal(leaveClass(-1), 'cell-out-prev');
});
