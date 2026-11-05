import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatHour, dayLength, uvLevel, aqiLevel, buildAirUrl } from './extras.js';

test('heure locale Open-Meteo → HH:MM', () => {
  assert.equal(formatHour('2026-11-05T05:43'), '05:43');
  assert.equal(formatHour('2026-11-05T18:07'), '18:07');
  assert.equal(formatHour(null), null);
  assert.equal(formatHour('n/a'), null);
});

test('durée du jour', () => {
  assert.equal(dayLength('2026-11-05T05:43', '2026-11-05T18:35'), '12 h 52');
  assert.equal(dayLength('2026-12-21T08:42', '2026-12-21T16:56'), '8 h 14');
  assert.equal(dayLength(null, '2026-11-05T18:35'), null);
  // Nuit polaire / données absurdes : rien plutôt qu'une durée fausse
  assert.equal(dayLength('2026-11-05T18:00', '2026-11-05T06:00'), null);
});

test('indice UV → niveau OMS', () => {
  assert.deepEqual(uvLevel(0.4), { value: 0, label: 'Faible', level: 1 });
  assert.equal(uvLevel(2.4).label, 'Faible');
  assert.equal(uvLevel(2.6).label, 'Modéré');
  assert.equal(uvLevel(6).label, 'Élevé');
  assert.equal(uvLevel(9.8).label, 'Très élevé');
  assert.deepEqual(uvLevel(13.2), { value: 13, label: 'Extrême', level: 5 });
  assert.equal(uvLevel(null), null);
  assert.equal(uvLevel(undefined), null);
});

test('indice européen de qualité de l’air → niveau', () => {
  assert.deepEqual(aqiLevel(12), { value: 12, label: 'Bon', level: 1 });
  assert.equal(aqiLevel(20).label, 'Bon');
  assert.equal(aqiLevel(35).label, 'Correct');
  assert.equal(aqiLevel(55).label, 'Moyen');
  assert.equal(aqiLevel(75).label, 'Médiocre');
  assert.equal(aqiLevel(95).label, 'Très mauvais');
  assert.equal(aqiLevel(140).level, 6);
  assert.equal(aqiLevel(null), null);
});

test('URL qualité de l’air Open-Meteo', () => {
  const url = buildAirUrl({ latitude: -20.88, longitude: 55.45 });
  assert.match(url, /^https:\/\/air-quality-api\.open-meteo\.com\/v1\/air-quality\?/);
  assert.match(url, /latitude=-20.88&longitude=55.45/);
  assert.match(url, /current=european_aqi,pm2_5/);
});
