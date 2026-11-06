import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildScheduleUrl,
  normalizeEvent,
  normalizeSchedule,
  sortUpcoming,
  fetchLeagueSchedule,
} from './api.js';

const league = { id: 'lec', name: 'LEC', region: 'Europe', leagueId: '98767991302996019' };
const event = (id, startAt, state) => ({
  id: 'event-' + id,
  startTime: new Date(startAt).toISOString(),
  state,
  match: {
    id,
    strategy: { count: 3 },
    teams: [
      { name: 'Team Alpha', code: 'ALP', result: { outcome: '', gameWins: 0 } },
      { name: 'Team Beta', code: 'BET', result: { outcome: '', gameWins: 0 } },
    ],
  },
});

test('buildScheduleUrl encodes league id and optional page token', () => {
  assert.equal(
    buildScheduleUrl(league),
    'https://esports-api.lolesports.com/persisted/gw/getSchedule?hl=fr-FR&leagueId=98767991302996019'
  );
  assert.match(buildScheduleUrl(league, 'a b'), /pageToken=a%20b$/);
});

test('normalizeEvent rejects malformed records and maps teams', () => {
  assert.equal(normalizeEvent(null, league), null);
  assert.equal(normalizeEvent({ match: { teams: [] } }, league), null);
  const normalized = normalizeEvent(event('42', 1000, 'unstarted'), league);
  assert.equal(normalized.id, '42');
  assert.equal(normalized.bestOf, 3);
  assert.equal(normalized.teams[0].code, 'ALP');
});

test('normalizeSchedule tolerates missing schedule and extracts pagination', () => {
  assert.deepEqual(normalizeSchedule({}, league), { events: [], newerPageToken: null });
  const result = normalizeSchedule({
    data: { schedule: { events: [event('42', 1000, 'unstarted')], pages: { newer: 'next' } } },
  }, league);
  assert.equal(result.events.length, 1);
  assert.equal(result.newerPageToken, 'next');
});

test('sortUpcoming keeps live and future games, drops completed and past games', () => {
  const now = 100000;
  const sorted = sortUpcoming([
    normalizeEvent(event('past', now - 1000, 'unstarted'), league),
    normalizeEvent(event('live', now - 5000, 'inProgress'), league),
    normalizeEvent(event('future', now + 10000, 'unstarted'), league),
    normalizeEvent(event('done', now + 20000, 'completed'), league),
  ], now);
  assert.deepEqual(sorted.map((item) => item.id), ['live', 'future']);
});

test('fetchLeagueSchedule sends API key, paginates and deduplicates', async () => {
  const calls = [];
  const now = 100000;
  const fetchJson = async (url, options) => {
    calls.push({ url, options });
    if (calls.length === 1) {
      return { data: { schedule: { events: [event('1', now + 1000, 'unstarted')], pages: { newer: 'next' } } } };
    }
    return { data: { schedule: { events: [event('1', now + 1000, 'unstarted'), event('2', now + 2000, 'unstarted')], pages: { newer: null } } } };
  };
  const result = await fetchLeagueSchedule(fetchJson, league, 'secret-key', now);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].options.headers['x-api-key'], 'secret-key');
  assert.match(calls[1].url, /pageToken=next$/);
  assert.deepEqual(result.map((item) => item.id), ['1', '2']);
});

test('fetchLeagueSchedule refuses an empty API key before network access', async () => {
  let called = false;
  await assert.rejects(
    fetchLeagueSchedule(async () => { called = true; }, league, '', 0),
    /Clé API/
  );
  assert.equal(called, false);
});
