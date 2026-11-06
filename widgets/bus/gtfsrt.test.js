import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeFeed } from './gtfsrt.js';

// Mini encodeur Protocol Buffers pour fabriquer des flux GTFS-RT de test.
function varint(n) {
  const out = [];
  let v = BigInt.asUintN(64, BigInt(n));
  do {
    let b = Number(v & 0x7fn);
    v >>= 7n;
    if (v) b |= 0x80;
    out.push(b);
  } while (v);
  return out;
}
const key = (f, w) => varint(f * 8 + w);
const int = (f, n) => key(f, 0).concat(varint(n));
const bytes = (f, arr) => key(f, 2).concat(varint(arr.length), arr);
const str = (f, s) => bytes(f, Array.from(Buffer.from(s, 'utf8')));
const msg = (f, ...parts) => bytes(f, [].concat(...parts));
const fixed64 = (f) => key(f, 1).concat([1, 2, 3, 4, 5, 6, 7, 8]);

const T = 1794211200; // horodatage > 2^31 : doit rester exact

function feed() {
  return new Uint8Array([].concat(
    msg(1, str(1, '2.0'), int(2, 0), int(3, T)),
    // Course en retard : TripDescriptor + deux StopTimeUpdate.
    msg(2, str(1, 'e1'), msg(3,
      msg(1, str(1, 'T11B'), str(2, '07:00:00'), str(3, '20261109'), int(4, 0), str(5, 'R11')),
      msg(2, int(1, 1), msg(2, int(1, 120)), str(4, 'NP')),
      msg(2, int(1, 2), msg(2, int(1, 150), int(2, T + 100)), msg(3, int(1, 180), int(2, T + 130)), str(4, 'GB2')),
      int(5, -45),
      fixed64(99))), // champ inconnu : ignoré
    // Retard négatif sur 10 octets (int32 négatif).
    msg(2, str(1, 'e2'), msg(3, msg(1, str(1, 'TL1')), msg(2, int(1, 2), msg(3, int(1, -90)), int(5, 1)))),
    // Course supprimée.
    msg(2, str(1, 'e3'), msg(3, msg(1, str(1, 'T11A'), int(4, 3)))),
    // Entité supprimée : ignorée.
    msg(2, str(1, 'e4'), int(2, 1), msg(3, msg(1, str(1, 'GONE')))),
    // Position de véhicule : ignorée.
    msg(2, str(1, 'e5'), msg(4, msg(1, str(1, 'T11B')))),
    // Alerte traduite.
    msg(2, str(1, 'e6'), msg(5,
      msg(1, int(1, T - 60), int(2, T + 3600)),
      msg(5, str(2, 'R11')),
      msg(5, str(5, 'GB2')),
      int(6, 1), int(7, 4),
      msg(10, msg(1, str(1, 'Detour'), str(2, 'en')), msg(1, str(1, 'Déviation à Grands Bois'), str(2, 'fr'))),
      msg(11, msg(1, str(1, 'Travaux avenue du Général de Gaulle'))))),
  ));
}

test('GTFS-RT : en-tête, retards, propagation de champs, suppression, alertes', () => {
  const f = decodeFeed(feed());
  assert.equal(f.timestamp, T);
  assert.deepEqual(Object.keys(f.trips).sort(), ['T11A', 'T11B', 'TL1']);

  const t = f.trips.T11B;
  assert.equal(t.startDate, '20261109');
  assert.equal(t.routeId, 'R11');
  assert.equal(t.canceled, false);
  assert.equal(t.delay, -45);
  assert.deepEqual(t.stops, [
    { seq: 1, stopId: 'NP', delay: 120, time: null, skipped: false },
    // Le départ prime sur l'arrivée.
    { seq: 2, stopId: 'GB2', delay: 180, time: T + 130, skipped: false },
  ]);
  assert.deepEqual(f.trips.TL1.stops, [{ seq: 2, stopId: '', delay: -90, time: null, skipped: true }]);
  assert.equal(f.trips.T11A.canceled, true);

  assert.deepEqual(f.alerts, [{
    periods: [{ start: T - 60, end: T + 3600 }],
    routes: ['R11'],
    stops: ['GB2'],
    header: 'Déviation à Grands Bois',
    description: 'Travaux avenue du Général de Gaulle',
  }]);
});

test('GTFS-RT : ArrayBuffer accepté, flux vide, flux tronqué', () => {
  const buf = feed();
  assert.equal(decodeFeed(buf.buffer.slice(0)).timestamp, T);
  assert.deepEqual(decodeFeed(new Uint8Array(0)), { timestamp: 0, trips: {}, alerts: [] });
  assert.throws(() => decodeFeed(buf.subarray(0, buf.length - 3)), /tronqué/);
});
