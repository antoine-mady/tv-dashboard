const BASE = 'https://site.api.espn.com/apis/site/v2/sports/';

function teamFrom(competitor) {
  const team = competitor && competitor.team ? competitor.team : {};
  return {
    id: team.id || (competitor && competitor.id) || '',
    name: team.displayName || team.name || competitor && competitor.displayName || 'Équipe à confirmer',
    code: team.abbreviation || team.shortDisplayName || '',
  };
}

function normalizeEvent(event, league) {
  const competition = event.competitions && event.competitions[0] ? event.competitions[0] : {};
  const competitors = competition.competitors || [];
  const home = competitors.find((item) => item.homeAway === 'home') || competitors[0] || {};
  const away = competitors.find((item) => item.homeAway === 'away') || competitors[1] || {};
  const status = event.status && event.status.type ? event.status.type : {};
  const startAt = Date.parse(event.date || competition.date || '');
  return {
    id: String(event.id),
    leagueId: league.id,
    leagueName: league.name,
    sportName: league.sportName,
    startAt,
    state: status.state === 'in' ? 'inProgress' : (status.completed ? 'completed' : 'upcoming'),
    teams: [teamFrom(home), teamFrom(away)],
    bestOf: null,
    name: event.name || '',
  };
}

export async function fetchEspnSchedule(fetchJson, league) {
  const url = BASE + league.espnSport + '/' + league.espnLeague + '/scoreboard?limit=100';
  const data = await fetchJson(url);
  return (data.events || []).map((event) => normalizeEvent(event, league))
    .filter((event) => Number.isFinite(event.startAt) && (event.state === 'inProgress' || (event.state !== 'completed' && event.startAt >= Date.now())))
    .sort((a, b) => a.startAt - b.startAt);
}
