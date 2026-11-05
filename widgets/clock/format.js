// Formatage pur (testé dans clock.test.js).

export function formatTime(date, opts) {
  const o = opts || {};
  const parts = { hour: '2-digit', minute: '2-digit', hour12: false };
  if (o.seconds) parts.second = '2-digit';
  if (o.timeZone) parts.timeZone = o.timeZone;
  return date.toLocaleTimeString('fr-FR', parts);
}

export function formatDate(date, opts) {
  const o = opts || {};
  const parts = { weekday: 'long', day: 'numeric', month: 'long' };
  if (o.timeZone) parts.timeZone = o.timeZone;
  const s = date.toLocaleDateString('fr-FR', parts);
  return s.charAt(0).toUpperCase() + s.slice(1);
}
