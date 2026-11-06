import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eachRow, readRows, normalize, parseGtfsTime, buildStopIndex, searchStops, extractTimetable } from './gtfs.js';
import { FILES } from './fixture.js';

test('CSV : BOM, CRLF, guillemets, virgules et retours à la ligne dans un champ', () => {
  const rows = readRows('﻿a,b\r\n1,"x, ""y"""\r\n2,"multi\nligne"\r\n\r\n');
  assert.deepEqual(rows, [{ a: '1', b: 'x, "y"' }, { a: '2', b: 'multi\nligne' }]);
  let n = 0;
  eachRow('', () => n++);
  eachRow(undefined, () => n++);
  assert.equal(n, 0);
});

test('normalize et heures GTFS', () => {
  assert.equal(normalize('  Église de Grands-Bois '), 'eglise de grands bois');
  assert.equal(parseGtfsTime('06:05:00'), 6 * 3600 + 5 * 60);
  assert.equal(parseGtfsTime('25:10:00'), 25 * 3600 + 10 * 60);
  assert.equal(parseGtfsTime('7:03'), 7 * 3600 + 3 * 60);
  assert.equal(parseGtfsTime(''), null);
});

test('recherche d’arrêt : regroupe les poteaux du même nom avec leurs lignes', () => {
  const index = buildStopIndex(FILES);
  const res = searchStops(index, 'eglise grands bois');
  assert.equal(res.length, 1);
  assert.deepEqual(res[0], { name: 'Eglise De Grands Bois', ids: ['GB1', 'GB2'], routes: ['11', 'Lit2'] });
  // Exact et début de nom d'abord.
  assert.deepEqual(searchStops(index, 'grands bois').map((s) => s.name), ['Eglise De Grands Bois', 'Plage De Grands Bois']);
  assert.deepEqual(searchStops(index, 'planetes').map((s) => s.name), ['9 Planètes']);
  assert.deepEqual(searchStops(index, '   '), []);
  // Les gares (location_type 1) ne sont pas proposées.
  assert.deepEqual(searchStops(index, 'gare').map((s) => s.name), ['Gare Saint Louis']);
});

test('table d’un arrêt : départs, destinations, calendriers, terminus et descente exclus', () => {
  const t = extractTimetable(FILES, ['GB1', 'GB2'], { network: 'alterneo', generated: 'X' });
  assert.equal(t.stopName, 'Eglise De Grands Bois');
  assert.equal(t.network, 'alterneo');
  assert.deepEqual(t.stopIds, ['GB1', 'GB2']);
  assert.deepEqual(t.deps, [
    [6 * 3600 + 5 * 60, 'R11', '9 Planètes', 'SEM', 'T11A', 2, 'GB1'],
    [7 * 3600 + 10 * 60, 'R11', 'Plage De Grands Bois', 'SEM', 'T11B', 2, 'GB2'], // destination = terminus
    [9 * 3600 + 5 * 60, 'RLI2', 'Gare Saint Louis', 'WE', 'TL2', 2, 'GB1'],
    [24 * 3600 + 12 * 60, 'RLI2', 'Gare Saint Louis', 'SEM', 'TL1', 2, 'GB1'], // départ après minuit
  ]);
  // TL3 : pickup_type 1 (descente seulement) → exclu. R99 ne passe pas ici.
  assert.deepEqual(Object.keys(t.routes).sort(), ['R11', 'RLI2']);
  assert.deepEqual(t.routes.R11, ['11', '#E30613', '#FFFFFF']);
  assert.deepEqual(t.routes.RLI2, ['Lit2', '#0072BC', '']);
  assert.deepEqual(t.services.SEM, ['1111100', '20260824', '20270228', [], ['20261111']]);
  assert.deepEqual(t.services.WE, ['0000011', '20260824', '20270228', ['20261111'], []]);
  assert.equal(t.start, '20260824');
  assert.equal(t.end, '20270228');
});

test('table : le dernier arrêt d’une course n’est pas un départ', () => {
  const t = extractTimetable(FILES, ['GSL']);
  assert.deepEqual(t.deps.map((d) => d[4]), ['TL3']); // T99, TL1, TL2 terminent à GSL
});

test('table : service sans calendrier ignoré, période calculée avec les dates ajoutées', () => {
  const files = Object.assign({}, FILES, {
    'calendar.txt': 'service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date\n',
    'calendar_dates.txt': 'service_id,date,exception_type\nWE,20261225,1\nWE,20261226,1\n',
  });
  const t = extractTimetable(files, ['GB1', 'GB2']);
  assert.deepEqual(t.deps.map((d) => d[4]), ['TL2']);
  assert.equal(t.start, '20261225');
  assert.equal(t.end, '20261226');
});
