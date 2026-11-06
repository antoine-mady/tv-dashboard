// Anniversaires : nettoyage des titres, âge, liste à venir (logique pure, testée dans birthdays.test.js).
// Compatible Chrome 56 (pas de flat(), pas de fromEntries, pas de regex avec drapeau « u »).

const DAY_MS = 86400000;

function startOfDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }

// Émojis festifs courants (paires de substitution UTF-16, sans le drapeau « u »).
const EMOJI_RE = /\uD83C[\uDF81\uDF82\uDF88\uDF89\uDF8A]|\uD83E\uDD73|\u2764\uFE0F?/g;
const YEAR_RE = /\b(19\d{2}|20\d{2})\b/;

/** Mots-clés du filtre (« anniv, birthday ») → liste en minuscules ; vide = tout garder. */
export function parseFilter(text) {
  return String(text || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
}

export function matchesFilter(summary, keywords) {
  if (!keywords.length) return true;
  const s = String(summary || '').toLowerCase();
  return keywords.some((k) => s.indexOf(k) >= 0);
}

/** Année de naissance écrite dans le titre (« Marie (1990) », « Marie née en 1990 »), sinon null. */
export function birthYear(summary, now) {
  const m = YEAR_RE.exec(String(summary || ''));
  if (!m) return null;
  const y = +m[1];
  return y <= (now || new Date()).getFullYear() ? y : null;
}

/** « 🎂 Anniversaire de Marie (1990) » → « Marie ». */
export function cleanName(summary) {
  const original = String(summary || '').trim();
  let s = original.replace(EMOJI_RE, ' ');
  s = s.replace(/\(?\s*(?:née?\s+(?:en|le)\s+)?(?:19|20)\d{2}\s*\)?/gi, ' ');
  s = s.replace(/^\s*(?:joyeux\s+)?anniv(?:ersaire)?\b\s*(?:de\s+|d['’]\s*|du\s+|[:\-–—]\s*)?/i, '');
  s = s.replace(/^\s*(?:happy\s+)?birthday\b\s*(?:of\s+|[:\-–—]\s*)?/i, '');
  s = s.replace(/['’]s\s+birthday\s*$/i, '');
  s = s.replace(/\s*[:\-–—]?\s*anniv(?:ersaire)?\s*$/i, '');
  s = s.replace(/\s+/g, ' ').replace(/^[\s:\-–—,]+|[\s:\-–—,]+$/g, '');
  return s || original || '(Sans nom)';
}

/** « Aujourd’hui », « Demain », « Samedi » (dans la semaine), sinon « Dans 12 jours ». */
export function whenLabel(days, day) {
  if (days === 0) return 'Aujourd’hui';
  if (days === 1) return 'Demain';
  if (days < 7) {
    const s = day.toLocaleDateString('fr-FR', { weekday: 'long' });
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  return 'Dans ' + days + ' jours';
}

export function dateLabel(day) {
  return day.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
}

/**
 * Occurrences (sortie de expandEvents) → anniversaires à venir, triés, sans doublon
 * (même prénom le même jour dans deux agendas), au plus `max`.
 * → [{ name, days, when, date, age, today }]
 */
export function upcoming(occurrences, now, opts) {
  const o = opts || {};
  const keywords = parseFilter(o.filter);
  const today = startOfDay(now);
  const seen = {};
  const list = [];
  occurrences.forEach((occ) => {
    if (!matchesFilter(occ.summary, keywords)) return;
    const day = startOfDay(occ.start);
    const days = Math.round((day - today) / DAY_MS);
    if (days < 0) return;
    const name = cleanName(occ.summary);
    const key = days + '|' + name.toLowerCase();
    if (seen[key]) return;
    seen[key] = true;
    const year = o.showAge === false ? null : birthYear(occ.summary, now);
    const age = year ? day.getFullYear() - year : null;
    list.push({
      name, days, today: days === 0,
      when: whenLabel(days, day), date: dateLabel(day),
      age: age && age > 0 ? age : null,
    });
  });
  list.sort((a, b) => (a.days - b.days) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return list.slice(0, Math.max(1, o.max || 6));
}

/** Fenêtre à déplier : du début d’aujourd’hui à la fin du jour « aujourd’hui + daysAhead ». */
export function windowFor(now, daysAhead) {
  const today = startOfDay(now);
  return { from: today, to: new Date(today.getFullYear(), today.getMonth(), today.getDate() + Math.max(1, daysAhead) + 1) };
}
