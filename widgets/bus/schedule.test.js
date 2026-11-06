import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractTimetable } from './gtfs.js';
import {
  ymd, runsOn, parseRouteFilter, selectRoutes, scheduledBetween, applyRealtime, pickNext,
  formatWait, formatDelay, relevantAlerts, tableExpired, daysLeft, formatClock, endOfTomorrow, departuresByDay,
} from './schedule.js';
import { FILES } from './fixture.js';

const table = JSON.parse(JSON.stringify(extractTimetable(FILES, ['GB1', 'GB2'], { network: 'alterneo' })));
const ALL = ['R11', 'RLI2'];
const H = 3600 * 1000;
const at = (y, m, d, hh, mm) => new Date(y, m - 1, d, hh, mm || 0).getTime();

test('calendrier : jours de la semaine, exceptions, période', () => {
  const sem = table.services.SEM;
  assert.equal(ymd(new Date(2026, 10, 9)), '20261109');
  assert.equal(runsOn(sem, new Date(2026, 10, 9)), true);   // lundi
  assert.equal(runsOn(sem, new Date(2026, 10, 7)), false);  // samedi
  assert.equal(runsOn(sem, new Date(2026, 10, 11)), false); // 11 novembre retiré
  assert.equal(runsOn(table.services.WE, new Date(2026, 10, 11)), true); // ajouté
  assert.equal(runsOn(sem, new Date(2027, 2, 1)), false);   // après la fin
});

test('filtre de lignes : noms ou ids, insensible à la casse ; lignes inconnues signalées', () => {
  assert.deepEqual(parseRouteFilter(' 11, LIT2;x '), ['11', 'lit2', 'x']);
  assert.deepEqual(parseRouteFilter(''), []);
  assert.deepEqual(selectRoutes(table, []), { ids: ALL, unknown: [] });
  assert.deepEqual(selectRoutes(table, parseRouteFilter('11, Lit2')), { ids: ALL, unknown: [] });
  assert.deepEqual(selectRoutes(table, parseRouteFilter('Li2')), { ids: [], unknown: ['li2'] });
  assert.deepEqual(selectRoutes(table, parseRouteFilter('r11, 42')), { ids: ['R11'], unknown: ['42'] });
});

test('passages prévus : jour courant, filtre de lignes, courses d’hier après minuit', () => {
  const now = at(2026, 11, 9, 6, 0); // lundi 6 h
  const deps = scheduledBetween(table, now, ALL, H, 6 * H);
  assert.deepEqual(deps.map((d) => [d.tripId, d.date]), [['T11A', '20261109'], ['T11B', '20261109']]);
  assert.equal(deps[0].scheduled, at(2026, 11, 9, 6, 5));
  assert.equal(deps[0].dest, '9 Planètes');

  // Mardi 0 h 05 : la course TL1 de lundi part à 24:12, soit mardi 0 h 12.
  const night = scheduledBetween(table, at(2026, 11, 10, 0, 5), ALL, H, H);
  assert.deepEqual(night.map((d) => [d.tripId, d.date, d.scheduled]), [['TL1', '20261109', at(2026, 11, 10, 0, 12)]]);

  assert.deepEqual(scheduledBetween(table, now, ['RLI2'], H, 6 * H), []);
  // Samedi : seul le service week-end.
  assert.deepEqual(scheduledBetween(table, at(2026, 11, 7, 8, 0), ALL, H, 6 * H).map((d) => d.tripId), ['TL2']);
});

function dep(extra) {
  return Object.assign({ scheduled: at(2026, 11, 9, 7, 10), route: 'R11', dest: 'X', tripId: 'T11B', seq: 2, stopId: 'GB2', date: '20261109' }, extra);
}
const trip = (o) => ({ trips: { T11B: Object.assign({ tripId: 'T11B', startDate: '', canceled: false, delay: null, stops: [] }, o) } });
const stu = (o) => Object.assign({ seq: null, stopId: '', delay: null, time: null, skipped: false }, o);

