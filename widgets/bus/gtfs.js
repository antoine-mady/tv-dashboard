// Lecture d'un GTFS (horaires théoriques) — logique PURE, utilisée par server.js sur le PC.
// Entrée : le texte des fichiers .txt du zip. Sortie : une table compacte des passages à UN arrêt,
// embarquée dans la config de la TV (la TV ne télécharge jamais le GTFS complet).

/** Découpe une ligne CSV (guillemets RFC 4180). */
function splitCsvLine(line) {
  if (line.indexOf('"') < 0) return line.split(',');
  const out = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else quoted = false;
      } else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { out.push(cur); cur = ''; } else cur += c;
  }
  out.push(cur);
  return out;
}

/**
 * Appelle fn(row) pour chaque ligne d'un fichier CSV GTFS ; row = { colonne: valeur }.
 * Rapide sur les gros fichiers (stop_times.txt) : pas de tableau intermédiaire de toutes les lignes.
 */
export function eachRow(text, fn) {
  if (!text) return;
  let pos = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  let header = null;
  let pending = '';
  while (pos < text.length) {
    let end = text.indexOf('\n', pos);
    if (end < 0) end = text.length;
    let line = text.slice(pos, end);
    pos = end + 1;
    if (line.charCodeAt(line.length - 1) === 13) line = line.slice(0, -1);
    if (pending) { line = pending + '\n' + line; pending = ''; }
    // Champ entre guillemets qui contient un retour à la ligne : on attend la suite.
    if ((line.split('"').length - 1) % 2 === 1) { pending = line; continue; }
    if (!line.trim()) continue;
    const cells = splitCsvLine(line);
    if (!header) { header = cells.map((c) => c.trim()); continue; }
    const row = {};
    for (let i = 0; i < header.length; i++) row[header[i]] = cells[i] === undefined ? '' : cells[i].trim();
    fn(row);
  }
}

export function readRows(text) {
  const rows = [];
  eachRow(text, (r) => rows.push(r));
  return rows;
}

/** Minuscules, sans accents ni ponctuation : « Église de Grands-Bois » → « eglise de grands bois ». */
export function normalize(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ').trim();
}

/** "25:10:00" → secondes depuis le début de la journée de service (peut dépasser 24 h). */
export function parseGtfsTime(t) {
  const m = /^\s*(\d+):(\d\d)(?::(\d\d))?\s*$/.exec(t || '');
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3] || 0) : null;
}

function cleanColor(c) {
  return /^[0-9a-f]{6}$/i.test(c || '') ? '#' + c.toUpperCase() : '';
}

function routeName(r) {
  return r.route_short_name || r.route_long_name || r.route_id;
}

/**
 * Index des arrêts pour la recherche dans l'admin : arrêts regroupés par nom (un arrêt a souvent
 * un poteau par sens), avec les lignes qui y passent. Coûteux (parcourt stop_times) : à mettre en cache.
 */
export function buildStopIndex(files) {
  const routes = {};
  readRows(files['routes.txt']).forEach((r) => { routes[r.route_id] = routeName(r); });
  const tripRoute = {};
  readRows(files['trips.txt']).forEach((t) => { tripRoute[t.trip_id] = t.route_id; });
  const stopRoutes = {};
  eachRow(files['stop_times.txt'], (st) => {
    const rid = tripRoute[st.trip_id];
    if (rid === undefined) return;
    (stopRoutes[st.stop_id] || (stopRoutes[st.stop_id] = {}))[rid] = true;
  });

  const groups = {};
  readRows(files['stops.txt']).forEach((s) => {
    if (s.location_type && s.location_type !== '0') return; // gares, entrées… : seuls les poteaux ont des passages
    if (!stopRoutes[s.stop_id]) return;
    const key = normalize(s.stop_name);
    const g = groups[key] || (groups[key] = { name: s.stop_name, ids: [], routes: {}, key });
    g.ids.push(s.stop_id);
    Object.keys(stopRoutes[s.stop_id]).forEach((rid) => { g.routes[routes[rid] || rid] = true; });
  });
  return Object.keys(groups).map((k) => {
    const g = groups[k];
    return { name: g.name, ids: g.ids, routes: sortRouteNames(Object.keys(g.routes)), key: g.key };
  });
}

export function sortRouteNames(names) {
  return names.slice().sort((a, b) => a.localeCompare(b, 'fr', { numeric: true }));
}

