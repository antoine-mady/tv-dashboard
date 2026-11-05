// Extraction de l'ID de playlist depuis un lien YouTube / YouTube Music ou un ID brut. Pur, testé.
export function parsePlaylistId(input) {
  const s = String(input || '').trim();
  if (!s) return '';
  const m = /[?&]list=([A-Za-z0-9_-]+)/.exec(s);
  if (m) return m[1];
  return /^[A-Za-z0-9_-]+$/.test(s) ? s : '';
}

/** Durée en secondes → "m:ss". */
export function formatDuration(sec) {
  const s = Math.max(0, Math.floor(sec || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m + ':' + (r < 10 ? '0' : '') + r;
}
