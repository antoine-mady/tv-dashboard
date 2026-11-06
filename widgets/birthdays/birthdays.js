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
      name, days, today: days === 0, day, year,
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

// ---------------------------------------------------------------------------
// Anniversaires saisis à la main / importés des contacts (vCard).
// L’agenda « Anniversaires » de Google (tiré des contacts) n’a pas d’adresse iCal :
// on importe donc les contacts (contacts.google.com → Exporter → vCard) dans l’admin,
// qui n’en garde qu’une ligne par personne : « 12/05/1990 Marie Dupont » (année facultative).

function pad2(n) { return (n < 10 ? '0' : '') + n; }

function validDay(month, day) {
  return month >= 1 && month <= 12 && day >= 1 && day <= [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

/** Valeur BDAY d’une vCard (« 1990-05-12 », « 19900512 », « --05-12 », « --0512 », « 1990-05-12T00:00:00Z »). */
export function parseBday(value) {
  const v = String(value || '').trim();
  let m = /^(\d{4})-?(\d{2})-?(\d{2})/.exec(v);
  if (m) {
    const y = +m[1];
    // Google met parfois une année fictive (1604) quand elle est inconnue.
    return validDay(+m[2], +m[3]) ? { year: y > 1800 ? y : null, month: +m[2], day: +m[3] } : null;
  }
  m = /^--(\d{2})-?(\d{2})/.exec(v);
  if (m) return validDay(+m[1], +m[2]) ? { year: null, month: +m[1], day: +m[2] } : null;
  return null;
}

function unescapeVcard(s) {
  return s.replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1');
}

/** Contenu d’un fichier .vcf → [{ name, day, month, year }] (contacts sans date de naissance ignorés). */
export function parseVcard(text) {
  const lines = String(text || '').replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '').split('\n');
  const out = [];
  let cur = null;
  lines.forEach((line) => {
    const i = line.indexOf(':');
    if (i < 0) return;
    const head = line.slice(0, i).toUpperCase();
    const value = line.slice(i + 1);
    const prop = head.split(';')[0].replace(/^ITEM\d+\./, '');
    if (prop === 'BEGIN' && value.trim().toUpperCase() === 'VCARD') cur = {};
    else if (!cur) return;
    else if (prop === 'END') {
      const name = cur.fn || cur.n;
      if (cur.bday && name) out.push({ name, day: cur.bday.day, month: cur.bday.month, year: cur.bday.year });
      cur = null;
    } else if (prop === 'FN') cur.fn = unescapeVcard(value).trim();
    else if (prop === 'N') {
      const p = value.split(';').map((s) => unescapeVcard(s).trim());
      cur.n = [p[1], p[0]].filter(Boolean).join(' ');
    } else if (prop === 'BDAY') cur.bday = parseBday(value);
  });
  return out;
}

/** [{ name, day, month, year }] → texte « JJ/MM[/AAAA] Nom », trié par date. */
export function formatContacts(list) {
  return list.slice().sort((a, b) => (a.month - b.month) || (a.day - b.day) || (a.name < b.name ? -1 : 1))
    .map((c) => pad2(c.day) + '/' + pad2(c.month) + (c.year ? '/' + c.year : '') + ' ' + c.name)
    .join('\n');
}

/** Texte « JJ/MM[/AAAA] Nom » (une ligne par personne, # = commentaire) → { list, errors }. */
export function parseContacts(text) {
  const list = [];
  const errors = [];
  String(text || '').split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.charAt(0) === '#') return;
    const m = /^(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{4}))?\s+(.+)$/.exec(line);
    if (!m || !validDay(+m[2], +m[1])) { errors.push('Ligne ' + (i + 1) + ' : « ' + line + ' »'); return; }
    list.push({ name: m[4].trim(), day: +m[1], month: +m[2], year: m[3] ? +m[3] : null });
  });
  return { list, errors };
}

/** Occurrences annuelles dans [from, to[ au format de expandEvents ({ summary, start }). */
export function contactOccurrences(list, from, to) {
  const out = [];
  list.forEach((c) => {
    for (let y = from.getFullYear(); y <= to.getFullYear(); y++) {
      // 29 février fêté le 28 les années non bissextiles.
      const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
      const start = new Date(y, c.month - 1, c.month === 2 && c.day === 29 && !leap ? 28 : c.day);
      if (start >= from && start < to) out.push({ summary: c.name + (c.year ? ' (' + c.year + ')' : ''), start });
    }
  });
  return out;
}

// ---- Panneau « tout voir » : recherche et tri ---------------------------------------

/** Minuscules sans accents : « Hélène » → « helene ». */
export function normalize(text) {
  return String(text || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** Tous les mots de la recherche apparaissent dans le nom (sans tenir compte des accents ni de la casse). */
export function matchesQuery(name, query) {
  const n = normalize(name);
  return normalize(query).split(/\s+/).filter(Boolean).every((w) => n.indexOf(w) >= 0);
}

/**
 * Liste du panneau : une seule fois chaque personne (la prochaine date), filtrée par la recherche,
 * triée par date ('date') ou par nom ('name').
 */
export function searchBirthdays(list, query, sort) {
  const seen = {};
  const out = list.filter((b) => {
    const key = normalize(b.name) + '|' + b.day.getMonth() + '-' + b.day.getDate();
    if (seen[key]) return false;
    seen[key] = true;
    return matchesQuery(b.name, query);
  });
  if (sort === 'name') {
    out.sort((a, b) => {
      const x = normalize(a.name);
      const y = normalize(b.name);
      return x < y ? -1 : x > y ? 1 : a.days - b.days;
    });
  } else {
    out.sort((a, b) => a.days - b.days);
  }
  return out;
}

/** Groupes du panneau : par mois (« Novembre 2026 ») ou par initiale (« H »). → [{ label, items }] */
export function groupBirthdays(list, sort) {
  const groups = [];
  let cur = null;
  list.forEach((b) => {
    let label;
    if (sort === 'name') {
      const c = normalize(b.name).charAt(0).toUpperCase();
      label = /[A-Z]/.test(c) ? c : '#';
    } else {
      const m = b.day.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
      label = m.charAt(0).toUpperCase() + m.slice(1);
    }
    if (!cur || cur.label !== label) {
      cur = { label, items: [] };
      groups.push(cur);
    }
    cur.items.push(b);
  });
  return groups;
}

/** Phrase sur l'âge pour le détail : « Fêtera ses 36 ans », « A 36 ans aujourd’hui ! ». */
export function ageSentence(b) {
  if (!b.age) return '';
  return b.today ? 'A ' + b.age + ' ans aujourd’hui !' : 'Fêtera ses ' + b.age + ' ans';
}
