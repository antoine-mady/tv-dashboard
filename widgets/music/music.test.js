import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePlaylistId, formatDuration } from './playlist.js';

test('ID de playlist depuis un lien ou brut', () => {
  assert.equal(parsePlaylistId('https://music.youtube.com/playlist?list=PLabc_DEF-123&si=xyz'), 'PLabc_DEF-123');
  assert.equal(parsePlaylistId('https://www.youtube.com/watch?v=abc&list=RDCLAK5uy_k'), 'RDCLAK5uy_k');
  assert.equal(parsePlaylistId('  PLxyz  '), 'PLxyz');
  assert.equal(parsePlaylistId('https://example.com/nope'), '');
  assert.equal(parsePlaylistId(''), '');
});

test('format de durée', () => {
  assert.equal(formatDuration(0), '0:00');
  assert.equal(formatDuration(65.9), '1:05');
  assert.equal(formatDuration(600), '10:00');
});

test('lecture aléatoire : le titre choisi reste en premier', async () => {
  const { shuffleQueue } = await import('./playlist.js');
  const list = ['a', 'b', 'c', 'd', 'e'];
  const q = shuffleQueue(list, 2);
  assert.equal(q[0], 'c');
  assert.deepEqual(q.slice().sort(), list);
  assert.deepEqual(shuffleQueue(list, -1).sort(), list);
});