/** Recherche « gare grands bois » : tous les mots doivent apparaître dans le nom. Exact d'abord. */
export function searchStops(index, query, limit) {
  const words = normalize(query).split(' ').filter(Boolean);
  if (!words.length) return [];
  const q = words.join(' ');
  const hits = index.filter((g) => words.every((w) => g.key.indexOf(w) >= 0));
  hits.sort((a, b) => (b.key === q) - (a.key === q) || (b.key.indexOf(q) === 0) - (a.key.indexOf(q) === 0)
    || a.name.localeCompare(b.name, 'fr'));
  return hits.slice(0, limit || 20).map((g) => ({ name: g.name, ids: g.ids, routes: g.routes }));
}

/**
 * Table des passages aux arrêts `stopIds` (format compact, embarqué dans la config de la TV) :
 *   routes   : { route_id: [nom, couleur, couleur du texte] }
 *   services : { service_id: [jours "1111100" (lun→dim), début, fin, [ajouts], [retraits]] }
 *   deps     : [[secondes, route_id, destination, service_id, trip_id, stop_sequence, stop_id], …] triés
 *   start/end: période couverte (AAAAMMJJ)
 * Ne garde pas les passages où le bus termine sa course (on ne peut pas y monter).
 */
export function extractTimetable(files, stopIds, opts) {
  const o = opts || {};
  const wanted = {};
  stopIds.forEach((id) => { wanted[id] = true; });

  const stopNames = {};
  let stopName = o.stopName || '';
  readRows(files['stops.txt']).forEach((s) => {
    stopNames[s.stop_id] = s.stop_name;
    if (!stopName && wanted[s.stop_id]) stopName = s.stop_name;
  });

  const trips = {};
  readRows(files['trips.txt']).forEach((t) => { trips[t.trip_id] = t; });

  // Un passage ; et, pour chaque course, son dernier arrêt (terminus = destination par défaut).
  const hits = [];
  const last = {};
  eachRow(files['stop_times.txt'], (st) => {
    const seq = Number(st.stop_sequence);
    const l = last[st.trip_id];
    if (!l || seq > l.seq) last[st.trip_id] = { seq, stop: st.stop_id };
    if (wanted[st.stop_id]) hits.push(st);
  });

  const usedRoutes = {};
  const usedServices = {};
  const deps = [];
  hits.forEach((st) => {
    const trip = trips[st.trip_id];
    if (!trip) return;
    const seq = Number(st.stop_sequence);
    if (last[st.trip_id].seq === seq) return; // terminus
    if (st.pickup_type === '1') return;       // descente uniquement
    const secs = parseGtfsTime(st.departure_time || st.arrival_time);
    if (secs === null) return;                // arrêt non minuté
    const dest = st.stop_headsign || trip.trip_headsign || stopNames[last[st.trip_id].stop] || '';
    deps.push([secs, trip.route_id, dest, trip.service_id, trip.trip_id, seq, st.stop_id]);
    usedRoutes[trip.route_id] = true;
    usedServices[trip.service_id] = true;
  });
  deps.sort((a, b) => a[0] - b[0] || String(a[1]).localeCompare(String(b[1])));

  const routes = {};
  readRows(files['routes.txt']).forEach((r) => {
    if (usedRoutes[r.route_id]) routes[r.route_id] = [routeName(r), cleanColor(r.route_color), cleanColor(r.route_text_color)];
  });

  const services = {};
  const svc = (id) => services[id] || (services[id] = ['0000000', '', '', [], []]);
  readRows(files['calendar.txt']).forEach((c) => {
    if (!usedServices[c.service_id]) return;
    const s = svc(c.service_id);
    s[0] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((d) => (c[d] === '1' ? '1' : '0')).join('');
    s[1] = c.start_date;
    s[2] = c.end_date;
  });
  readRows(files['calendar_dates.txt']).forEach((c) => {
    if (!usedServices[c.service_id]) return;
    const s = svc(c.service_id);
    if (c.exception_type === '1') s[3].push(c.date);
    else if (c.exception_type === '2') s[4].push(c.date);
  });
  // Les services sans aucun jour de circulation sont inutiles.
  Object.keys(usedServices).forEach((id) => { if (!services[id]) usedServices[id] = false; });
  const kept = deps.filter((d) => services[d[3]]);

  let start = '';
  let end = '';
  Object.keys(services).forEach((id) => {
    const s = services[id];
    const dates = (s[0] !== '0000000' && s[1] ? [s[1], s[2]] : []).concat(s[3]);
    dates.forEach((d) => {
      if (!start || d < start) start = d;
      if (!end || d > end) end = d;
    });
  });

  return {
    v: 1,
    network: o.network || '',
    stopName,
    stopIds: stopIds.slice(),
    generated: o.generated || new Date().toISOString(),
    start,
    end,
    routes,
    services,
    deps: kept,
  };
}
