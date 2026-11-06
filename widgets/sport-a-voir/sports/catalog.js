import lec from './league-of-legends/leagues/lec.js';
import worlds from './league-of-legends/leagues/worlds.js';

const espn = (id, name, sportName, espnSport, espnLeague) => ({
  id, name, sportName, sportId: sportName.toLowerCase(), provider: 'espn', espnSport, espnLeague,
});

export const LEAGUES = [
  Object.assign({}, lec, { sportName: 'Esport · League of Legends', provider: 'lol' }),
  Object.assign({}, worlds, { sportName: 'Esport · League of Legends', provider: 'lol' }),
  espn('premier-league', 'Premier League', 'Football', 'soccer', 'eng.1'),
  espn('ligue-1', 'Ligue 1', 'Football', 'soccer', 'fra.1'),
  espn('la-liga', 'La Liga', 'Football', 'soccer', 'esp.1'),
  espn('bundesliga', 'Bundesliga', 'Football', 'soccer', 'ger.1'),
  espn('serie-a', 'Serie A', 'Football', 'soccer', 'ita.1'),
  espn('champions-league', 'Ligue des champions', 'Football', 'soccer', 'uefa.champions'),
  espn('six-nations', 'Tournoi des Six Nations', 'Rugby', 'rugby', '180659'),
  espn('rugby-world-cup', 'Coupe du monde de rugby', 'Rugby', 'rugby', '164205'),
];

export function leagueById(id) {
  for (let i = 0; i < LEAGUES.length; i++) if (LEAGUES[i].id === id) return LEAGUES[i];
  return LEAGUES[0];
}
