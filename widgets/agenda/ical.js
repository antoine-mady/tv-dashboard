// Lecture des agendas au format iCalendar (RFC 5545) : logique pure, testée dans ical.test.js.
// Couvre ce que produisent Google Agenda, iCloud et Outlook : événements simples ou « journée entière »,
// fuseaux horaires (TZID), récurrences courantes (RRULE DAILY/WEEKLY/MONTHLY/YEARLY avec INTERVAL, COUNT,
// UNTIL, BYDAY, BYMONTHDAY, BYMONTH), exceptions (EXDATE) et occurrences modifiées (RECURRENCE-ID).
// Compatible Chrome 56 : pas d'Intl.formatToParts, pas de flat(), pas de fromEntries.

const DAY_MS = 86400000;
const WEEKDAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const MAX_ITERATIONS = 20000; // garde-fou contre les règles sans fin

/** webcal:// → https:// (forme donnée par iCloud et Outlook). */
export function normalizeUrl(url) {
  const u = String(url || '').trim();
  return u.replace(/^webcals?:\/\//i, 'https://');
}

/** Une URL par ligne ; les lignes vides et les commentaires (#) sont ignorés. */
export function parseUrlList(text) {
  return String(text || '').split(/\r?\n/).map((l) => l.trim())
    .filter((l) => l && l.charAt(0) !== '#').map(normalizeUrl);
}

// ---- Lecture du texte ---------------------------------------------------------

function unfold(text) {
  return String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n[ \t]/g, '');
}

function unescapeText(v) {
  return v.replace(/\\([\\;,nN])/g, (m, c) => (c === 'n' || c === 'N' ? '\n' : c));
}

/** « DTSTART;TZID=Europe/Paris:20261105T143000 » → { name, params, value } */
export function parseLine(line) {
  // Le ':' de séparation est le premier qui n'est pas entre guillemets.
  let inQuote = false;
  let sep = -1;
  for (let i = 0; i < line.length; i++) {
    const c = line.charAt(i);
    if (c === '"') inQuote = !inQuote;
    else if (c === ':' && !inQuote) { sep = i; break; }
  }
  if (sep < 0) return null;
  const head = line.slice(0, sep).split(';');
  const params = {};
  for (let i = 1; i < head.length; i++) {
    const eq = head[i].indexOf('=');
    if (eq > 0) params[head[i].slice(0, eq).toUpperCase()] = head[i].slice(eq + 1).replace(/^"|"$/g, '');
  }
  return { name: head[0].toUpperCase(), params, value: line.slice(sep + 1) };
}

/** Valeur DATE ou DATE-TIME → « heure murale » { y, m, d, hh, mi, ss, utc, allDay, tzid }. */
export function parseDateValue(value, params) {
  const p = params || {};
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(String(value).trim());
  if (!m) return null;
  const allDay = !m[4] || p.VALUE === 'DATE';
  return {
    y: +m[1], m: +m[2], d: +m[3],
    hh: allDay ? 0 : +m[4], mi: allDay ? 0 : +m[5], ss: allDay ? 0 : +(m[6] || 0),
    utc: !!m[7], allDay, tzid: m[7] || allDay ? null : (p.TZID || null),
  };
}

/** « P1D », « PT1H30M », « -P1W » → millisecondes. */
export function parseDuration(v) {
  const m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(String(v || '').trim());
  if (!m) return null;
  const ms = ((+(m[2] || 0) * 7 + +(m[3] || 0)) * DAY_MS)
    + (+(m[4] || 0) * 3600 + +(m[5] || 0) * 60 + +(m[6] || 0)) * 1000;
  return m[1] === '-' ? -ms : ms;
}

