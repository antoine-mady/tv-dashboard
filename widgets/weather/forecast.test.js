import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildForecastUrl, hourGroups, dayList, dayTitle, hhmm, windText, rainText, FORECAST_DAYS } from './forecast.js';

function hourly(n) {
  const h = { time: [], temperature_2m: [], apparent_temperature: [], weather_code: [], precipitation_probability: [],
    precipitation: [], wind_speed_10m: [], wind_gusts_10m: [], is_day: [] };
  for (let i = 0; i < n; i++) {
    const d = new Date(Date.UTC(2026, 10, 6, i));
    h.time.push(d.toISOString().slice(0, 13) + ':00');
    h.temperature_2m.push(20.4 + i / 10);
    h.apparent_temperature.push(22);
    h.weather_code.push(61);
    h.precipitation_probability.push(40);
    h.precipitation.push(i === 15 ? 2.46 : 0);
    h.wind_speed_10m.push(12.2);
    h.wind_gusts_10m.push(30);
    h.is_day.push(d.getUTCHours() >= 6 && d.getUTCHours() < 18 ? 1 : 0);
  }
  return h;
}

test('URL du panneau : heures et jours détaillés', () => {
  const url = buildForecastUrl({ latitude: -20.88, longitude: 55.45 });
  assert.match(url, /latitude=-20.88&longitude=55.45/);
  assert.match(url, /hourly=[^&]*apparent_temperature[^&]*wind_gusts_10m/);
  assert.match(url, /daily=[^&]*precipitation_sum[^&]*sunset/);
  assert.match(url, new RegExp('forecast_days=' + FORECAST_DAYS));
});

test('heure par heure : à partir de l’heure en cours, regroupé par jour', () => {
  const groups = hourGroups(hourly(48), '2026-11-06T14:15');
  assert.deepEqual(groups.map((g) => g.label), ['Aujourd’hui', 'Demain']);
  assert.equal(groups[0].items.length, 10); // 14h → 23h
  const first = groups[0].items[0];
  assert.equal(first.hour, '14h');
  assert.equal(first.now, true);
  assert.equal(first.temp, 22);
  assert.equal(groups[0].items[1].mm, 2.5);
  assert.equal(groups[0].items[5].isDay, false);
  assert.equal(groups[1].items[0].hour, '0h');
  assert.deepEqual(hourGroups(null, 'x'), []);
});

test('jour par jour', () => {
  const daily = {
    time: ['2026-11-06', '2026-11-07', '2026-11-08'],
    weather_code: [0, 3, 95], temperature_2m_max: [28.6, 27, 25], temperature_2m_min: [21, 20.4, null],
    precipitation_probability_max: [0, 20, 90], precipitation_sum: [0, 0.2, 31.04],
    wind_speed_10m_max: [10, 20, 45], wind_gusts_10m_max: [20, 30, 80], uv_index_max: [11.2, 8, 3],
    sunrise: ['2026-11-06T05:41', '2026-11-07T05:40', '2026-11-08T05:40'], sunset: ['2026-11-06T18:30', '2026-11-07T18:31', '2026-11-08T18:31'],
  };
  const days = dayList(daily, '2026-11-07T10:00');
  assert.deepEqual(days.map((d) => d.label), ['Aujourd’hui', 'Demain']);
  assert.equal(days[0].max, 27);
  assert.equal(days[0].min, 20);
  assert.equal(days[1].min, null);
  assert.equal(days[1].mm, 31);
  assert.equal(days[1].sunrise, '05:40');
  assert.equal(days[1].uv, 3);
});

test('libellés', () => {
  assert.equal(dayTitle('2026-11-09', '2026-11-06'), 'Lundi 9 novembre');
  assert.equal(dayTitle('2027-01-01', '2026-12-31'), 'Demain');
  assert.equal(hhmm('2026-11-06T05:41'), '05:41');
  assert.equal(windText(25, 60), '25 km/h (raf. 60)');
  assert.equal(windText(25, 30), '25 km/h');
  assert.equal(rainText(40, 2.5), '40 % · 2,5 mm');
  assert.equal(rainText(10, 0), '10 %');
});
