import { test } from 'node:test';
import assert from 'node:assert/strict';
import { firstSelectable, lastSelectable, moveSelection, position, keyAction, PAGE } from './list-nav.js';

const rows = [{ header: true }, {}, {}, { header: true }, {}, {}];

test('lignes sélectionnables : les titres de groupe sont sautés', () => {
  assert.equal(firstSelectable(rows), 1);
  assert.equal(lastSelectable(rows), 5);
  assert.equal(moveSelection(rows, 2, 1), 4);
  assert.equal(moveSelection(rows, 4, -1), 2);
  assert.equal(moveSelection(rows, 5, 1), 5, 'bloqué en bas');
  assert.equal(moveSelection(rows, 1, -1), 1, 'bloqué en haut');
  assert.equal(moveSelection(rows, 1, PAGE), 5, 'une page au-delà du bas → dernière ligne');
  assert.equal(moveSelection(rows, 0, 0), 1, 'index sur un titre → première ligne');
  assert.equal(moveSelection([{ header: true }], 0, 1), -1);
  assert.deepEqual(position(rows, 4), { at: 3, count: 4 });
});

test('flèches, pages et validation dans la liste', () => {
  const ctx = { rows, tabs: 0, search: false };
  let r = keyAction({ zone: 'list', index: 1 }, 'down', ctx);
  assert.equal(r.state.index, 2);
  r = keyAction(r.state, 'down', ctx);
  assert.equal(r.state.index, 4);
  r = keyAction(r.state, 'chup', ctx);
  assert.equal(r.state.index, 1);
  r = keyAction(r.state, 'chdown', ctx);
  assert.equal(r.state.index, 5);
  assert.equal(keyAction(r.state, 'enter', ctx).action, 'activate');
  assert.equal(keyAction(r.state, 'back', ctx).action, 'close');
  assert.equal(keyAction(r.state, 'left', ctx).action, null, 'sans onglets, ◀ ▶ ne font rien');
});

test('onglets : ◀ ▶ changent d’onglet, bornés', () => {
  const ctx = { rows, tabs: 3 };
  let r = keyAction({ zone: 'list', index: 1, tab: 0 }, 'right', ctx);
  assert.equal(r.action, 'tab');
  assert.equal(r.state.tab, 1);
  r = keyAction({ zone: 'list', index: 1, tab: 2 }, 'right', ctx);
  assert.equal(r.action, null);
  assert.equal(r.state.tab, 2);
  r = keyAction({ zone: 'list', index: 1, tab: 0 }, 'left', ctx);
  assert.equal(r.action, null);
});

test('recherche : ▲ depuis la première ligne monte au champ, OK ouvre la saisie, ▼ revient', () => {
  const ctx = { rows, tabs: 0, search: true };
  let r = keyAction({ zone: 'list', index: 1 }, 'up', ctx);
  assert.equal(r.state.zone, 'search');
  assert.equal(keyAction(r.state, 'enter', ctx).action, 'edit');
  r = keyAction(r.state, 'down', ctx);
  assert.equal(r.state.zone, 'list');
  assert.equal(r.state.index, 1);
  // Aucun résultat : OK rouvre la saisie, ▼ reste sur le champ.
  const empty = { rows: [], search: true };
  assert.equal(keyAction({ zone: 'list', index: -1 }, 'enter', empty).action, 'edit');
  assert.equal(keyAction({ zone: 'search', index: -1 }, 'down', empty).state.zone, 'search');
});
