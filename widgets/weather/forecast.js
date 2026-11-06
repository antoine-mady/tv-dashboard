// Prévisions détaillées du panneau « météo dans le temps » (heure par heure, jour par jour). Pur, testé.
// Open-Meteo (timezone=auto) renvoie des heures locales du lieu : on travaille sur les chaînes ISO.

export const FORECAST_DAYS = 10;

export function buildForecastUrl(s) {
  return 'https://api.open-meteo.com/v1/forecast'
    + '?latitude=' + s.latitude + '&longitude=' + s.longitude
    + '&current=is_day'
    + '&hourly=temperature_2m,apparent_temperature,weather_code,precipitation_probability,precipitation,'
    + 'wind_speed_10m,wind_gusts_10m,is_day'
    + '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,'
    + 'wind_speed_10m_max,wind_gusts_10m_max,uv_index_max,sunrise,sunset'
    + '&timezone=auto&forecast_days=' + FORECAST_DAYS;
}

function at(arr, i) {
  return Array.isArray(arr) && arr[i] !== undefined && arr[i] !== null ? arr[i] : null;
}
function round(v) { return v === null ? null : Math.round(v); }
function mm(v) { return v === null ? null : Math.round(v * 10) / 10; }

/** « 2026-11-07 » → Date locale (midi, pour éviter tout effet de fuseau). */
function isoDay(day) {
  return new Date(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)), 12);
}

/** « Aujourd’hui », « Demain », sinon « Samedi 7 novembre ». */
export function dayTitle(day, today) {
  const diff = Math.round((isoDay(day) - isoDay(today)) / 86400000);
  if (diff === 0) return 'Aujourd’hui';
  if (diff === 1) return 'Demain';
  const s = isoDay(day).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** « 05:43 » depuis « 2026-11-07T05:43 ». */
export function hhmm(iso) {
  const m = /T(\d{2}):(\d{2})/.exec(String(iso || ''));
  return m ? m[1] + ':' + m[2] : null;
}

/**
 * Heures à partir de l'heure en cours, regroupées par jour → [{ label, day, items }]
 * item : { key, hour: '15h', now, code, isDay, temp, feels, rain (%), mm, wind, gusts }
 */
export function hourGroups(hourly, nowIso) {
  if (!hourly || !Array.isArray(hourly.time)) return [];
  const nowKey = String(nowIso || '').slice(0, 13); // 'AAAA-MM-JJTHH'
  const today = String(nowIso || hourly.time[0]).slice(0, 10);
  const groups = [];
  let cur = null;
  hourly.time.forEach((t, i) => {
    const key = String(t);
    if (key.slice(0, 13) < nowKey) return;
    const temp = at(hourly.temperature_2m, i);
    if (temp === null) return;
    const day = key.slice(0, 10);
    if (!cur || cur.day !== day) {
      cur = { day, label: dayTitle(day, today), items: [] };
      groups.push(cur);
    }
    cur.items.push({
      key,
      hour: Number(key.slice(11, 13)) + 'h',
      now: key.slice(0, 13) === nowKey,
      code: at(hourly.weather_code, i),
      isDay: at(hourly.is_day, i) !== 0,
      temp: round(temp),
      feels: round(at(hourly.apparent_temperature, i)),
      rain: at(hourly.precipitation_probability, i),
      mm: mm(at(hourly.precipitation, i)),
      wind: round(at(hourly.wind_speed_10m, i)),
      gusts: round(at(hourly.wind_gusts_10m, i)),
    });
  });
  return groups;
}

/**
 * Jours de prévision (à partir d'aujourd'hui) →
 * [{ key, label, code, max, min, rain, mm, wind, gusts, uv, sunrise, sunset }]
 */
export function dayList(daily, nowIso) {
  if (!daily || !Array.isArray(daily.time)) return [];
  const today = String(nowIso || daily.time[0]).slice(0, 10);
  const out = [];
  daily.time.forEach((day, i) => {
    if (String(day) < today) return;
    const max = at(daily.temperature_2m_max, i);
    if (max === null) return;
    out.push({
      key: String(day),
      label: dayTitle(String(day), today),
      code: at(daily.weather_code, i),
      max: round(max),
      min: round(at(daily.temperature_2m_min, i)),
      rain: at(daily.precipitation_probability_max, i),
      mm: mm(at(daily.precipitation_sum, i)),
      wind: round(at(daily.wind_speed_10m_max, i)),
      gusts: round(at(daily.wind_gusts_10m_max, i)),
      uv: round(at(daily.uv_index_max, i)),
      sunrise: hhmm(at(daily.sunrise, i)),
      sunset: hhmm(at(daily.sunset, i)),
    });
  });
  return out;
}

/** Vent « 25 km/h », avec rafales si nettement plus fortes : « 25 km/h (raf. 60) ». */
export function windText(wind, gusts) {
  if (wind === null) return '';
  return wind + ' km/h' + (gusts !== null && gusts >= wind + 15 ? ' (raf. ' + gusts + ')' : '');
}

/** Pluie « 40 % · 2.5 mm » (mm seulement s'il en tombe). */
export function rainText(prob, amount) {
  const parts = [];
  if (prob !== null) parts.push(prob + ' %');
  if (amount) parts.push(String(amount).replace('.', ',') + ' mm');
  return parts.join(' · ');
}
