import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.TZ = 'Indian/Reunion'; // UTC+4, sans heure d'été : résultats indépendants de la machine

const { parseIcs, expandEvents, toDate, parseDuration, parseUrlList, parseLine, calendarName } = await import('./ical.js');

const ics = (...events) => ['BEGIN:VCALENDAR', 'VERSION:2.0',
  ...events.map((e) => 'BEGIN:VEVENT\r\n' + e.join('\r\n') + '\r\nEND:VEVENT'), 'END:VCALENDAR'].join('\r\n');
const between = (text, from, to) => expandEvents(parseIcs(text), new Date(from), new Date(to));
const starts = (occ) => occ.map((o) => o.start.toISOString());

test('URLs : une par ligne, webcal → https, commentaires ignorés', () => {
  assert.deepEqual(parseUrlList(' webcal://p01.icloud.com/x.ics \n\n# perso\nhttps://a/b.ics'),
    ['https://p01.icloud.com/x.ics', 'https://a/b.ics']);
});

test('lignes repliées, échappements, VALARM ignoré', () => {
  const [ev] = parseIcs(ics([
    'UID:1', 'SUMMARY:Réunion\\, parents\\nd’élèves', '  (salle 2)', 'LOCATION:École\; bât. A',
    'DTSTART:20261110T080000Z', 'DTEND:20261110T090000Z',
    'BEGIN:VALARM', 'SUMMARY:rappel', 'END:VALARM']));
  assert.equal(ev.summary, 'Réunion, parents\nd’élèves (salle 2)');
  assert.equal(ev.location, 'École; bât. A');
  assert.equal(parseLine('X;P="a:b":v').value, 'v');
});

test('dates : UTC, fuseau TZID (heure d’été), heure flottante, journée entière', () => {
  const [utc, paris, parisWinter, floating, allDay] = parseIcs(ics(
    ['DTSTART:20261110T080000Z'],
    ['DTSTART;TZID=Europe/Paris:20260715T140000'],
    ['DTSTART;TZID="Europe/Paris":20261215T140000'],
    ['DTSTART:20261110T080000'],
    ['DTSTART;VALUE=DATE:20261110']));
  assert.equal(toDate(utc.start).toISOString(), '2026-11-10T08:00:00.000Z');
  assert.equal(toDate(paris.start).toISOString(), '2026-07-15T12:00:00.000Z');
  assert.equal(toDate(parisWinter.start).toISOString(), '2026-12-15T13:00:00.000Z');
  assert.equal(toDate(floating.start).toISOString(), '2026-11-10T04:00:00.000Z'); // heure de la TV
  assert.equal(toDate(allDay.start).toISOString(), '2026-11-09T20:00:00.000Z');   // minuit local
});

test('fuseau inconnu (nom Windows d’Outlook) → heure locale', () => {
  const [ev] = parseIcs(ics(['DTSTART;TZID=Romance Standard Time:20261110T080000']));
  assert.equal(toDate(ev.start).toISOString(), '2026-11-10T04:00:00.000Z');
});

test('durées', () => {
  assert.equal(parseDuration('PT1H30M'), 5400000);
  assert.equal(parseDuration('P1W'), 7 * 86400000);
  assert.equal(parseDuration('P1DT2H'), 26 * 3600000);
});

test('fenêtre : passé et futur exclus, en cours inclus, annulé exclu', () => {
  const occ = between(ics(
    ['SUMMARY:passé', 'DTSTART:20261101T080000Z', 'DTEND:20261101T090000Z'],
    ['SUMMARY:en cours', 'DTSTART:20261105T080000Z', 'DTEND:20261105T120000Z'],
    ['SUMMARY:annulé', 'STATUS:CANCELLED', 'DTSTART:20261106T080000Z'],
    ['SUMMARY:plus tard', 'DTSTART:20261130T080000Z', 'DURATION:PT1H'],
    ['SUMMARY:demain', 'DTSTART:20261106T080000Z', 'DURATION:PT1H']),
  '2026-11-05T10:00:00Z', '2026-11-12T00:00:00Z');
  assert.deepEqual(occ.map((o) => o.summary), ['en cours', 'demain']);
});