export function parseRrule(v) {
  const r = {};
  String(v || '').split(';').forEach((part) => {
    const eq = part.indexOf('=');
    if (eq > 0) r[part.slice(0, eq).toUpperCase()] = part.slice(eq + 1);
  });
  if (!r.FREQ) return null;
  return {
    freq: r.FREQ.toUpperCase(),
    interval: Math.max(1, parseInt(r.INTERVAL, 10) || 1),
    count: r.COUNT ? parseInt(r.COUNT, 10) : null,
    until: r.UNTIL ? parseDateValue(r.UNTIL) : null,
    byDay: r.BYDAY ? r.BYDAY.split(',').map((s) => {
      const d = /^([+-]?\d+)?(SU|MO|TU|WE|TH|FR|SA)$/i.exec(s.trim());
      return d ? { n: d[1] ? parseInt(d[1], 10) : 0, wd: WEEKDAYS.indexOf(d[2].toUpperCase()) } : null;
    }).filter(Boolean) : null,
    byMonthDay: r.BYMONTHDAY ? r.BYMONTHDAY.split(',').map((s) => parseInt(s, 10)).filter((n) => n) : null,
    byMonth: r.BYMONTH ? r.BYMONTH.split(',').map((s) => parseInt(s, 10)).filter((n) => n >= 1 && n <= 12) : null,
  };
}

/** Nom de l'agenda (X-WR-CALNAME, fourni par Google, iCloud, Outlook), ou '' . */
export function calendarName(text) {
  const lines = unfold(String(text || '')).split('\n');
  for (let i = 0; i < lines.length; i++) {
    const up = lines[i].toUpperCase();
    if (up === 'BEGIN:VEVENT') break;
    if (up.indexOf('X-WR-CALNAME') === 0) {
      const p = parseLine(lines[i]);
      if (p) return unescapeText(p.value).trim();
    }
  }
  return '';
}

/** Texte .ics → liste de VEVENT bruts (dates en heure murale, non encore converties). */
export function parseIcs(text) {
  const lines = unfold(text).split('\n');
  const events = [];
  let ev = null;
  let depth = 0; // VALARM etc. imbriqués dans un VEVENT
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const up = line.toUpperCase();
    if (up === 'BEGIN:VEVENT') { ev = { exdates: [] }; depth = 0; continue; }
    if (!ev) continue;
    if (up === 'END:VEVENT') { if (ev.start) events.push(ev); ev = null; continue; }
    if (up.indexOf('BEGIN:') === 0) { depth++; continue; }
    if (up.indexOf('END:') === 0) { depth--; continue; }
    if (depth > 0) continue;
    const p = parseLine(line);
    if (!p) continue;
    switch (p.name) {
      case 'UID': ev.uid = p.value; break;
      case 'SUMMARY': ev.summary = unescapeText(p.value); break;
      case 'LOCATION': ev.location = unescapeText(p.value); break;
      case 'DESCRIPTION': ev.description = unescapeText(p.value); break;
      case 'STATUS': ev.status = p.value.toUpperCase(); break;
      case 'DTSTART': ev.start = parseDateValue(p.value, p.params); break;
      case 'DTEND': ev.end = parseDateValue(p.value, p.params); break;
      case 'DURATION': ev.duration = parseDuration(p.value); break;
      case 'RRULE': ev.rrule = parseRrule(p.value); break;
      case 'RECURRENCE-ID': ev.recurrenceId = parseDateValue(p.value, p.params); break;
      case 'EXDATE':
        p.value.split(',').forEach((v) => {
          const d = parseDateValue(v, p.params);
          if (d) ev.exdates.push(d);
        });
        break;
      default: break;
    }
  }
  return events;
}

// ---- Fuseaux horaires ---------------------------------------------------------

const TZ_RE = /(\d+)\/(\d+)\/(\d+),?\s+(\d+):(\d+):(\d+)/;

