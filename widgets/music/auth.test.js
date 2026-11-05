import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAuth, createLibrary } from './auth.js';
import { createStore } from '../../app/Widget.js';

function memoryStorage() {
  const m = {};
  return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: (k) => { delete m[k]; }, m };
}

/** Faux fetch : `routes` = liste de [prédicat(url, opts), réponse | fonction]. Enregistre les appels. */
function fakeFetch(routes) {
  const calls = [];
  const fn = async (url, opts) => {
    calls.push({ url, opts: opts || {} });
    for (const [match, reply] of routes) {
      if (match(url, opts || {})) {
        const r = typeof reply === 'function' ? reply(url, opts || {}) : reply;
        return { status: r.status || 200, ok: (r.status || 200) < 400, text: async () => JSON.stringify(r.body || {}) };
      }
    }
    throw new Error('route non simulée : ' + url);
  };
  fn.calls = calls;
  return fn;
}

const isToken = (u, o) => u.includes('/token') && o.body;
const grant = (type) => (u, o) => isToken(u, o) && o.body.includes('grant_type=' + type);

function setup(routes, initialToken, nowRef) {
  const storage = memoryStorage();
  const store = createStore('t:', storage);
  if (initialToken) store.set('token', initialToken);
  const fetch = fakeFetch(routes);
  const clock = nowRef || { t: 0 };
  const auth = createAuth({ fetch, store, clientId: 'cid', clientSecret: 'sec', now: () => clock.t });
  return { auth, fetch, store, storage, clock };
}

test('device flow : en attente, ralentir, puis connecté et jeton enregistré', async () => {
  let polls = 0;
  const { auth, store } = setup([
    [(u) => u.includes('/device/code'), { body: { device_code: 'D', user_code: 'ABCD-EFGH', verification_url: 'https://www.google.com/device', expires_in: 1800, interval: 5 } }],
    [grant('urn'), () => {
      polls++;
      if (polls === 1) return { status: 428, body: { error: 'authorization_pending' } };
      if (polls === 2) return { status: 403, body: { error: 'slow_down' } };
      return { body: { access_token: 'A', refresh_token: 'R', expires_in: 3600 } };
    }],
  ]);
  assert.equal(auth.isConnected(), false);
  const dev = await auth.startDeviceFlow();
  assert.equal(dev.userCode, 'ABCD-EFGH');
  assert.equal(await auth.poll(dev), 'pending');
  assert.equal(await auth.poll(dev), 'slow_down');
  assert.equal(await auth.poll(dev), 'connected');
  assert.equal(auth.isConnected(), true);
  assert.equal(store.get('token').refreshToken, 'R');
});

test('device flow : refus et expiration', async () => {
  const { auth } = setup([[grant('urn'), { status: 403, body: { error: 'access_denied' } }]]);
  await assert.rejects(auth.poll({ deviceCode: 'D', expiresAt: 10 }), /refusée/);
  const { auth: a2, clock } = setup([]);
  clock.t = 100;
  await assert.rejects(a2.poll({ deviceCode: 'D', expiresAt: 10 }), /expiré/);
});

test('API : jeton expiré → refresh avant l’appel', async () => {
  const { auth, fetch, store } = setup([
    [grant('refresh_token'), { body: { access_token: 'NEW', expires_in: 3600 } }],
    [(u) => u.includes('/youtube/v3/'), { body: { items: [] } }],
  ], { accessToken: 'OLD', refreshToken: 'R', expiresAt: 30 * 1000 });
  await auth.api('https://www.googleapis.com/youtube/v3/playlists?mine=true');
  const apiCall = fetch.calls.find((c) => c.url.includes('/youtube/v3/'));
  assert.equal(apiCall.opts.headers.Authorization, 'Bearer NEW');
  assert.equal(store.get('token').refreshToken, 'R');
});

test('API : 401 → refresh puis nouvel essai', async () => {
  let n = 0;
  const { auth, fetch } = setup([
    [grant('refresh_token'), { body: { access_token: 'NEW', expires_in: 3600 } }],
    [(u) => u.includes('/youtube/v3/'), () => (++n === 1 ? { status: 401, body: {} } : { body: { ok: 1 } })],
  ], { accessToken: 'A', refreshToken: 'R', expiresAt: 3600 * 1000 });
  assert.deepEqual(await auth.api('https://www.googleapis.com/youtube/v3/x'), { ok: 1 });
  assert.equal(fetch.calls.filter((c) => c.url.includes('/youtube/v3/')).length, 2);
});

test('API : refresh refusé (invalid_grant) → déconnexion', async () => {
  const { auth, store } = setup([
    [grant('refresh_token'), { status: 400, body: { error: 'invalid_grant' } }],
  ], { accessToken: 'A', refreshToken: 'R', expiresAt: 0 });
  await assert.rejects(auth.api('https://www.googleapis.com/youtube/v3/x'), (e) => e.authLost === true);
  assert.equal(auth.isConnected(), false);
  assert.equal(store.get('token', null), null);
});

test('API : quota épuisé → message clair', async () => {
  const { auth } = setup([
    [(u) => u.includes('/youtube/v3/'), { status: 403, body: { error: { errors: [{ reason: 'quotaExceeded' }] } } }],
  ], { accessToken: 'A', refreshToken: 'R', expiresAt: 3600 * 1000 });
  await assert.rejects(auth.api('https://www.googleapis.com/youtube/v3/search'), /Quota/);
});

test('bibliothèque : pagination et cache', async () => {
  const { auth, fetch, clock } = setup([
    [(u) => u.includes('/playlists?') && !u.includes('pageToken'), { body: { items: [{ id: 'P1', snippet: { title: 'A', thumbnails: {} } }], nextPageToken: 'n2' } }],
    [(u) => u.includes('/playlists?') && u.includes('pageToken=n2'), { body: { items: [{ id: 'P2', snippet: { title: 'B', thumbnails: {} } }] } }],
    [(u) => u.includes('/search?'), { body: { items: [{ id: { videoId: 'v' }, snippet: { title: 'T', channelTitle: 'C', thumbnails: {} } }] } }],
  ], { accessToken: 'A', refreshToken: 'R', expiresAt: 1e12 });
  const lib = createLibrary(auth, { now: () => clock.t });
  assert.deepEqual((await lib.playlists()).map((p) => p.id), ['P1', 'P2']);
  await lib.playlists();
  assert.equal(fetch.calls.length, 2, 'deuxième appel servi par le cache');
  await lib.search('Daft');
  await lib.search('daft');
  assert.equal(fetch.calls.length, 3, 'recherche mise en cache (insensible à la casse)');
  clock.t = 31 * 60 * 1000;
  await lib.playlists();
  assert.equal(fetch.calls.length, 5, 'cache expiré après 30 min');
});

test('store : JSON par widget, robuste si stockage indisponible', () => {
  const st = memoryStorage();
  const s = createStore('tvdash:w1:', st);
  s.set('a', { x: 1 });
  assert.deepEqual(s.get('a'), { x: 1 });
  assert.ok('tvdash:w1:a' in st.m);
  s.remove('a');
  assert.equal(s.get('a', 'def'), 'def');
  const broken = createStore('p:', { getItem() { throw new Error('nope'); }, setItem() { throw new Error('nope'); }, removeItem() {} });
  broken.set('a', 1);
  assert.equal(broken.get('a', 'fallback'), 'fallback');
});
