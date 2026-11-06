import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findNeighbor, firstItem } from './focus.js';
import { parseTime, isInRange } from './schedule.js';
import { normalizeKey } from './remote.js';

//  [A A B B]
//  [C C C D]
const items = [
  { id: 'A', col: 1, row: 1, w: 2, h: 1 },
  { id: 'B', col: 3, row: 1, w: 2, h: 1 },
  { id: 'C', col: 1, row: 2, w: 3, h: 1 },
  { id: 'D', col: 4, row: 2, w: 1, h: 1 },
];

test('navigation aux flèches', () => {
  assert.equal(findNeighbor(items, 'A', 'right'), 'B');
  assert.equal(findNeighbor(items, 'A', 'down'), 'C');
  assert.equal(findNeighbor(items, 'B', 'down'), 'D');
  assert.equal(findNeighbor(items, 'C', 'right'), 'D');
  assert.equal(findNeighbor(items, 'D', 'up'), 'B');
  assert.equal(findNeighbor(items, 'A', 'left'), null);
  assert.equal(findNeighbor(items, 'A', 'up'), null);
  assert.equal(findNeighbor(items, 'inconnu', 'up'), 'A');
  assert.equal(firstItem(items.slice().reverse()), 'A');
});

test('le voisin dépend de la géométrie, pas de l’ordre des identifiants', () => {
  const layout = [
    { id: 'current', col: 1, row: 1, w: 1, h: 1 },
    { id: 'far-aligned', col: 10, row: 1, w: 1, h: 1 },
    { id: 'near-below', col: 3, row: 2, w: 1, h: 1 },
  ];
  assert.equal(findNeighbor(layout, 'current', 'right'), 'near-below');
  assert.equal(findNeighbor(layout.slice().reverse(), 'current', 'right'), 'near-below');
});

test('le voisin juste au-dessus prime sur un widget plus éloigné mais aligné', () => {
  const layout = [
    { id: 'agenda', col: 4, row: 4, w: 2, h: 2 },
    { id: 'creole', col: 1, row: 2, w: 2, h: 2 },
    { id: 'bus', col: 4, row: 1, w: 2, h: 1 },
  ];
  assert.equal(findNeighbor(layout, 'agenda', 'up'), 'creole');
});

test('un widget qui chevauche sur l’axe de déplacement n’est pas un voisin vertical', () => {
  const layout = [
    { id: 'agenda', col: 3, row: 4, w: 3, h: 2 },
    { id: 'photos', col: 6, row: 1, w: 7, h: 6 },
  ];
  assert.equal(findNeighbor(layout, 'agenda', 'up'), null);
  assert.equal(findNeighbor(layout, 'photos', 'down'), null);
  assert.equal(findNeighbor(layout, 'agenda', 'right'), 'photos');
});

test('plages horaires du mode nuit', () => {
  assert.equal(parseTime('07:30'), 450);
  assert.ok(isNaN(parseTime('nope')));
  assert.equal(isInRange(parseTime('23:30'), parseTime('23:00'), parseTime('07:00')), true);
  assert.equal(isInRange(parseTime('06:59'), parseTime('23:00'), parseTime('07:00')), true);
  assert.equal(isInRange(parseTime('12:00'), parseTime('23:00'), parseTime('07:00')), false);
  assert.equal(isInRange(parseTime('13:00'), parseTime('12:00'), parseTime('14:00')), true);
});

test('touches télécommande', () => {
  assert.equal(normalizeKey(37), 'left');
  assert.equal(normalizeKey(10009), 'back');
  assert.equal(normalizeKey(10252), 'playpause');
  assert.equal(normalizeKey(80, 'p'), 'playpause');
  assert.equal(normalizeKey(999, 'x'), null);
  assert.equal(normalizeKey(777, '', { 777: 'red' }), 'red');
});
