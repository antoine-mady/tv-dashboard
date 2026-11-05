import { test } from 'node:test';
import assert from 'node:assert/strict';
import { navigate, PAGE } from './list-nav.js';

const ctx = { menuLength: 4, listLength: 10 };
const start = { zone: 'menu', menu: 0, item: 0 };

test('menu : haut/bas change d’onglet, bornes respectées', () => {
  let r = navigate(start, 'down', ctx);
  assert.deepEqual(r.state, { zone: 'menu', menu: 1, item: 0 });
  assert.deepEqual(r.action, { type: 'tab' });
  r = navigate(start, 'up', ctx);
  assert.equal(r.action, null);
  assert.equal(navigate({ zone: 'menu', menu: 3, item: 0 }, 'down', ctx).action, null);
});

test('menu → liste avec droite (si la liste n’est pas vide), Entrée, Retour', () => {
  assert.equal(navigate(start, 'right', ctx).state.zone, 'list');
  assert.equal(navigate(start, 'right', { menuLength: 4, listLength: 0 }).state.zone, 'menu');
  assert.deepEqual(navigate(start, 'enter', ctx).action, { type: 'activate-menu' });
  assert.deepEqual(navigate(start, 'back', ctx).action, { type: 'close' });
});

test('liste : déplacement, pages, retour au menu, activation', () => {
  const s = { zone: 'list', menu: 1, item: 0 };
  assert.equal(navigate(s, 'down', ctx).state.item, 1);
  assert.equal(navigate(s, 'up', ctx).state.item, 0);
  assert.equal(navigate(s, 'next', ctx).state.item, PAGE);
  assert.equal(navigate({ zone: 'list', menu: 1, item: 8 }, 'next', ctx).state.item, 9);
  assert.equal(navigate(s, 'left', ctx).state.zone, 'menu');
  assert.equal(navigate(s, 'back', ctx).state.zone, 'menu');
  assert.deepEqual(navigate(s, 'enter', ctx).action, { type: 'activate-item' });
});
