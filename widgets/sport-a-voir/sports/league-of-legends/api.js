// Adaptateur CitoAPI pour les calendriers LoL.
const API_BASE = 'https://api.citoapi.com/api/v1/lol';

export function buildScheduleUrl() {
  return API_BASE + '/schedule/upcoming';
}

export function buildLiveUrl() {
  return API_BASE + '/live';
}

function firstValue(object, keys) {
  for (let i = 0; i < keys.length; i++) {
    const value = object && object[keys[i]];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return null;
}

function matchRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];

  const data = payload.data;
  if (Array.isArray(data)) return data;
  const containers = [data, data && data.schedule, payload, payload.schedule];
  const keys = ['matches', 'events', 'results', 'rows'];
  for (let i = 0; i < containers.length; i++) {
    const container = containers[i];
    if (!container || typeof container !== 'object') continue;
    for (let j = 0; j < keys.length; j++) {
      if (Array.isArray(container[keys[j]])) return container[keys[j]];
    }
  }
  return [];
}

function teamRows(match) {
  if (Array.isArray(match.teams)) return match.teams;
  const first = firstValue(match, ['team1', 'team_1', 'teamA', 'team_a', 'blueTeam', 'blue_team']);
  const second = firstValue(match, ['team2', 'team_2', 'teamB', 'team_b', 'redTeam', 'red_team']);
  return first && second ? [first, second] : [];
}

function normalizeTeam(team) {
  if (!team || typeof team !== 'object') return { name: 'Équipe à confirmer', code: '', outcome: '', gameWins: null };
  const result = team.result && typeof team.result === 'object' ? team.result : {};
  const name = firstValue(team, ['name', 'teamName', 'team_name', 'displayName', 'display_name']);
  const code = firstValue(team, ['code', 'shortName', 'short_name', 'tag', 'acronym']);
  const outcome = firstValue(team, ['outcome', 'winner']) || result.outcome || '';
  const wins = firstValue(team, ['gameWins', 'game_wins', 'score']);
  return {
    name: name || 'Équipe à confirmer',
    code: code || '',
    outcome: String(outcome || ''),
    gameWins: typeof wins === 'number' ? wins : null,
  };
}

function normalizeState(value, fallback) {
  const state = String(value || fallback || 'unstarted').toLowerCase().replace(/[ _-]/g, '');
  if (state === 'live' || state === 'inprogress' || state === 'ingame') return 'inProgress';
  if (state === 'completed' || state === 'finished' || state === 'final') return 'completed';
  if (state === 'scheduled' || state === 'upcoming' || state === 'unstarted' || state === 'notstarted') return 'unstarted';
  return fallback || value || 'unstarted';
}

function leagueText(event) {
  const parts = [];
  const fields = ['league', 'leagueName', 'league_name', 'leagueSlug', 'league_slug', 'leagueId', 'league_id', 'tournament', 'tournamentName', 'tournament_name', 'competition', 'blockName', 'block_name'];
  const records = [event, event && event.match];
  records.forEach((record) => {
    fields.forEach((key) => {
      const value = record && record[key];
      if (typeof value === 'string' || typeof value === 'number') parts.push(String(value));
      else if (value && typeof value === 'object') {
        ['name', 'slug', 'id', 'title'].forEach((nested) => {
          if (value[nested] !== undefined && value[nested] !== null) parts.push(String(value[nested]));
        });
      }
    });
  });
  return parts.join(' ').toLowerCase();
}

function eventBelongsToLeague(event, league) {
  const text = leagueText(event);
  if (!text) return false;
  const terms = league.id === 'worlds'
    ? ['worlds', 'world championship', 'worlds championship']
    : ['lec', 'league of legends european championship', 'european championship'];
  return terms.some((term) => text.indexOf(term) !== -1);
}

export function normalizeEvent(event, league, defaultState) {
  if (!event || typeof event !== 'object') return null;
  const match = event.match && typeof event.match === 'object' ? event.match : event;
  const teams = teamRows(match);
  if (teams.length < 2) return null;

  const rawStart = firstValue(event, ['startAt', 'start_at', 'startTime', 'start_time', 'scheduledAt', 'scheduled_at', 'startsAt', 'date'])
    || firstValue(match, ['startAt', 'start_at', 'startTime', 'start_time', 'scheduledAt', 'scheduled_at', 'startsAt', 'date']);
  const startAt = typeof rawStart === 'number' ? rawStart : Date.parse(rawStart);
  if (!isFinite(startAt)) return null;

  const id = firstValue(match, ['id', 'matchId', 'match_id']) || firstValue(event, ['id', 'matchId', 'match_id']) || startAt;
  const format = match.format && typeof match.format === 'object' ? match.format : {};
  const bestOf = firstValue(match, ['bestOf', 'best_of', 'gamesToWin', 'games_to_win'])
    || firstValue(format, ['bestOf', 'best_of', 'count', 'gamesToWin', 'games_to_win']);
  const rawState = firstValue(event, ['state', 'status', 'matchState', 'match_state'])
    || firstValue(match, ['state', 'status', 'matchState', 'match_state']);

  return {
    id: String(id),
    leagueId: league.id,
    leagueName: league.name,
    sportName: league.sportName || 'Esport · League of Legends',
    region: league.region,
    startAt,
    state: normalizeState(rawState, defaultState),
    blockName: String(firstValue(event, ['blockName', 'block_name', 'tournamentName', 'tournament_name'])
      || firstValue(match, ['blockName', 'block_name', 'tournamentName', 'tournament_name']) || ''),
    bestOf: Number(bestOf) || 0,
    teams: teams.slice(0, 2).map(normalizeTeam),
  };
}

export function normalizeSchedule(payload, league, defaultState) {
  const events = matchRows(payload).filter((event) => eventBelongsToLeague(event, league))
    .map((event) => normalizeEvent(event, league, defaultState)).filter(Boolean);
  return { events };
}

export function sortUpcoming(events, now) {
  const current = now === undefined ? Date.now() : now;
  return events.filter((event) => {
    return event.state === 'inProgress' ||
      (event.state === 'unstarted' && event.startAt >= current);
  }).sort((a, b) => {
    if (a.state === 'inProgress' && b.state !== 'inProgress') return -1;
    if (b.state === 'inProgress' && a.state !== 'inProgress') return 1;
    return a.startAt - b.startAt;
  });
}

export async function fetchLeagueSchedule(fetchJson, league, apiKey, now) {
  if (!apiKey || !String(apiKey).trim()) {
    throw new Error('Clé API CitoAPI manquante : renseignez-la dans les réglages du widget.');
  }

  const headers = { 'x-api-key': String(apiKey).trim() };
  const endpoints = [
    { url: buildLiveUrl(), state: 'inProgress' },
    { url: buildScheduleUrl(), state: 'unstarted' },
  ];
  const events = [];
  const seen = {};
  let successes = 0;
  let lastError = null;

  for (let i = 0; i < endpoints.length; i++) {
    try {
      const payload = await fetchJson(endpoints[i].url, { headers });
      successes++;
      normalizeSchedule(payload, league, endpoints[i].state).events.forEach((event) => {
        if (!seen[event.id]) {
          seen[event.id] = true;
          events.push(event);
        }
      });
    } catch (error) {
      lastError = error;
    }
  }

  if (!successes && lastError) throw lastError;
  return sortUpcoming(events, now);
}

export function formatMatchDate(timestamp) {
  return new Date(timestamp).toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  });
}

export function formatMatchTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}