test('temps réel : heure exacte, retard à l’arrêt, propagation depuis l’amont, retard global', () => {
  const t0 = at(2026, 11, 9, 7, 10);
  assert.equal(applyRealtime([dep()], null)[0].live, false);
  // Heure absolue à l'arrêt (par stop_sequence).
  let r = applyRealtime([dep()], trip({ stops: [stu({ seq: 2, time: (t0 + 4 * 60000) / 1000 })] }))[0];
  assert.deepEqual([r.expected, r.delay, r.live], [t0 + 4 * 60000, 240, true]);
  // Retard à l'arrêt, identifié par stop_id.
  r = applyRealtime([dep()], trip({ stops: [stu({ stopId: 'GB2', delay: -60 })] }))[0];
  assert.equal(r.delay, -60);
  // Propagation : dernière mise à jour en amont.
  r = applyRealtime([dep()], trip({ stops: [stu({ seq: 0, delay: 600 }), stu({ seq: 1, delay: 180 }), stu({ seq: 3, delay: 900 })] }))[0];
  assert.equal(r.delay, 180);
  // Retard global de la course.
  r = applyRealtime([dep()], trip({ delay: 120 }))[0];
  assert.equal(r.delay, 120);
  // Course d'un autre jour : ignorée.
  r = applyRealtime([dep()], trip({ startDate: '20261110', delay: 120 }))[0];
  assert.equal(r.live, false);
  // Course supprimée, ou arrêt non desservi.
  assert.equal(applyRealtime([dep()], trip({ canceled: true }))[0].canceled, true);
  assert.equal(applyRealtime([dep()], trip({ stops: [stu({ seq: 2, skipped: true })] }))[0].canceled, true);
  // Mise à jour sans information utile : horaire prévu.
  r = applyRealtime([dep()], trip({ stops: [stu({ seq: 2 })] }))[0];
  assert.equal(r.live, false);
});

test('prochains départs : temps de marche, bus en retard encore attrapable, tri par heure prévue', () => {
  const now = at(2026, 11, 9, 7, 0);
  const deps = [
    { scheduled: now - 5 * 60000, expected: now + 2 * 60000, canceled: false, id: 'retard' },
    { scheduled: now + 3 * 60000, expected: now + 3 * 60000, canceled: false, id: 'bientot' },
    { scheduled: now - 2 * 60000, expected: now - 2 * 60000, canceled: false, id: 'parti' },
    { scheduled: now + 20 * 60000, expected: now + 20 * 60000, canceled: true, id: 'supprime' },
  ];
  assert.deepEqual(pickNext(deps, now, 5, 0).map((d) => d.id), ['retard', 'bientot', 'supprime']);
  assert.deepEqual(pickNext(deps, now, 5, 3).map((d) => d.id), ['bientot', 'supprime']);
  assert.deepEqual(pickNext(deps, now, 1, 0).map((d) => d.id), ['retard']);
});

test('formats', () => {
  const now = at(2026, 11, 9, 7, 0);
  assert.equal(formatWait(now + 30000, now), 'à l’approche');
  assert.equal(formatWait(now + 7 * 60000 + 5000, now), '7 min');
  assert.equal(formatWait(now + 95 * 60000, now), '08:35');
  assert.equal(formatDelay(null), null);
  assert.equal(formatDelay(20), 'à l’heure');
  assert.equal(formatDelay(185), '+3 min');
  assert.equal(formatDelay(-120), '−2 min');
});

test('alertes : actives, sur l’arrêt ou les lignes affichées, sans doublon', () => {
  const now = at(2026, 11, 9, 7, 0);
  const s = now / 1000;
  const a = (o) => Object.assign({ periods: [], routes: [], stops: [], header: 'H', description: '' }, o);
  const alerts = [
    a({ header: 'Déviation ligne 11', routes: ['R11'] }),
    a({ header: 'Déviation ligne 11', routes: ['R11'] }),
    a({ header: 'Arrêt fermé', stops: ['GB2'], periods: [{ start: s - 60, end: s + 60 }] }),
    a({ header: 'Terminé', stops: ['GB2'], periods: [{ start: s - 120, end: s - 60 }] }),
    a({ header: 'Autre ligne', routes: ['R99'] }),
    a({ header: 'Ligne masquée', routes: ['RLI2'] }),
  ];
  assert.deepEqual(relevantAlerts(alerts, table, ['R11'], now).map((x) => x.header), ['Déviation ligne 11', 'Arrêt fermé']);
});

test('validité de la table', () => {
  assert.equal(tableExpired(table, at(2027, 2, 28, 23, 0)), false);
  assert.equal(tableExpired(table, at(2027, 3, 1, 0, 1)), true);
  assert.equal(tableExpired({}, Date.now()), true);
  assert.equal(daysLeft(table, at(2027, 2, 21, 12, 0)), 7);
});

test('panneau : tous les horaires jusqu’à demain soir, regroupés par jour', () => {
  const now = at(2026, 11, 9, 22, 0);
  assert.equal(endOfTomorrow(now), at(2026, 11, 11, 0, 0));
  assert.equal(formatClock(at(2026, 11, 9, 7, 5)), '07:05');
  const dep = (h, m, canceled) => ({ scheduled: at(2026, 11, 9, h, m), expected: at(2026, 11, 9, h, m) + (canceled ? 3 * H : 0), canceled });
  const groups = departuresByDay([dep(22, 30), dep(23, 50, true), dep(24, 10), dep(31, 0), dep(48, 5)], now);
  assert.deepEqual(groups.map((g) => g.label), ['Aujourd’hui', 'Demain', 'Mercredi 11 novembre']);
  assert.deepEqual(groups.map((g) => g.items.length), [2, 2, 1], 'un bus supprimé reste à son heure prévue');
});
