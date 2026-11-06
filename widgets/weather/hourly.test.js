import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickHours } from './hourly.js';

function hourly(fromDay, n) {
  const h = { time: [], temperature_2m: [], weather_code: [], precipitation_probability: [], is_day: [] };
  for (let i = 0; i < n; i++) {
    const d = new Date(Date.UTC(2026, 10, fromDay, i));
    h.time.push(d.toISOString().slice(0, 13) + ':00');
    h.temperature_2m.push(20 + i / 10);
    h.weather_code.push(i % 4);
    h.precipitation_probability.push(i);
    h.is_day.push(d.getUTCHours() >= 6 && d.getUTCHours() < 18 ? 1 : 0);
  }
  return h;
}

test('heures à venir : commence à l’heure pleine suivante', () => {
  const r = pickHours(hourly(6, 48), '2026-11-06T14:15', 3, 1);
  assert.deepEqual(r.map((x) => x.hour), ['15h', '16h', '17h']);
  assert.deepEqual(r[0], { hour: '15h', temp: 22, code: 3, isDay: true, rain: 15 });
});

test('heures à venir : pas de plusieurs heures, passage à minuit, nuit', () => {
  const r = pickHours(hourly(6, 48), '2026-11-06T20:00', 4, 3);
  assert.deepEqual(r.map((x) => x.hour), ['23h', '2h', '5h', '8h']);
  assert.equal(r[0].isDay, false);
  assert.equal(r[3].isDay, true);
});

test('heures à venir : données manquantes ou insuffisantes', () => {
  assert.deepEqual(pickHours(null, '2026-11-06T14:00', 4, 1), []);
  assert.deepEqual(pickHours(hourly(6, 24), '2026-11-06T14:00', 0, 1), []);
  // Pas assez d'heures dans la réponse : on affiche ce qu'il y a
  assert.equal(pickHours(hourly(6, 24), '2026-11-06T21:30', 6, 1).length, 2);
  const h = hourly(6, 24);
  delete h.precipitation_probability;
  assert.equal(pickHours(h, '2026-11-06T10:00', 1, 1)[0].rain, null);
});
