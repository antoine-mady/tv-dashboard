// Codes météo WMO (utilisés par Open-Meteo) → libellé français + nom d'icône. Pur, testé.

const CODES = {
  0: ['Ciel dégagé', 'clear'],
  1: ['Plutôt dégagé', 'partly'],
  2: ['Partiellement nuageux', 'partly'],
  3: ['Couvert', 'cloud'],
  45: ['Brouillard', 'fog'],
  48: ['Brouillard givrant', 'fog'],
  51: ['Bruine légère', 'drizzle'],
  53: ['Bruine', 'drizzle'],
  55: ['Bruine forte', 'drizzle'],
  56: ['Bruine verglaçante', 'drizzle'],
  57: ['Bruine verglaçante', 'drizzle'],
  61: ['Pluie faible', 'rain'],
  63: ['Pluie', 'rain'],
  65: ['Pluie forte', 'rain'],
  66: ['Pluie verglaçante', 'rain'],
  67: ['Pluie verglaçante', 'rain'],
  71: ['Neige faible', 'snow'],
  73: ['Neige', 'snow'],
  75: ['Neige forte', 'snow'],
  77: ['Grains de neige', 'snow'],
  80: ['Averses', 'rain'],
  81: ['Averses', 'rain'],
  82: ['Fortes averses', 'rain'],
  85: ['Averses de neige', 'snow'],
  86: ['Averses de neige', 'snow'],
  95: ['Orage', 'storm'],
  96: ['Orage et grêle', 'storm'],
  99: ['Orage et grêle', 'storm'],
};

/** → { label, icon } ; icon ∈ clear-day, clear-night, partly-day, partly-night, cloud, fog, drizzle, rain, snow, storm */
export function describeWeather(code, isDay) {
  const entry = CODES[code] || ['—', 'cloud'];
  let icon = entry[1];
  if (icon === 'clear' || icon === 'partly') icon += isDay === false ? '-night' : '-day';
  return { label: entry[0], icon };
}

export function buildUrl(s) {
  return 'https://api.open-meteo.com/v1/forecast'
    + '?latitude=' + s.latitude + '&longitude=' + s.longitude
    + '&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,is_day,wind_speed_10m'
    + '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max'
    + '&timezone=auto&forecast_days=' + (Number(s.days) + 1);
}
