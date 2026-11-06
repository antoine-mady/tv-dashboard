import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { zipDirectory } from '../../tools/zip.js';
import { readZip } from './unzip.js';
import server from './server.js';
import { FILES } from './fixture.js';

function makeGtfsZip() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bus-gtfs-'));
  fs.mkdirSync(path.join(dir, 'src', 'gtfs'), { recursive: true });
  Object.keys(FILES).forEach((name) => fs.writeFileSync(path.join(dir, 'src', 'gtfs', name), FILES[name]));
  fs.writeFileSync(path.join(dir, 'src', 'agency.txt'), 'agency_id\nA\n');
  const out = path.join(dir, 'gtfs.zip');
  zipDirectory(path.join(dir, 'src'), out);
  return fs.readFileSync(out);
}

test('unzip : fichiers demandés, y compris dans un sous-dossier', () => {
  const files = readZip(makeGtfsZip(), ['stops.txt', 'calendar.txt']);
  assert.deepEqual(Object.keys(files).sort(), ['calendar.txt', 'stops.txt']);
  assert.equal(files['stops.txt'].toString('utf8'), FILES['stops.txt']);
  assert.equal(Object.keys(readZip(makeGtfsZip())).length, Object.keys(FILES).length + 1);
  assert.throws(() => readZip(Buffer.from('pas un zip du tout, vraiment pas')), /pas un zip/);
});

test('serveur : recherche d’arrêt puis table des horaires depuis un GTFS téléchargé', async () => {
  const zip = makeGtfsZip();
  let hits = 0;
  const srv = http.createServer((req, res) => { hits++; res.end(zip); });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  // Adresse unique : pas de cache d'un test précédent.
  const gtfsUrl = 'http://127.0.0.1:' + srv.address().port + '/gtfs-' + Date.now() + '.zip';
  try {
    const { stops } = await server.routes['GET /stops']({ query: { network: 'alterneo', gtfsUrl, q: 'église grands bois' } });
    assert.deepEqual(stops, [{ name: 'Eglise De Grands Bois', ids: ['GB1', 'GB2'], routes: ['11', 'Lit2'] }]);
    await server.routes['GET /stops']({ query: { network: 'alterneo', gtfsUrl, q: 'plage' } });
    assert.equal(hits, 1, 'GTFS mis en cache');

    const { timetable } = await server.routes['GET /timetable']({ query: { network: 'alterneo', gtfsUrl, ids: 'GB1,GB2' } });
    assert.equal(timetable.network, 'alterneo');
    assert.equal(timetable.stopName, 'Eglise De Grands Bois');
    assert.equal(timetable.deps.length, 4);
    assert.equal(hits, 1, 'GTFS récent réutilisé');

    await assert.rejects(server.routes['GET /timetable']({ query: { network: 'alterneo', gtfsUrl, ids: '' } }), /Aucun arrêt/);
    await assert.rejects(server.routes['GET /timetable']({ query: { network: 'alterneo', gtfsUrl, ids: 'NOPE' } }), /Aucun départ/);
    await assert.rejects(server.routes['GET /stops']({ query: { network: 'inconnu', q: 'x' } }), /Réseau inconnu/);
  } finally {
    srv.close();
  }
});
