// Extension serveur (admin uniquement, sur le PC) : télécharge le GTFS du réseau, cherche un arrêt
// et prépare la table des passages embarquée dans la config de la TV.
// Routes : /api/widgets/bus/stops?network=…&q=…  et  /api/widgets/bus/timetable?network=…&ids=…
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { feedsFor } from './networks.js';
import { readZip } from './unzip.js';
import { buildStopIndex, searchStops, extractTimetable } from './gtfs.js';

const FILES = ['stops.txt', 'routes.txt', 'trips.txt', 'stop_times.txt', 'calendar.txt', 'calendar_dates.txt'];
const CACHE_DIR = path.join(os.tmpdir(), 'tv-dashboard-gtfs');
const MAX_AGE = 12 * 3600 * 1000;

const memory = {}; // url → { at, files, index }

function cacheFile(url) {
  return path.join(CACHE_DIR, crypto.createHash('sha1').update(url).digest('hex') + '.zip');
}

async function download(url, maxAge) {
  const file = cacheFile(url);
  if (fs.existsSync(file) && Date.now() - fs.statSync(file).mtimeMs < maxAge) return fs.readFileSync(file);
  let r;
  try {
    r = await fetch(url, { signal: AbortSignal.timeout(120000), redirect: 'follow' });
  } catch (e) {
    if (fs.existsSync(file)) return fs.readFileSync(file); // hors ligne : dernière version connue
    throw new Error('Téléchargement du GTFS impossible : ' + (e.cause && e.cause.message ? e.cause.message : e.message));
  }
  if (!r.ok) throw new Error('Téléchargement du GTFS : erreur HTTP ' + r.status + ' (' + url + ')');
  const buf = Buffer.from(await r.arrayBuffer());
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(file, buf);
  return buf;
}

async function load(query, maxAge) {
  const url = feedsFor({ network: query.network, gtfsUrl: query.gtfsUrl }).gtfs;
  if (!/^https?:\/\//i.test(url)) throw new Error('Réseau inconnu ou adresse GTFS invalide');
  const hit = memory[url];
  if (hit && Date.now() - hit.at < maxAge) return hit;
  const zip = readZip(await download(url, maxAge), FILES);
  if (!zip['stops.txt'] || !zip['stop_times.txt'] || !zip['trips.txt']) throw new Error('GTFS incomplet (stops, trips ou stop_times manquant)');
  const files = {};
  Object.keys(zip).forEach((k) => { files[k] = zip[k].toString('utf8'); });
  memory[url] = { at: Date.now(), files, index: null };
  return memory[url];
}

export default {
  routes: {
    'GET /stops': async ({ query }) => {
      const feed = await load(query, MAX_AGE);
      if (!feed.index) feed.index = buildStopIndex(feed.files);
      return { stops: searchStops(feed.index, query.q || '', 20) };
    },
    'GET /timetable': async ({ query }) => {
      const ids = String(query.ids || '').split(',').map((s) => s.trim()).filter(Boolean);
      if (!ids.length) throw new Error('Aucun arrêt choisi');
      // « Mettre à jour » re-télécharge le GTFS (nouvelle saison d'horaires), sauf s'il date de moins de 10 min.
      const feed = await load(query, 10 * 60 * 1000);
      const table = extractTimetable(feed.files, ids, { network: query.network, stopName: query.name });
      if (!table.deps.length) throw new Error('Aucun départ trouvé à cet arrêt dans le GTFS');
      return { timetable: table };
    },
  },
};
