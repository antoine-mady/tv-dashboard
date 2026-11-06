import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  deviceCodeRequest, devicePollRequest, refreshRequest, parseDeviceCode, tokenFromResponse,
  myPlaylistsUrl, searchUrl, likedUrl, playlistItemsUrl,
  mapPlaylists, mapPlaylistItems, mapVideos, mapSearch, cleanArtist, apiErrorMessage, webSignInUrl,
} from './google.js';

test('requêtes OAuth (device flow + refresh)', () => {
  const d = deviceCodeRequest('cid');
  assert.equal(d.url, 'https://oauth2.googleapis.com/device/code');
  assert.equal(d.opts.method, 'POST');
  assert.equal(d.opts.body, 'client_id=cid&scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fyoutube.readonly');
  assert.match(devicePollRequest('cid', 's', 'DEV').opts.body, /grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Adevice_code/);
  assert.match(refreshRequest('cid', 's', 'R/1').opts.body, /refresh_token=R%2F1&grant_type=refresh_token/);
});

test('réponses OAuth', () => {
  const dev = parseDeviceCode({ device_code: 'D', user_code: 'ABC-DEF', verification_url: 'https://www.google.com/device', expires_in: 1800, interval: 5 }, 1000);
  assert.deepEqual(dev, { deviceCode: 'D', userCode: 'ABC-DEF', verificationUrl: 'https://www.google.com/device', interval: 5000, expiresAt: 1801000 });
  const t1 = tokenFromResponse({ access_token: 'A', refresh_token: 'R', expires_in: 3600 }, 0);
  assert.deepEqual(t1, { accessToken: 'A', refreshToken: 'R', expiresAt: 3600000 });
  const t2 = tokenFromResponse({ access_token: 'A2', expires_in: 3600 }, 10, t1);
  assert.equal(t2.refreshToken, 'R', 'le refresh_token est conservé');
});

test('URLs de l’API', () => {
  assert.equal(myPlaylistsUrl(), 'https://www.googleapis.com/youtube/v3/playlists?part=snippet%2CcontentDetails&mine=true&maxResults=50');
  assert.match(myPlaylistsUrl('TOK'), /pageToken=TOK/);
  assert.match(searchUrl('daft punk'), /type=video&videoCategoryId=10&q=daft%20punk&maxResults=25$/);
  assert.match(likedUrl(), /myRating=like/);
  assert.match(playlistItemsUrl('PL1'), /playlistId=PL1/);
});

const snip = (title, extra) => Object.assign({ title, thumbnails: { default: { url: 'd.jpg' }, medium: { url: 'm.jpg' } } }, extra);

test('conversion des réponses', () => {
  assert.deepEqual(mapPlaylists({ items: [{ id: 'PL1', snippet: snip('Chill'), contentDetails: { itemCount: 12 } }] }),
    [{ id: 'PL1', title: 'Chill', count: 12, thumb: 'm.jpg' }]);

  const items = mapPlaylistItems({ items: [
    { snippet: snip('Get Lucky', { resourceId: { videoId: 'v1' }, videoOwnerChannelTitle: 'Daft Punk - Topic' }), status: { privacyStatus: 'public' } },
    { snippet: snip('Deleted video', { resourceId: { videoId: 'v2' } }) },
    { snippet: snip('Secret', { resourceId: { videoId: 'v3' } }), status: { privacyStatus: 'private' } },
  ] });
  assert.deepEqual(items, [{ id: 'v1', title: 'Get Lucky', artist: 'Daft Punk', thumb: 'm.jpg' }]);

  assert.deepEqual(mapVideos({ items: [{ id: 'v9', snippet: snip('X', { channelTitle: 'Artist' }) }] }),
    [{ id: 'v9', title: 'X', artist: 'Artist', thumb: 'm.jpg' }]);
  assert.deepEqual(mapSearch({ items: [{ id: { videoId: 's1' }, snippet: snip('Y', { channelTitle: 'Z' }) }, { id: { channelId: 'c' }, snippet: snip('C') }] }),
    [{ id: 's1', title: 'Y', artist: 'Z', thumb: 'm.jpg' }]);
  assert.equal(cleanArtist('Stromae - Topic'), 'Stromae');
});

test('messages d’erreur API', () => {
  assert.match(apiErrorMessage(403, { error: { errors: [{ reason: 'quotaExceeded' }] } }), /Quota/);
  assert.match(apiErrorMessage(403, { error: { errors: [{ reason: 'accessNotConfigured' }] } }), /non activée/);
  assert.match(apiErrorMessage(500, { error: { message: 'Boom' } }), /Boom/);
});

test('connexion web Google : retour sur youtube.com pour y ouvrir la session', () => {
  const u = new URL(webSignInUrl());
  assert.equal(u.origin, 'https://accounts.google.com');
  assert.equal(u.searchParams.get('service'), 'youtube');
  const back = new URL(u.searchParams.get('continue'));
  assert.equal(back.origin, 'https://www.youtube.com');
  assert.equal(back.pathname, '/signin');
  assert.equal(back.searchParams.get('action_handle_signin'), 'true');
});
