import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { idleLimit, shouldSleep, sleepEnabled, NIGHT_IDLE_MINUTES } from './sleep.js';
import Widget from './Widget.js';

const MIN = 60 * 1000;
const at = (hh, mm) => hh * 60 + mm;

test('veille après N minutes sans touche (0 = jamais)', () => {
  const g = { idleMinutes: 30, nightMode: false };
  assert.equal(shouldSleep(g, at(14, 0), 29 * MIN), false);
  assert.equal(shouldSleep(g, at(14, 0), 30 * MIN), true);
  assert.equal(shouldSleep({ idleMinutes: 0 }, at(14, 0), 999 * MIN), false);
  assert.equal(sleepEnabled({ idleMinutes: 0, nightMode: false }), false);
  assert.equal(sleepEnabled({ idleMinutes: 10 }), true);
  assert.equal(sleepEnabled({ idleMinutes: 0, nightMode: true }), true);
});

test('la nuit : veille dès 5 min sans touche, en passant minuit', () => {
  const g = { idleMinutes: 0, nightMode: true, nightStart: '23:00', nightEnd: '07:00' };
  assert.equal(idleLimit(g, at(22, 59)), 0);
  assert.equal(idleLimit(g, at(23, 0)), NIGHT_IDLE_MINUTES);
  assert.equal(idleLimit(g, at(3, 0)), NIGHT_IDLE_MINUTES);
  assert.equal(idleLimit(g, at(7, 0)), 0);
  assert.equal(shouldSleep(g, at(23, 30), 4 * MIN), false); // réveillé il y a 4 min
  assert.equal(shouldSleep(g, at(23, 30), 5 * MIN), true);
  // Un délai de jour plus court que 5 min reste valable la nuit.
  assert.equal(idleLimit(Object.assign({}, g, { idleMinutes: 2 }), at(1, 0)), 2);
  assert.equal(idleLimit(Object.assign({}, g, { idleMinutes: 60 }), at(1, 0)), NIGHT_IDLE_MINUTES);
});

function makeWidget() {
  const w = new Widget();
  w._init({ id: 'w1', cell: {}, el: {}, size: {}, manifest: {}, settings: {}, platform: {}, panels: {} });
  return w;
}

test('Widget : timers suspendus en veille, rattrapés au réveil', () => {
  mock.timers.enable({ apis: ['setInterval', 'setTimeout', 'Date'] });
  try {
    const w = makeWidget();
    let net = 0;
    let clock = 0;
    const sleeps = [];
    w.onSleep = (a) => sleeps.push(a);
    w.every(10 * MIN, () => { net++; });
    w.every(1000, () => { clock++; }, { whileAsleep: true, immediate: false });
    assert.equal(net, 1); // exécution immédiate

    w._sleep();
    mock.timers.tick(25 * MIN);
    assert.equal(net, 1, 'aucun téléchargement en veille');
    assert.equal(clock, 25 * 60, 'l’horloge continue');

    w._wake();
    mock.timers.tick(0);
    assert.equal(net, 2, 'en retard : exécuté tout de suite au réveil');
    mock.timers.tick(10 * MIN);
    assert.equal(net, 3, 'puis au rythme normal');
    assert.deepEqual(sleeps, [true, false]);

    w._destroy();
    mock.timers.tick(30 * MIN);
    assert.equal(net, 3, 'arrêté par destroy');
  } finally {
    mock.timers.reset();
  }
});

test('Widget : au réveil, un timer pas encore en retard attend son tour', () => {
  mock.timers.enable({ apis: ['setInterval', 'setTimeout', 'Date'] });
  try {
    const w = makeWidget();
    let n = 0;
    w.every(10 * MIN, () => { n++; }, { immediate: false });
    mock.timers.tick(2 * MIN);
    w._sleep();
    mock.timers.tick(3 * MIN);
    w._wake(); // 5 min écoulées sur 10
    mock.timers.tick(4 * MIN);
    assert.equal(n, 0);
    mock.timers.tick(1 * MIN);
    assert.equal(n, 1);
    w._sleep();
    w._destroy(); // arrêt pendant la veille : rien ne repart
    mock.timers.tick(60 * MIN);
    assert.equal(n, 1);
  } finally {
    mock.timers.reset();
  }
});
