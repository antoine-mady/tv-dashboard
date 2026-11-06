import { test } from 'node:test';
import assert from 'node:assert/strict';
import { navigate, stepControl, PAGE } from './list-nav.js';

const ctx = { menuLength: 4, listLength: 10, controlsLength: 3 };
const start = { zone: 'menu', control: 0, menu: 0, item: 0 };

test('menu : haut/bas change d’onglet, bornes respectées', () => {
  let r = navigate(start, 'down', ctx);
  assert.deepEqual(r.state, { zone: 'menu', control: 0, menu: 1, item: 0 });
  assert.deepEqual(r.action, { type: 'tab' });
  r = navigate(start, 'up', { menuLength: 4, listLength: 10 });
  assert.equal(r.action, null);
  assert.equal(r.state.zone, 'menu');
  assert.equal(navigate({ zone: 'menu', menu: 3, item: 0 }, 'down', ctx).action, null);
});

test('menu → liste avec droite (si la liste n’est pas vide), Entrée, Retour', () => {
  assert.equal(navigate(start, 'right', ctx).state.zone, 'list');
  assert.equal(navigate(start, 'right', { menuLength: 4, listLength: 0, controlsLength: 3 }).state.zone, 'menu');
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

test('boutons de lecture du panneau : accès par le haut, ◀ ▶, OK, retour au menu', () => {
  let r = navigate(start, 'up', ctx);
  assert.equal(r.state.zone, 'controls');
  r = navigate(r.state, 'right', ctx);
  assert.equal(r.state.control, 1);
  assert.equal(navigate({ ...r.state, control: 2 }, 'right', ctx).state.control, 2);
  assert.equal(navigate({ ...r.state, control: 0 }, 'left', ctx).state.control, 0);
  assert.deepEqual(navigate(r.state, 'enter', ctx).action, { type: 'control' });
  assert.equal(navigate(r.state, 'down', ctx).state.zone, 'menu');
  assert.deepEqual(navigate(r.state, 'back', ctx).action, { type: 'close' });
});

test('boutons du mini-lecteur : ◀ ▶ dans la rangée, bords laissés à l’app', () => {
  assert.deepEqual(stepControl(1, 'right', 4), { index: 2, handled: true });
  assert.deepEqual(stepControl(1, 'left', 4), { index: 0, handled: true });
  assert.deepEqual(stepControl(0, 'left', 4), { index: 0, handled: false });
  assert.deepEqual(stepControl(3, 'right', 4), { index: 3, handled: false });
  assert.deepEqual(stepControl(1, 'up', 4), { index: 1, handled: false });
});