/** Décalage (ms) du fuseau `tz` à l'instant `utcMs`, via toLocaleString (dispo sur Chrome 56). */
function tzOffset(utcMs, tz) {
  const s = new Date(utcMs).toLocaleString('en-US', {
    timeZone: tz, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const m = TZ_RE.exec(s);
  if (!m) throw new Error('fuseau illisible');
  const asUtc = Date.UTC(+m[3], +m[1] - 1, +m[2], +m[4] % 24, +m[5], +m[6]);
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

const tzValid = {};
function isValidTz(tz) {
  if (!(tz in tzValid)) {
    try { tzOffset(0, tz); tzValid[tz] = true; } catch (e) { tzValid[tz] = false; }
  }
  return tzValid[tz];
}

/** Heure murale → Date. Fuseau inconnu (ex. noms Windows d'Outlook) : heure locale de la TV. */
export function toDate(w) {
  if (w.allDay) return new Date(w.y, w.m - 1, w.d);
  if (w.utc) return new Date(Date.UTC(w.y, w.m - 1, w.d, w.hh, w.mi, w.ss));
  let tz = w.tzid ? w.tzid.replace(/^\/[^/]+\/[^/]+\//, '') : null; // « /mozilla.org/20050126_1/Europe/Paris »
  if (!tz || !isValidTz(tz)) return new Date(w.y, w.m - 1, w.d, w.hh, w.mi, w.ss);
  const guess = Date.UTC(w.y, w.m - 1, w.d, w.hh, w.mi, w.ss);
  const off1 = tzOffset(guess, tz);
  let t = guess - off1;
  const off2 = tzOffset(t, tz);
  if (off2 !== off1) t = guess - off2; // changement d'heure entre les deux
  return new Date(t);
}

// ---- Récurrences --------------------------------------------------------------

// Calcul de calendrier sur des dates « pures » (jours depuis l'époque, sans fuseau).
function dayNum(y, m, d) { return Math.floor(Date.UTC(y, m - 1, d) / DAY_MS); }
function fromDayNum(n) {
  const dt = new Date(n * DAY_MS);
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}
function daysInMonth(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); }
function weekday(n) { return ((n % 7) + 11) % 7; } // 1970-01-01 = jeudi (4)

/** Jours du mois (y, m) qui correspondent à BYDAY (« 2TU », « -1FR », « MO »). */
function monthDaysByWeekday(y, m, byDay) {
  const first = dayNum(y, m, 1);
  const len = daysInMonth(y, m);
  const out = [];
  byDay.forEach((b) => {
    const days = [];
    for (let i = 0; i < len; i++) if (weekday(first + i) === b.wd) days.push(first + i);
    if (!b.n) days.forEach((x) => out.push(x));
    else {
      const x = b.n > 0 ? days[b.n - 1] : days[days.length + b.n];
      if (x !== undefined) out.push(x);
    }
  });
  return out;
}

function monthDaysByNumber(y, m, list) {
  const len = daysInMonth(y, m);
  const out = [];
  list.forEach((n) => {
    const d = n > 0 ? n : len + n + 1;
    if (d >= 1 && d <= len) out.push(dayNum(y, m, d));
  });
  return out;
}

/** Jours candidats (en dayNum) de la période `k` de la règle, triés. */
function periodDays(rule, startDay, k) {
  const s = fromDayNum(startDay);
  let days = [];
  if (rule.freq === 'DAILY') {
    days = [startDay + k * rule.interval];
  } else if (rule.freq === 'WEEKLY') {
    // Semaines commençant le lundi (WKST=MO, valeur par défaut des agendas grand public).
    const weekStart = startDay - ((weekday(startDay) + 6) % 7) + k * 7 * rule.interval;
    const wds = rule.byDay ? rule.byDay.map((b) => b.wd) : [weekday(startDay)];
    days = wds.map((wd) => weekStart + ((wd + 6) % 7));
  } else if (rule.freq === 'MONTHLY') {
    const total = (s.m - 1) + k * rule.interval;
    const y = s.y + Math.floor(total / 12);
    const m = (total % 12) + 1;
    if (rule.byDay) days = monthDaysByWeekday(y, m, rule.byDay);
    else days = monthDaysByNumber(y, m, rule.byMonthDay || [s.d]);
  } else if (rule.freq === 'YEARLY') {
    const y = s.y + k * rule.interval;
    const months = rule.byMonth || [s.m];
    months.forEach((m) => {
      let list;
      if (rule.byDay) list = monthDaysByWeekday(y, m, rule.byDay);
      else list = monthDaysByNumber(y, m, rule.byMonthDay || [s.d]); // 29 février : ignoré les autres années
      list.forEach((x) => days.push(x));
    });
  } else {
    return null; // HOURLY, MINUTELY… : non géré, seule la 1re occurrence est affichée
  }
  return days.sort((a, b) => a - b);
}

function eventDuration(ev, startMs) {
  if (ev.end) return Math.max(0, toDate(ev.end).getTime() - startMs);
  if (ev.duration != null) return Math.max(0, ev.duration);
  return ev.start.allDay ? DAY_MS : 0;
}

function withDay(w, n) {
  const d = fromDayNum(n);
  return { y: d.y, m: d.m, d: d.d, hh: w.hh, mi: w.mi, ss: w.ss, utc: w.utc, allDay: w.allDay, tzid: w.tzid };
}

/** Durée d'un événement « journée entière » en jours (pour les événements sur plusieurs jours). */
function allDaySpan(ev) {
  if (ev.end && ev.end.allDay) return Math.max(1, dayNum(ev.end.y, ev.end.m, ev.end.d) - dayNum(ev.start.y, ev.start.m, ev.start.d));
  if (ev.duration != null) return Math.max(1, Math.round(ev.duration / DAY_MS));
  return 1;
}

function makeOccurrence(ev, w, extra) {
  const start = toDate(w);
  let end;
  if (w.allDay) {
    const n = dayNum(w.y, w.m, w.d) + allDaySpan(ev);
    const e = fromDayNum(n);
    end = new Date(e.y, e.m - 1, e.d);
  } else {
    end = new Date(start.getTime() + eventDuration(ev, toDate(ev.start).getTime()));
  }
  const o = { summary: ev.summary || '(Sans titre)', location: ev.location || '', description: ev.description || '',
    start, end, allDay: w.allDay };
  Object.keys(extra || {}).forEach((k) => { o[k] = extra[k]; });
  return o;
}

function wallKey(w) {
  return w.y * 10000 + w.m * 100 + w.d;
}

/**
 * Occurrences des événements qui chevauchent [from, to[, triées (journée entière d'abord le même jour).
 * `extra` est recopié sur chaque occurrence (ex. { calendar: 0 }).
 */
export function expandEvents(events, from, to, extra) {
  const fromMs = from.getTime();
  const toMs = to.getTime();
  const out = [];
  const keep = (o) => {
    const s = o.start.getTime();
    const e = o.end.getTime();
    if (e === s ? s >= fromMs && s < toMs : e > fromMs && s < toMs) out.push(o);
  };

  // Occurrences modifiées : elles remplacent l'occurrence d'origine de la série (même UID).
  const overridden = {};
  events.forEach((ev) => {
    if (ev.recurrenceId && ev.uid) {
      (overridden[ev.uid] = overridden[ev.uid] || {})[toDate(ev.recurrenceId).getTime()] = true;
    }
  });

  events.forEach((ev) => {
    if (ev.status === 'CANCELLED') return;
    if (!ev.rrule || ev.recurrenceId) {
      keep(makeOccurrence(ev, ev.start, extra));
      return;
    }
    const rule = ev.rrule;
    const startDay = dayNum(ev.start.y, ev.start.m, ev.start.d);
    const untilMs = rule.until ? (rule.until.allDay ? toDate(rule.until).getTime() + DAY_MS - 1 : toDate(rule.until).getTime()) : Infinity;
    const ex = {};
    ev.exdates.forEach((x) => { ex[x.allDay || ev.start.allDay ? 'd' + wallKey(x) : toDate(x).getTime()] = true; });
    const skip = overridden[ev.uid] || {};

    let count = 0;
    let iterations = 0;
    for (let k = 0; iterations < MAX_ITERATIONS; k++) {
      const days = periodDays(rule, startDay, k);
      if (!days) { keep(makeOccurrence(ev, ev.start, extra)); break; }
      let stop = false;
      for (let i = 0; i < days.length; i++) {
        iterations++;
        if (days[i] < startDay) continue;
        const w = withDay(ev.start, days[i]);
        const t = toDate(w).getTime();
        if (t > untilMs || t >= toMs) { stop = true; break; }
        count++;
        if (rule.count && count > rule.count) { stop = true; break; }
        if (ex[w.allDay ? 'd' + wallKey(w) : t] || skip[t]) continue;
        keep(makeOccurrence(ev, w, extra));
      }
      if (stop) break;
    }
  });

  return out.sort((a, b) => (a.start - b.start) || ((b.allDay ? 1 : 0) - (a.allDay ? 1 : 0))
    || (a.summary < b.summary ? -1 : a.summary > b.summary ? 1 : 0));
}
