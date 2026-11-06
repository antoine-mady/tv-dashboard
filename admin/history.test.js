import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHistory } from './history.js';

function clock() {
  let t = 0;
  return { now: () => t, tick: (ms) => { t += ms; } };
}

test('annuler / rétablir', () => {
  const h = createHistory('a');
  assert.equal(h.canUndo(), false);
  h.commit('b');
  h.commit('c');
  assert.equal(h.undo(), 'b');
  assert.equal(h.undo(), 'a');
  assert.equal(h.undo(), null);
  assert.equal(h.redo(), 'b');
  assert.equal(h.canRedo(), true);
});

test('une nouvelle modification efface ce qui avait été annulé', () => {
  const h = createHistory('a');
  h.commit('b');
  h.undo();
  h.commit('x');
  assert.equal(h.canRedo(), false);
  assert.equal(h.undo(), 'a');
});

test('état identique : rien n’est ajouté', () => {
  const h = createHistory('a');
  assert.equal(h.commit('a'), false);
  assert.equal(h.canUndo(), false);
});

test('modifications rapprochées du même champ fusionnées', () => {
  const c = clock();
  const h = createHistory('a', { now: c.now, mergeMs: 1000 });
  h.commit('ab', 'city');
  c.tick(300);
  h.commit('abc', 'city');
  c.tick(300);
  h.commit('abcd', 'city');
  assert.equal(h.undo(), 'a');
  h.redo();
  c.tick(2000);
  h.commit('abcde', 'city'); // trop tard : nouvelle étape
  assert.equal(h.undo(), 'abcd');
});

test('champs différents ou sans clé : étapes séparées', () => {
  const c = clock();
  const h = createHistory('a', { now: c.now });
  h.commit('b', 'x');
  h.commit('c', 'y');
  h.commit('d');
  h.commit('e');
  assert.equal(h.undo(), 'd');
  assert.equal(h.undo(), 'c');
  assert.equal(h.undo(), 'b');
});

test('limite de taille', () => {
  const h = createHistory('0', { limit: 3 });
  ['1', '2', '3', '4'].forEach((s) => h.commit(s));
  assert.equal(h.undo(), '3');
  assert.equal(h.undo(), '2');
  assert.equal(h.undo(), null);
});
