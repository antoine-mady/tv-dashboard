// Mot du jour (logique pure, testée dans creole.test.js).

const DAY_MS = 86400000;

/** « mot = traduction = exemple » par ligne ; « mot = traduction » suffit. Lignes vides et # ignorées. */
export function parseCustomWords(text) {
  return String(text || '').split(/\r?\n/).map((l) => l.trim())
    .filter((l) => l && l.charAt(0) !== '#')
    .map((l) => l.split('=').map((s) => s.trim()))
    .filter((p) => p.length >= 2 && p[0] && p[1])
    .map((p) => [p[0], p[1], p.slice(2).join(' = ')]);
}

/** Liste utilisée : mots intégrés + mots perso (un mot perso remplace le mot intégré du même nom). */
export function buildList(builtIn, custom, onlyCustom) {
  const key = (w) => w[0].toLowerCase();
  const customKeys = {};
  custom.forEach((w) => { customKeys[key(w)] = true; });
  const base = onlyCustom ? [] : builtIn.filter((w) => !customKeys[key(w)]);
  return base.concat(custom);
}

/** Numéro du jour local (change à minuit, heure de la TV). */
export function dayNumber(date) {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS);
}

// Mélange déterministe (toujours le même ordre pour une liste donnée) : pas d'ordre alphabétique visible.
function shuffled(n) {
  const order = [];
  for (let i = 0; i < n; i++) order.push(i);
  let seed = 974; // indicatif de La Réunion
  for (let i = n - 1; i > 0; i--) {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    const j = seed % (i + 1);
    const t = order[i]; order[i] = order[j]; order[j] = t;
  }
  return order;
}

/** Mot du jour `date` : chaque mot revient une fois par cycle (longueur de la liste). */
export function wordFor(list, date) {
  if (!list.length) return null;
  const order = shuffled(list.length);
  const w = list[order[((dayNumber(date) % list.length) + list.length) % list.length]];
  return { word: w[0], meaning: w[1], example: w[2] || '' };
}

export function yesterday(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1, 12);
}
