import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildVigilanceUrl, parseVigilance, vigilanceText } from './vigilance.js';

test('URL vigilance : domaine et jeton', () => {
  const url = buildVigilanceUrl({ vigilanceDomain: ' 974 ', vigilanceToken: 'a b' });
  assert.match(url, /^https:\/\/webservice\.meteofrance\.com\/v3\/warning\/currentphenomenons\?/);
  assert.match(url, /domain=974&/);
  assert.match(url, /token=a%20b$/);
  assert.match(buildVigilanceUrl({}), /domain=974/);
});

test('vigilance verte', () => {
  const v = parseVigilance({ phenomenons_max_colors: [
    { phenomenon_id: '1', phenomenon_max_color_id: 1 }, { phenomenon_id: '2', phenomenon_max_color_id: 1 }] });
  assert.deepEqual(v, { level: 1, color: 'verte', phenomena: [] });
  assert.equal(vigilanceText(v), 'Pas de vigilance');
});

test('vigilance orange : phénomènes triés du plus grave au moins grave', () => {
  const v = parseVigilance({ phenomenons_max_colors: [
    { phenomenon_id: '2', phenomenon_max_color_id: 2 },
    { phenomenon_id: '1', phenomenon_max_color_id: 3 },
    { phenomenon_id: '3', phenomenon_max_color_id: 1 },
    { phenomenon_id: '42', phenomenon_max_color_id: 2 }] });
  assert.equal(v.level, 3);
  assert.equal(v.color, 'orange');
  assert.deepEqual(v.phenomena.map((p) => p.name), ['Vent', 'Pluie', 'Phénomène 42']);
  assert.equal(vigilanceText(v), 'Vigilance orange · Vent, Pluie, Phénomène 42');
});

test('réponse inattendue (API changée) → indisponible', () => {
  assert.equal(parseVigilance(null), null);
  assert.equal(parseVigilance({ foo: 1 }), null);
  assert.equal(vigilanceText(null), 'Vigilance : —');
  assert.deepEqual(parseVigilance({ phenomenons_max_colors: [{ phenomenon_id: '1' }] }),
    { level: 1, color: 'verte', phenomena: [] });
});
