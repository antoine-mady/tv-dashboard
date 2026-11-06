import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.TZ = 'Indian/Reunion';

const { groupByDay, dayLabel, timeLabel, windowFor, rangeLabel, fullDate } = await import('./agenda.js');

const now = new Date(2026, 10, 5, 14, 0); // jeudi 5 novembre 2026, 14:00
const ev = (summary, start, end, allDay) => ({ summary, location: '', start, end, allDay: !!allDay });

test('libellés de jour', () => {
  assert.equal(dayLabel(new Date(2026, 10, 5), now), 'Aujourd’hui');
  assert.equal(dayLabel(new Date(2026, 10, 6), now), 'Demain');
  assert.equal(dayLabel(new Date(2026, 10, 9), now), 'Lundi 9 novembre');
});

test('libellés horaires', () => {
  const today = new Date(2026, 10, 5);
  assert.equal(timeLabel(ev('a', new Date(2026, 10, 5, 18, 30), new Date(2026, 10, 5, 19)), today, now), '18:30');
  assert.equal(timeLabel(ev('a', new Date(2026, 10, 5, 13), new Date(2026, 10, 5, 15)), today, now), 'En cours');
  assert.equal(timeLabel(ev('a', new Date(2026, 10, 5), new Date(2026, 10, 6), true), today, now), 'Journée');
  assert.equal(timeLabel(ev('a', new Date(2026, 10, 3), new Date(2026, 10, 8), true), today, now), '→ 7 nov');
});

test('regroupement par jour, événements commencés avant aujourd’hui ramenés à aujourd’hui, limite', () => {
  const groups = groupByDay([
    ev('vacances', new Date(2026, 10, 1), new Date(2026, 10, 10), true),
    ev('dentiste', new Date(2026, 10, 5, 16), new Date(2026, 10, 5, 17)),
    ev('marché', new Date(2026, 10, 7, 8), new Date(2026, 10, 7, 10)),
    ev('foot', new Date(2026, 10, 7, 15), new Date(2026, 10, 7, 17)),
  ], now, 3);
  assert.deepEqual(groups.map((g) => g.label), ['Aujourd’hui', 'Samedi 7 novembre']);
  assert.deepEqual(groups[0].items.map((i) => i.summary), ['vacances', 'dentiste']);
  assert.ok(groups[0].today);
  assert.deepEqual(groups[1].items.map((i) => i.time), ['08:00']);
});

test('fenêtre : jusqu’à la fin du dernier jour', () => {
  assert.deepEqual(windowFor(now, 2).to, new Date(2026, 10, 7));
});

test('horaire complet (panneau de détail)', () => {
  assert.equal(rangeLabel(ev('a', new Date(2026, 10, 5, 18, 30), new Date(2026, 10, 5, 19, 45))), '18:30 – 19:45');
  assert.equal(rangeLabel(ev('a', new Date(2026, 10, 5, 22), new Date(2026, 10, 6, 2))), '22:00 – 6 nov 02:00');
  assert.equal(rangeLabel(ev('a', new Date(2026, 10, 5), new Date(2026, 10, 6), true)), 'Toute la journée');
  assert.equal(rangeLabel(ev('a', new Date(2026, 10, 3), new Date(2026, 10, 8), true)), 'Du 3 nov au 7 nov');
  assert.equal(fullDate(new Date(2026, 10, 7)), 'Samedi 7 novembre 2026');
});

test('groupByDay garde les infos utiles au détail', () => {
  const [g] = groupByDay([Object.assign(ev('dentiste', new Date(2026, 10, 5, 16), new Date(2026, 10, 5, 17)), { description: 'Dr X' })], now, 5);
  assert.equal(g.items[0].description, 'Dr X');
  assert.equal(g.items[0].start.getHours(), 16);
});
