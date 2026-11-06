import lec from './leagues/lec.js';
import worlds from './leagues/worlds.js';

export const LEAGUES = [lec, worlds];

export function leagueById(id) {
  for (let i = 0; i < LEAGUES.length; i++) {
    if (LEAGUES[i].id === id) return LEAGUES[i];
  }
  return LEAGUES[0];
}
