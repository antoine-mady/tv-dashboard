// Adaptateur pour l'API LoL Esports (schedule persistant Riot).
const API_BASE = 'https://esports-api.lolesports.com/persisted/gw/getSchedule';

export function buildScheduleUrl(league, pageToken) {
  let url = API_BASE + '?hl=fr-FR&leagueId=' + encodeURIComponent(league.leagueId);
  if (pageToken) url += '&pageToken=' + encodeURIComponent(pageToken);
  return url;
}

export function normalizeEvent(event, league) {
  if (!event || !event.match || !Array.isArray(event.match.teams)) return null;
  if (event.match.teams.length < 2) return null;

  const startAt = Date.parse(event.startTime);
  if (!isFinite(startAt)) return null;

  const strategy = event.match.strategy || {};
  const teams = event.match.teams.slice(0, 2).map((team) => {
    const result = team.result || {};
    return {
      name: team.name || 'Équipe à confirmer',
      code: team.code || '',
      outcome: result.outcome || '',
      gameWins: typeof result.gameWins === 'number' ? result.gameWins : null,
    };
  });

  return {
    id: String(event.match.id || event.id || startAt),
    leagueId: league.id,
    leagueName: league.name,
    sportName: league.sportName || 'Esport · League of Legends',
    region: league.region,
    startAt,
    state: event.state || 'unstarted',
    blockName: event.blockName || '',
    bestOf: Number(strategy.count) || 0,
    teams,
  };
}

export function normalizeSchedule(payload, league) {
  const schedule = payload && payload.data && payload.data.schedule;
  const source = schedule && Array.isArray(schedule.events) ? schedule.events : [];
  const events = source.map((event) => normalizeEvent(event, league)).filter(Boolean);
  const pages = schedule && schedule.pages ? schedule.pages : {};
  return {
    events,
    newerPageToken: pages.newer || null,
  };
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
    throw new Error('Clé API LoL Esports manquante : renseignez-la dans les réglages du widget.');
  }

  let pageToken = null;
  let page = 0;
  const events = [];
  const seen = {};

  do {
    const payload = await fetchJson(buildScheduleUrl(league, pageToken), {
      headers: { 'x-api-key': String(apiKey).trim() },
    });
    const result = normalizeSchedule(payload, league);
    result.events.forEach((event) => {
      if (!seen[event.id]) {
        seen[event.id] = true;
        events.push(event);
      }
    });
    pageToken = result.newerPageToken;
    page++;
  } while (pageToken && page < 3 && sortUpcoming(events, now).length < 10);

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
