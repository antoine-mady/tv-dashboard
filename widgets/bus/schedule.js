// Prochains départs à partir de la table embarquée (cf. gtfs.js) + temps réel (cf. gtfsrt.js).
// Logique PURE utilisée sur la TV (Chrome 56 : pas d'API récente ici).
// Les heures GTFS sont locales ; La Réunion n'a pas d'heure d'été, donc minuit + secondes suffit.

const MIN = 60 * 1000;

function pad(n) { return (n < 10 ? '0' : '') + n; }

/** Date locale → "AAAAMMJJ". */
export function ymd(d) {
  return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate());
}

/** Le service circule-t-il ce jour-là ? svc = [jours, début, fin, ajouts, retraits]. */
export function runsOn(svc, day) {
  const key = ymd(day);
  if (svc[4].indexOf(key) >= 0) return false;
  if (svc[3].indexOf(key) >= 0) return true;
  if (!svc[1] || key < svc[1] || key > svc[2]) return false;
  return svc[0].charAt((day.getDay() + 6) % 7) === '1'; // getDay : 0 = dimanche
}

function normName(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** "11, Lit2" → ['11', 'lit2'] (liste vide = toutes les lignes). */
export function parseRouteFilter(text) {
  return String(text || '').split(/[,;\s]+/).map(normName).filter(Boolean);
}

/** route_id des lignes demandées ; `unknown` = noms qui ne correspondent à aucune ligne de l'arrêt. */
export function selectRoutes(table, filter) {
  const ids = Object.keys(table.routes || {});
  if (!filter.length) return { ids, unknown: [] };
  const found = {};
  const sel = ids.filter((id) => {
    const n = filter.indexOf(normName(table.routes[id][0])) >= 0 ? normName(table.routes[id][0])
      : filter.indexOf(normName(id)) >= 0 ? normName(id) : null;
    if (n) found[n] = true;
    return !!n;
  });
  return { ids: sel, unknown: filter.filter((f) => !found[f]) };
}

/**
 * Passages prévus entre now - backMs et now + aheadMs (les bus en retard partent après l'heure prévue).
 * Renvoie des objets { scheduled (ms), route, dest, tripId, seq, stopId, date (AAAAMMJJ du service) }.
 */
export function scheduledBetween(table, nowMs, routeIds, backMs, aheadMs) {
  const allowed = {};
  routeIds.forEach((id) => { allowed[id] = true; });
  const from = nowMs - backMs;
  const to = nowMs + aheadMs;
  const out = [];
  const today = new Date(nowMs);
  // Les courses d'hier peuvent finir après minuit ("25:10:00").
  for (let offset = -1; offset <= 2; offset++) {
    const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
    const base = day.getTime();
    if (base > to) break;
    const runs = {};
    table.deps.forEach((d) => {
      if (!allowed[d[1]]) return;
      const at = base + d[0] * 1000;
      if (at < from || at > to) return;
      if (runs[d[3]] === undefined) runs[d[3]] = !!table.services[d[3]] && runsOn(table.services[d[3]], day);
      if (!runs[d[3]]) return;
      out.push({ scheduled: at, route: d[1], dest: d[2], tripId: d[4], seq: d[5], stopId: d[6], date: ymd(day) });
    });
  }
  out.sort((a, b) => a.scheduled - b.scheduled);
  return out;
}

/**
 * Applique les retards temps réel (règles GTFS-RT) : mise à jour de l'arrêt lui-même, sinon la plus proche
 * en amont (le retard se propage), sinon le retard global de la course.
 * Ajoute { expected (ms), delay (s) | null, live, canceled }.
 */
export function applyRealtime(deps, rt) {
  const trips = (rt && rt.trips) || {};
  return deps.map((d) => {
    const r = { scheduled: d.scheduled, route: d.route, dest: d.dest, tripId: d.tripId, seq: d.seq, stopId: d.stopId,
      date: d.date, expected: d.scheduled, delay: null, live: false, canceled: false };
    const tu = trips[d.tripId];
    if (!tu || (tu.startDate && tu.startDate !== d.date)) return r;
    if (tu.canceled) { r.canceled = true; r.live = true; return r; }
    const same = (u) => (u.seq !== null ? u.seq === d.seq : u.stopId === d.stopId);
    let exact = null;
    let upstream = null;
    (tu.stops || []).forEach((u) => {
      if (same(u)) exact = u;
      else if (u.seq !== null && u.seq < d.seq && (!upstream || u.seq > upstream.seq)) upstream = u;
    });
    if (exact && exact.skipped) { r.canceled = true; r.live = true; return r; }
    if (exact && exact.time) r.expected = exact.time * 1000;
    else if (exact && exact.delay !== null) r.expected = d.scheduled + exact.delay * 1000;
    else if (upstream && !upstream.skipped && upstream.delay !== null) r.expected = d.scheduled + upstream.delay * 1000;
    else if (tu.delay !== null && tu.delay !== undefined) r.expected = d.scheduled + tu.delay * 1000;
    else return r;
    r.delay = Math.round((r.expected - d.scheduled) / 1000);
    r.live = true;
    return r;
  });
}

/** Garde les `count` prochains départs encore attrapables (marche jusqu'à l'arrêt comprise). */
export function pickNext(deps, nowMs, count, walkMinutes) {
  const limit = nowMs + (walkMinutes || 0) * MIN;
  const shown = deps.filter((d) => (d.canceled ? d.scheduled : d.expected) >= limit - 30 * 1000);
  shown.sort((a, b) => (a.canceled ? a.scheduled : a.expected) - (b.canceled ? b.scheduled : b.expected));
  return shown.slice(0, count);
}

/** Texte de l'attente : « à l'approche », « 7 min », ou l'heure si c'est loin. */
export function formatWait(atMs, nowMs) {
  const mins = Math.floor((atMs - nowMs) / MIN);
  if (mins < 1) return 'à l’approche';
  if (mins < 60) return mins + ' min';
  const d = new Date(atMs);
  return pad(d.getHours()) + ':' + pad(d.getMinutes());
}

/** "+3 min", "−2 min", "à l'heure" ; null sans temps réel. */
export function formatDelay(delaySeconds) {
  if (delaySeconds === null || delaySeconds === undefined) return null;
  const m = Math.round(delaySeconds / 60);
  if (m === 0) return 'à l’heure';
  return (m > 0 ? '+' : '−') + Math.abs(m) + ' min';
}

/** Alertes qui concernent l'arrêt ou les lignes affichées, actives maintenant. */
export function relevantAlerts(alerts, table, routeIds, nowMs) {
  const stops = table.stopIds || [];
  const now = nowMs / 1000;
  const seen = {};
  return (alerts || []).filter((a) => {
    const active = !a.periods.length || a.periods.some((p) => (!p.start || p.start <= now) && (!p.end || now <= p.end));
    if (!active) return false;
    const hit = a.routes.some((r) => routeIds.indexOf(r) >= 0) || a.stops.some((s) => stops.indexOf(s) >= 0);
    if (!hit || !a.header || seen[a.header]) return false;
    seen[a.header] = true;
    return true;
  });
}

/** La table ne couvre plus aujourd'hui (elle reste valable toute sa dernière journée). */
export function tableExpired(table, nowMs) {
  if (!table.end) return true;
  return ymd(new Date(nowMs)) > table.end;
}

export function daysLeft(table, nowMs) {
  const e = table.end;
  if (!e) return 0;
  const end = new Date(Number(e.slice(0, 4)), Number(e.slice(4, 6)) - 1, Number(e.slice(6, 8)));
  const today = new Date(nowMs);
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((end.getTime() - t0.getTime()) / (24 * 3600 * 1000));
}
