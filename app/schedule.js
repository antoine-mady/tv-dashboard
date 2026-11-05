// Petites fonctions horaires pures (mode nuit…).

/** "HH:MM" → minutes depuis minuit (NaN si invalide). */
export function parseTime(str) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(str || '').trim());
  if (!m) return NaN;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** true si `now` (minutes) est dans [start, end[, en gérant le passage de minuit. */
export function isInRange(now, start, end) {
  if (isNaN(start) || isNaN(end) || start === end) return false;
  return start < end ? now >= start && now < end : now >= start || now < end;
}