test('récurrence hebdomadaire BYDAY + EXDATE + COUNT', () => {
  const occ = between(ics([
    'UID:sport', 'SUMMARY:Sport', 'DTSTART;TZID=Indian/Reunion:20261102T180000', 'DTEND;TZID=Indian/Reunion:20261102T190000',
    'RRULE:FREQ=WEEKLY;BYDAY=MO,TH;COUNT=5', 'EXDATE;TZID=Indian/Reunion:20261109T180000']),
  '2026-11-01T00:00:00Z', '2026-12-31T00:00:00Z');
  // lun 2, jeu 5, (lun 9 exclu mais compté), jeu 12, lun 16 → COUNT=5 atteint
  assert.deepEqual(starts(occ), ['2026-11-02T14:00:00.000Z', '2026-11-05T14:00:00.000Z',
    '2026-11-12T14:00:00.000Z', '2026-11-16T14:00:00.000Z']);
  assert.equal(occ[0].end - occ[0].start, 3600000);
});

test('anniversaire annuel commencé il y a longtemps (journée entière)', () => {
  const occ = between(ics(['SUMMARY:Anniv Léa', 'DTSTART;VALUE=DATE:19900312', 'DTEND;VALUE=DATE:19900313', 'RRULE:FREQ=YEARLY']),
    '2027-03-01T00:00:00Z', '2027-04-01T00:00:00Z');
  assert.equal(occ.length, 1);
  assert.equal(occ[0].start.getDate(), 12);
  assert.equal(occ[0].start.getFullYear(), 2027);
  assert.ok(occ[0].allDay);
});

test('mensuel : 2e mardi, dernier vendredi, UNTIL, INTERVAL', () => {
  const occ = between(ics(
    ['SUMMARY:Conseil', 'DTSTART:20260113T150000Z', 'RRULE:FREQ=MONTHLY;BYDAY=2TU'],
    ['SUMMARY:Apéro', 'DTSTART:20260130T150000Z', 'RRULE:FREQ=MONTHLY;BYDAY=-1FR;UNTIL=20261201T000000Z'],
    ['SUMMARY:Poubelles', 'DTSTART:20261101T050000Z', 'RRULE:FREQ=DAILY;INTERVAL=3']),
  '2026-11-01T00:00:00Z', '2026-12-31T00:00:00Z');
  const of = (name) => starts(occ.filter((o) => o.summary === name)).map((s) => s.slice(0, 10));
  assert.deepEqual(of('Conseil'), ['2026-11-10', '2026-12-08']);
  assert.deepEqual(of('Apéro'), ['2026-11-27']);
  assert.equal(of('Poubelles').length, 20);
  assert.equal(of('Poubelles')[1], '2026-11-04');
});

test('occurrence modifiée (RECURRENCE-ID) remplace l’originale', () => {
  const occ = between(ics(
    ['UID:r', 'SUMMARY:Cours', 'DTSTART:20261102T080000Z', 'DURATION:PT1H', 'RRULE:FREQ=WEEKLY'],
    ['UID:r', 'SUMMARY:Cours (déplacé)', 'RECURRENCE-ID:20261109T080000Z', 'DTSTART:20261110T080000Z', 'DURATION:PT1H']),
  '2026-11-01T00:00:00Z', '2026-11-17T00:00:00Z');
  assert.deepEqual(occ.map((o) => o.summary + ' ' + o.start.toISOString().slice(0, 10)),
    ['Cours 2026-11-02', 'Cours (déplacé) 2026-11-10', 'Cours 2026-11-16']);
});

test('31 du mois et 29 février : mois sans ce jour ignorés', () => {
  const occ = between(ics(['SUMMARY:x', 'DTSTART;VALUE=DATE:20260131', 'RRULE:FREQ=MONTHLY;COUNT=4']),
    '2026-01-01T00:00:00Z', '2027-01-01T00:00:00Z');
  assert.deepEqual(occ.map((o) => o.start.getMonth() + 1), [1, 3, 5, 7]);
});

test('nom de l’agenda (X-WR-CALNAME) et description des événements', () => {
  const text = 'BEGIN:VCALENDAR\r\nX-WR-CALNAME:Famille\\, amis\r\n' + ics(['UID:1', 'SUMMARY:A', 'DESCRIPTION:Ligne 1\\nLigne 2',
    'DTSTART:20261110T080000Z']).replace('BEGIN:VCALENDAR\r\n', '');
  assert.equal(calendarName(text), 'Famille, amis');
  assert.equal(calendarName(ics(['UID:1'])), '');
  const occ = between(text, '2026-11-01T00:00:00Z', '2026-12-01T00:00:00Z');
  assert.equal(occ[0].description, 'Ligne 1\nLigne 2');
});
