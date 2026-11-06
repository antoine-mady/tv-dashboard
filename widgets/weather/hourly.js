// Prévisions des heures à venir (bloc `hourly` d'Open-Meteo). Pur, testé.

/**
 * Choisit les créneaux à afficher après l'heure courante.
 * - hourly : { time: ['2026-11-06T00:00', …], temperature_2m, weather_code, precipitation_probability, is_day }
 * - nowIso : heure locale actuelle du lieu (current.time, ex. '2026-11-06T14:15')
 * - count : nombre de créneaux ; step : écart en heures entre deux créneaux
 * → [{ hour: '15h', temp, code, isDay, rain }] (rain = null si inconnu)
 */
export function pickHours(hourly, nowIso, count, step) {
  if (!hourly || !Array.isArray(hourly.time) || !(count > 0)) return [];
  const st = Math.max(1, Math.round(step) || 1);
  const nowKey = typeof nowIso === 'string' ? nowIso.slice(0, 13) : ''; // 'AAAA-MM-JJTHH'
  // Premier créneau : la première heure pleine strictement après l'heure courante.
  let start = 0;
  while (start < hourly.time.length && String(hourly.time[start]).slice(0, 13) <= nowKey) start++;
  const out = [];
  for (let i = start + st - 1; i < hourly.time.length && out.length < count; i += st) {
    const m = /T(\d{2})/.exec(hourly.time[i]);
    const at = (arr) => (Array.isArray(arr) && arr[i] !== undefined ? arr[i] : null);
    const temp = at(hourly.temperature_2m);
    if (!m || temp === null) continue;
    out.push({
      hour: Number(m[1]) + 'h',
      temp: Math.round(temp),
      code: at(hourly.weather_code),
      isDay: at(hourly.is_day) !== 0,
      rain: at(hourly.precipitation_probability),
    });
  }
  return out;
}
