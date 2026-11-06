import lec from './league-of-legends/leagues/lec.js';
import worlds from './league-of-legends/leagues/worlds.js';

const espn = (id, name, sportName, espnSport, espnLeague) => ({
  id, name, sportName, sportId: sportName.toLowerCase(), provider: 'espn', espnSport, espnLeague,
});

const cito = (id, name, sportName, apiGame) => ({
  id, name, sportName: 'Esport · ' + sportName,
  sportId: ('Esport · ' + sportName).toLowerCase(),
  provider: 'cito', apiGame,
});

export const LEAGUES = [
  Object.assign({}, lec, { sportName: 'Esport · League of Legends', sportId: 'esport · league of legends', provider: 'cito', apiGame: 'lol' }),
  Object.assign({}, worlds, { sportName: 'Esport · League of Legends', sportId: 'esport · league of legends', provider: 'cito', apiGame: 'lol' }),
  cito('cs2', 'Circuit professionnel', 'Counter-Strike 2', 'cs2'),
  cito('dota2', 'Circuit professionnel', 'Dota 2', 'dota2'),
  cito('cod', 'Call of Duty League', 'Call of Duty', 'cod'),

  espn('premier-league', 'Premier League', 'Football', 'soccer', 'eng.1'),
  espn('ligue-1', 'Ligue 1', 'Football', 'soccer', 'fra.1'),
  espn('la-liga', 'La Liga', 'Football', 'soccer', 'esp.1'),
  espn('bundesliga', 'Bundesliga', 'Football', 'soccer', 'ger.1'),
  espn('serie-a', 'Serie A', 'Football', 'soccer', 'ita.1'),
  espn('champions-league', 'Ligue des champions', 'Football', 'soccer', 'uefa.champions'),
  espn('europa-league', 'Ligue Europa', 'Football', 'soccer', 'uefa.europa'),
  espn('mls', 'MLS', 'Football', 'soccer', 'usa.1'),

  espn('nba', 'NBA', 'Basketball', 'basketball', 'nba'),
  espn('wnba', 'WNBA', 'Basketball', 'basketball', 'wnba'),
  espn('ncaa-basketball', 'NCAA Basketball', 'Basketball', 'basketball', 'mens-college-basketball'),
  espn('nfl', 'NFL', 'Football américain', 'football', 'nfl'),
  espn('college-football', 'NCAA Football', 'Football américain', 'football', 'college-football'),
  espn('mlb', 'MLB', 'Baseball', 'baseball', 'mlb'),
  espn('nhl', 'NHL', 'Hockey sur glace', 'hockey', 'nhl'),
  espn('six-nations', 'Tournoi des Six Nations', 'Rugby', 'rugby', '180659'),
  espn('rugby-world-cup', 'Coupe du monde de rugby', 'Rugby', 'rugby', '164205'),
];

export function leagueById(id) {
  for (let i = 0; i < LEAGUES.length; i++) if (LEAGUES[i].id === id) return LEAGUES[i];
  return LEAGUES[0];
}
