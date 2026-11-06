import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.TZ = 'Indian/Reunion';

const { cleanName, birthYear, upcoming, windowFor, parseFilter, whenLabel, parseBday, parseVcard, formatContacts,
  parseContacts, contactOccurrences } = await import('./birthdays.js');
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

test('dates de naissance vCard', () => {
  assert.deepEqual(parseBday('1990-05-12'), { year: 1990, month: 5, day: 12 });
  assert.deepEqual(parseBday('19900512'), { year: 1990, month: 5, day: 12 });
  assert.deepEqual(parseBday('--05-12'), { year: null, month: 5, day: 12 });
  assert.deepEqual(parseBday('--0512'), { year: null, month: 5, day: 12 });
  assert.deepEqual(parseBday('1604-05-12'), { year: null, month: 5, day: 12 });
  assert.deepEqual(parseBday('1985-01-03T00:00:00Z'), { year: 1985, month: 1, day: 3 });
  assert.equal(parseBday('1990-13-40'), null);
  assert.equal(parseBday(''), null);
});

const VCF = [
  'BEGIN:VCARD', 'VERSION:3.0', 'FN:Marie Dupont', 'N:Dupont;Marie;;;', 'BDAY:1990-11-05', 'END:VCARD',
  'BEGIN:VCARD', 'VERSION:3.0', 'N:Payet;Paul;;;', 'item1.BDAY;VALUE=date:--01-03', 'END:VCARD',
  'BEGIN:VCARD', 'VERSION:3.0', 'FN:Sans Date', 'TEL:0262', 'END:VCARD',
  'BEGIN:VCARD', 'VERSION:3.0', 'FN:Jean-Fran\\, çois', 'BDAY:2016-02-29', 'NOTE:une note', '  pliée', 'END:VCARD',
].join('\r\n');

test('import vCard → lignes « JJ/MM/AAAA Nom »', () => {
  const list = parseVcard(VCF);
  assert.deepEqual(list.map((c) => c.name), ['Marie Dupont', 'Paul Payet', 'Jean-Fran\\, çois'.replace('\\', '')]);
  const text = formatContacts(list);
  assert.equal(text, '03/01 Paul Payet\n29/02/2016 Jean-Fran, çois\n05/11/1990 Marie Dupont');
  assert.deepEqual(parseContacts(text).list, formatContacts(list) && parseContacts(text).list);
  assert.equal(parseContacts(text).list.length, 3);
});

test('saisie à la main : lignes invalides signalées, commentaires ignorés', () => {
  const r = parseContacts('# famille\n12/05/1990 Marie\n\n3/1 Paul\n31/02 Faux\nn’importe quoi');
  assert.deepEqual(r.list, [
    { name: 'Marie', day: 12, month: 5, year: 1990 },
    { name: 'Paul', day: 3, month: 1, year: null },
  ]);
  assert.equal(r.errors.length, 2);
});

test('anniversaires des contacts : âge, passage d’année, 29 février', () => {
  const { list } = parseContacts('05/11/1990 Marie Dupont\n03/01 Paul\n04/11/2010 Lucie\n29/02/2016 Léo');
  const win = windowFor(now, 120);
  const items = upcoming(contactOccurrences(list, win.from, win.to), now, { max: 10 });
  assert.deepEqual(items.map((i) => i.name), ['Marie Dupont', 'Paul', 'Léo']);
  assert.equal(items[0].today, true);
  assert.equal(items[0].age, 36);
  assert.equal(items[1].age, null);
  assert.equal(items[2].date, '28 février'); // 2027 n’est pas bissextile
  assert.equal(items[2].age, 11);
});
