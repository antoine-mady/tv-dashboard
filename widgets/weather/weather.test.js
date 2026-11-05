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

test('URL Open-Meteo : soleil et UV selon les réglages', () => {
  const all = buildUrl({ latitude: 1, longitude: 2, days: 3, showSun: true, showUv: true });
  assert.match(all, /daily=[^&]*,sunrise,sunset/);
  assert.match(all, /daily=[^&]*,uv_index_max/);
  const none = buildUrl({ latitude: 1, longitude: 2, days: 3, showSun: false, showUv: false });
  assert.doesNotMatch(none, /sunrise|uv_index_max/);
});
