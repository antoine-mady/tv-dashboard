const BASE = 'https://site.api.espn.com/apis/site/v2/sports/';

function teamFrom(competitor) {
  const team = competitor && competitor.team ? competitor.team : {};
  return {
    id: team.id || (competitor && competitor.id) || '',
    name: team.displayName || team.name || competitor && competitor.displayName || 'Équipe à confirmer',
    code: team.abbreviation || team.shortDisplayName || '',
  };
}

function normalizeEvent(event) {
  const competition = event.competitions && event.competitions[0] ? event.competitions[0] : {};
  const competitors = competition.competitors || [];
  const home = competitors.find((item) => item.homeAway === 'home') || competitors[0] || {};
  const away = competitors.find((item) => item.homeAway === 'away') || competitors[1] || {};
  const status = event.status && event.status.type ? event.status.type : {};
  return {
    id: String(event.id),
    startAt: event.date || competition.date || '',
    state: status.state === 'in' ? 'inProgress' : (status.completed ? 'completed' : 'upcoming'),
    teams: [teamFrom(home), teamFrom(away)],
    bestOf: null,
    name: event.name || '',
  };
}

export async function fetchEspnSchedule(fetchJson, league) {
  const url = BASE + league.espnSport + '/' + league.espnLeague + '/scoreboard?limit=100';
  const data = await fetchJson(url);
  return (data.events || []).map(normalizeEvent)
    .filter((event) => event.startAt && event.state !== 'completed')
    .sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt));
}
