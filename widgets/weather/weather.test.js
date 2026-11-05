import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeWeather, buildUrl } from './codes.js';

test('codes WMO → libellé + icône jour/nuit', () => {
  assert.deepEqual(describeWeather(0, true), { label: 'Ciel dégagé', icon: 'clear-day' });
  assert.deepEqual(describeWeather(2, false), { label: 'Partiellement nuageux', icon: 'partly-night' });
  assert.equal(describeWeather(95, true).icon, 'storm');
  assert.equal(describeWeather(1234, true).label, '—');
});

test('URL Open-Meteo', () => {
  const url = buildUrl({ latitude: -20.88, longitude: 55.45, days: 3 });
  assert.match(url, /latitude=-20.88&longitude=55.45/);
  assert.match(url, /forecast_days=4/);
});
