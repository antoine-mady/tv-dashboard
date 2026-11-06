import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildLiveUrl,
  buildScheduleUrl,
  normalizeEvent,
  normalizeSchedule,
  sortUpcoming,
  fetchLeagueSchedule,
} from './api.js';

const league = { id: 'lec', name: 'LEC', region: 'Europe', citoLeagueIds: ['lec'] };
const event = (id, startAt, state) => ({
  id,
  startTime: new Date(startAt).toISOString(),
  state,
  league: { id: 'lec', name: 'LEC', slug: 'lec' },
  bestOf: 3,
  teams: [
    { name: 'Team Alpha', code: 'ALP', score: 0 },
    { name: 'Team Beta', code: 'BET', score: 0 },
  ],
});

test('builds documented CitoAPI live and upcoming URLs', () => {
  assert.equal(buildLiveUrl(), 'https://api.citoapi.com/api/v1/lol/live');
  assert.equal(buildScheduleUrl(), 'https://api.citoapi.com/api/v1/lol/schedule/upcoming');
});

test('normalizeEvent maps a Cito match and rejects malformed records', () => {
  assert.equal(normalizeEvent(null, league), null);
  assert.equal(normalizeEvent({ teams: [] }, league), null);
  const normalized = normalizeEvent(event('lol-match-42', 1000, 'scheduled'), league);
  assert.equal(normalized.id, 'lol-match-42');
  assert.equal(normalized.bestOf, 3);
  assert.equal(normalized.teams[0].code, 'ALP');
  assert.equal(normalized.state, 'unstarted');
});

test('normalizeSchedule reads the Cito response envelope and filters leagues', () => {
  const result = normalizeSchedule({
    success: true,
    data: { matches: [event('42', 1000, 'upcoming'), {
      ...event('other', 2000, 'upcoming'),
      league: { id: 'lck', name: 'LCK', slug: 'lck' },
    }] },
    meta: {},
  }, league);
  assert.deepEqual(result.events.map((item) => item.id), ['42']);
});

test('sortUpcoming keeps live and future games, drops completed and past games', () => {
  const now = 100000;
  const sorted = sortUpcoming([
    normalizeEvent(event('past', now - 1000, 'scheduled'), league),
    normalizeEvent(event('live', now - 5000, 'live'), league),
    normalizeEvent(event('future', now + 10000, 'upcoming'), league),
    normalizeEvent(event('done', now + 20000, 'completed'), league),
  ], now);
  assert.deepEqual(sorted.map((item) => item.id), ['live', 'future']);
});

test('fetchLeagueSchedule sends the Cito key and merges live and upcoming matches', async () => {
  const calls = [];
  const now = 100000;
  const fetchJson = async (url, options) => {
    calls.push({ url, options });
    if (url === buildLiveUrl()) {
      return { success: true, data: { matches: [event('live-1', now - 1000, 'inProgress')] } };
    }
    return { success: true, data: { matches: [event('live-1', now - 1000, 'upcoming'), event('future-2', now + 2000, 'upcoming')] } };
  };
  const result = await fetchLeagueSchedule(fetchJson, league, 'secret-key', now);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].options.headers['x-api-key'], 'secret-key');
  assert.deepEqual(result.map((item) => item.id), ['live-1', 'future-2']);
});

test('fetchLeagueSchedule keeps successful schedule data if live endpoint fails', async () => {
  const now = 100000;
  const result = await fetchLeagueSchedule(async (url) => {
    if (url === buildLiveUrl()) throw new Error('temporary live endpoint failure');
    return { success: true, data: { matches: [event('future', now + 1000, 'upcoming')] } };
  }, league, 'secret-key', now);
  assert.deepEqual(result.map((item) => item.id), ['future']);
});

test('fetchLeagueSchedule refuses an empty API key before network access', async () => {
  let called = false;
  await assert.rejects(
    fetchLeagueSchedule(async () => { called = true; }, league, '', 0),
    /Clé API CitoAPI/
  );
  assert.equal(called, false);
});
