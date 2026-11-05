import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.TZ = 'Indian/Reunion';

const { cleanName, birthYear, upcoming, windowFor, parseFilter, whenLabel } = await import('./birthdays.js');
const { parseIcs, expandEvents } = await import('../agenda/ical.js');

const now = new Date(2026, 10, 5, 21, 0); // jeudi 5 novembre 2026, 21:00

test('nettoyage des titres', () => {
  assert.equal(cleanName('Anniversaire de Marie'), 'Marie');
  assert.equal(cleanName('🎂 Anniversaire d’Antoine (1985)'), 'Antoine');
  assert.equal(cleanName('Anniv : Paul'), 'Paul');
  assert.equal(cleanName('Anniv - Paul'), 'Paul');
  assert.equal(cleanName("Lucie's birthday"), 'Lucie');
  assert.equal(cleanName('Mamie née en 1948'), 'Mamie');
  assert.equal(cleanName('Tom - anniversaire'), 'Tom');
  assert.equal(cleanName('Léa'), 'Léa');
  assert.equal(cleanName('Anniversaire'), 'Anniversaire');
});

test('année de naissance', () => {
  assert.equal(birthYear('Marie (1990)', now), 1990);
  assert.equal(birthYear('Marie', now), null);
  assert.equal(birthYear('Fête 2030', now), null);
});

test('filtre par mots-clés', () => {
  assert.deepEqual(parseFilter(' anniv, Birthday ,'), ['anniv', 'birthday']);
  const occ = [
    { summary: 'Anniversaire de Marie', start: new Date(2026, 10, 8) },
    { summary: 'Dentiste', start: new Date(2026, 10, 9, 10) },
  ];
  assert.deepEqual(upcoming(occ, now, { filter: 'anniv' }).map((i) => i.name), ['Marie']);
  assert.equal(upcoming(occ, now, {}).length, 2);
});

test('libellés', () => {
  assert.equal(whenLabel(0, new Date(2026, 10, 5)), 'Aujourd’hui');
  assert.equal(whenLabel(1, new Date(2026, 10, 6)), 'Demain');
  assert.equal(whenLabel(2, new Date(2026, 10, 7)), 'Samedi');
  assert.equal(whenLabel(12, new Date(2026, 10, 17)), 'Dans 12 jours');
});

const ICS = [
  'BEGIN:VCALENDAR',
  'BEGIN:VEVENT', 'UID:a', 'SUMMARY:Anniversaire de Marie (1990)', 'DTSTART;VALUE=DATE:19901105',
  'DTEND;VALUE=DATE:19901106', 'RRULE:FREQ=YEARLY', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:b', 'SUMMARY:🎂 Paul', 'DTSTART;VALUE=DATE:20150103',
  'DTEND;VALUE=DATE:20150104', 'RRULE:FREQ=YEARLY', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:c', 'SUMMARY:Lucie', 'DTSTART;VALUE=DATE:20101104',
  'DTEND;VALUE=DATE:20101105', 'RRULE:FREQ=YEARLY', 'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

test('agenda iCal : tri, âge, passage d’année, doublons, passé ignoré', () => {
  const win = windowFor(now, 60);
  const events = parseIcs(ICS);
  // Le même agenda ajouté deux fois ne crée pas de doublon.
  const occ = expandEvents(events, win.from, win.to).concat(expandEvents(events, win.from, win.to));
  const items = upcoming(occ, now, { max: 10 });
  assert.deepEqual(items.map((i) => i.name), ['Marie', 'Paul']); // Lucie (hier) n'apparaît pas
  assert.equal(items[0].today, true);
  assert.equal(items[0].age, 36);
  assert.equal(items[1].days, 59);
  assert.equal(items[1].date, '3 janvier');
  assert.equal(items[1].age, null);
  assert.equal(upcoming(occ, now, { showAge: false })[0].age, null);
  assert.equal(upcoming(occ, now, { max: 1 }).length, 1);
});
