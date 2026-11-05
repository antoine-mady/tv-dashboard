import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PlayerBridge, originOf } from './bridge.js';

// Faux DOM minimal : un conteneur, une iframe dont contentWindow enregistre les postMessage.
function setup(url) {
  const sent = [];
  const contentWindow = { postMessage: (msg, origin) => sent.push({ msg, origin }) };
  const doc = {
    createElement: () => ({ setAttribute() {}, contentWindow, parentNode: null }),
  };
  const container = { ownerDocument: doc, appendChild(el) { el.parentNode = this; }, removeChild() {} };
  const listeners = [];
  const win = {
    location: { origin: 'null' },
    addEventListener: (t, fn) => listeners.push(fn),
    removeEventListener: (t, fn) => listeners.splice(listeners.indexOf(fn), 1),
  };
  const events = { ready: 0, states: [], errors: [] };
  const bridge = new PlayerBridge(container, url, {
    onReady: () => { events.ready++; },
    onStateChange: (e) => events.states.push(e.data),
    onError: (e) => events.errors.push(e.data),
  }, win);
  const fromPlayer = (data, source) => listeners.forEach((fn) => fn({ data, source: source || contentWindow }));
  return { bridge, sent, events, fromPlayer, listeners };
}

test('commandes envoyées à la page lecteur, vers son origine', () => {
  const { bridge, sent } = setup('https://antoine-mady.github.io/tv-dashboard/player/');
  bridge.loadPlaylist(['a', 'b'], 1);
  bridge.pauseVideo();
  bridge.setVolume(40);
  assert.deepEqual(sent.map((s) => s.msg), [
    { tvdash: 'cmd', cmd: 'load', ids: ['a', 'b'], index: 1 },
    { tvdash: 'cmd', cmd: 'pause' },
    { tvdash: 'cmd', cmd: 'volume', value: 40 },
  ]);
  assert.ok(sent.every((s) => s.origin === 'https://antoine-mady.github.io'));
});

test('événements de la page lecteur → état et callbacks', () => {
  const { bridge, events, fromPlayer } = setup('https://x.github.io/p/');
  fromPlayer({ tvdash: 'evt', type: 'ready' });
  fromPlayer({ tvdash: 'evt', type: 'status', state: 1, time: 12, duration: 200, index: 2, videoId: 'v9', title: 'T', author: 'A' });
  fromPlayer({ tvdash: 'evt', type: 'status', state: 1, time: 13, duration: 200, index: 2, videoId: 'v9', title: 'T', author: 'A' });
  fromPlayer({ tvdash: 'evt', type: 'error', code: 153 });
  assert.equal(events.ready, 1);
  assert.deepEqual(events.states, [1], 'un seul changement d’état signalé');
  assert.deepEqual(events.errors, [153]);
  assert.equal(bridge.getPlayerState(), 1);
  assert.equal(bridge.getCurrentTime(), 13);
  assert.equal(bridge.getPlaylistIndex(), 2);
  assert.deepEqual(bridge.getVideoData(), { video_id: 'v9', title: 'T', author: 'A' });
});

test('messages étrangers ignorés', () => {
  const { events, fromPlayer } = setup('https://x.github.io/p/');
  fromPlayer({ tvdash: 'evt', type: 'ready' }, { other: true });
  fromPlayer({ type: 'ready' });
  assert.equal(events.ready, 0);
});

test('destroy retire l’écouteur', () => {
  const { bridge, listeners } = setup('https://x.github.io/p/');
  bridge.destroy();
  assert.equal(listeners.length, 0);
});

test('originOf', () => {
  assert.equal(originOf('https://antoine-mady.github.io/tv-dashboard/player/'), 'https://antoine-mady.github.io');
  assert.equal(originOf('/player/', { location: { origin: 'http://localhost:5173' } }), 'http://localhost:5173');
  assert.equal(originOf('/player/', { location: { origin: 'null' } }), '*');
});
