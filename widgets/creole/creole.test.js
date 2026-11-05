import { test } from 'node:test';
import assert from 'node:assert/strict';
import WORDS from './words.js';
import { parseCustomWords, buildList, wordFor, yesterday, dayNumber } from './creole.js';

test('liste intégrée : mots et traductions renseignés, sans doublon', () => {
  assert.ok(WORDS.length >= 30);
  const seen = {};
  WORDS.forEach((w) => {
    assert.ok(w[0] && w[1], 'mot ou traduction manquant : ' + w);
    assert.ok(!seen[w[0].toLowerCase()], 'doublon : ' + w[0]);
    seen[w[0].toLowerCase()] = true;
  });
});

test('mots personnels', () => {
  assert.deepEqual(parseCustomWords('# commentaire\nZanbrokal = Riz aux pois\n\nKaz = Case, maison = Mon kaz\nmauvaise ligne'),
    [['Zanbrokal', 'Riz aux pois', ''], ['Kaz', 'Case, maison', 'Mon kaz']]);
  const list = buildList([['Kaz', 'Maison', ''], ['Dalon', 'Ami', '']], [['kaz', 'Case', '']], false);
  assert.deepEqual(list, [['Dalon', 'Ami', ''], ['kaz', 'Case', '']]);
  assert.deepEqual(buildList(WORDS, [['A', 'B', '']], true), [['A', 'B', '']]);
});

test('un mot par jour, stable dans la journée, tous les mots sur un cycle', () => {
  const morning = new Date(2026, 10, 5, 7);
  const evening = new Date(2026, 10, 5, 23, 59);
  assert.deepEqual(wordFor(WORDS, morning), wordFor(WORDS, evening));
  assert.notDeepEqual(wordFor(WORDS, morning), wordFor(WORDS, yesterday(morning)));
  const seen = {};
  for (let i = 0; i < WORDS.length; i++) seen[wordFor(WORDS, new Date(2026, 0, 1 + i)).word] = true;
  assert.equal(Object.keys(seen).length, WORDS.length);
  assert.equal(dayNumber(new Date(2026, 10, 6, 0, 1)) - dayNumber(new Date(2026, 10, 5, 23, 59)), 1);
  assert.equal(wordFor([], morning), null);
});
