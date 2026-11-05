// Infos complémentaires de la météo : soleil, indice UV, qualité de l'air. Pur, testé.

/** Open-Meteo (timezone=auto) renvoie l'heure locale du lieu : "2026-11-05T05:43" → "05:43". */
export function formatHour(iso) {
  if (typeof iso !== 'string') return null;
  const m = /T(\d{2}):(\d{2})/.exec(iso);
  return m ? m[1] + ':' + m[2] : null;
}

/** Durée du jour "10 h 52" à partir du lever et du coucher (heures locales ISO). */
export function dayLength(sunrise, sunset) {
  const a = formatHour(sunrise);
  const b = formatHour(sunset);
  if (!a || !b) return null;
  const toMin = (s) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
  const d = toMin(b) - toMin(a);
  if (d <= 0) return null;
  return Math.floor(d / 60) + ' h ' + ('0' + (d % 60)).slice(-2);
}

/** Échelle OMS de l'indice UV → { value, label, level } ; level 1 (faible) à 5 (extrême). */
export function uvLevel(uv) {
  if (uv === null || uv === undefined || isNaN(uv)) return null;
  const value = Math.round(uv);
  if (value < 3) return { value, label: 'Faible', level: 1 };
  if (value < 6) return { value, label: 'Modéré', level: 2 };
  if (value < 8) return { value, label: 'Élevé', level: 3 };
  if (value < 11) return { value, label: 'Très élevé', level: 4 };
  return { value, label: 'Extrême', level: 5 };
}

/** Indice européen de qualité de l'air (EAQI) → { value, label, level } ; level 1 (bon) à 6. */
export function aqiLevel(aqi) {
  if (aqi === null || aqi === undefined || isNaN(aqi)) return null;
  const value = Math.round(aqi);
  if (value <= 20) return { value, label: 'Bon', level: 1 };
  if (value <= 40) return { value, label: 'Correct', level: 2 };
  if (value <= 60) return { value, label: 'Moyen', level: 3 };
  if (value <= 80) return { value, label: 'Médiocre', level: 4 };
  if (value <= 100) return { value, label: 'Très mauvais', level: 5 };
  return { value, label: 'Extrêmement mauvais', level: 6 };
}

export function buildAirUrl(s) {
  return 'https://air-quality-api.open-meteo.com/v1/air-quality'
    + '?latitude=' + s.latitude + '&longitude=' + s.longitude
    + '&current=european_aqi,pm2_5&timezone=auto';
}
