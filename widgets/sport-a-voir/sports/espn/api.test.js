import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchEspnSchedule } from './api.js';

test('fetchEspnSchedule builds the ESPN scoreboard URL and normalizes fixtures', async () => {
  let requested = '';
  const result = await fetchEspnSchedule(async (url) => {
    requested = url;
    return {
      events: [{
        id: '123',
        date: '2030-06-01T15:00:00Z',
        status: { type: { state: 'pre', completed: false } },
        competitions: [{
          competitors: [
            { homeAway: 'home', team: { id: '1', displayName: 'Club A', abbreviation: 'A' } },
            { homeAway: 'away', team: { id: '2', displayName: 'Club B', abbreviation: 'B' } },
          ],
        }],
      }],
    };
  }, { espnSport: 'soccer', espnLeague: 'eng.1' });

  assert.equal(requested, 'https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard?limit=100');
  assert.equal(result.length, 1);
  assert.equal(result[0].id, '123');
  assert.equal(result[0].teams[0].name, 'Club A');
  assert.equal(result[0].teams[1].code, 'B');
  assert.equal(result[0].state, 'upcoming');
});

test('fetchEspnSchedule maps live fixtures and safely handles an empty response', async () => {
  const live = await fetchEspnSchedule(async () => ({
    events: [{
      id: 'live-1',
      date: '2030-06-01T15:00:00Z',
      status: { type: { state: 'in', completed: false } },
      competitions: [{ competitors: [] }],
    }],
  }), { espnSport: 'rugby', espnLeague: '180659' });
  assert.equal(live[0].state, 'inProgress');
  assert.deepEqual(await fetchEspnSchedule(async () => ({}), { espnSport: 'rugby', espnLeague: '164205' }), []);
});
