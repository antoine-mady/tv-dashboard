// Mode veille : décide (logique pure) si le dashboard doit être en veille.
import { parseTime, isInRange } from './schedule.js';

/** La nuit, après un réveil par une touche, le dashboard se rendort au bout de ce délai. */
export const NIGHT_IDLE_MINUTES = 5;

/**
 * Délai d'inactivité (minutes) après lequel le dashboard se met en veille, 0 = jamais.
 * `global` : réglages généraux (idleMinutes, nightMode, nightStart, nightEnd) ; `minutesOfDay` : heure actuelle.
 */
export function idleLimit(global, minutesOfDay) {
  const idle = Math.max(0, Number(global.idleMinutes) || 0);
  const night = !!global.nightMode && isInRange(minutesOfDay, parseTime(global.nightStart), parseTime(global.nightEnd));
  if (!night) return idle;
  return idle > 0 ? Math.min(idle, NIGHT_IDLE_MINUTES) : NIGHT_IDLE_MINUTES;
}

/** true si le dashboard doit être en veille, `idleMs` = temps écoulé depuis la dernière touche. */
export function shouldSleep(global, minutesOfDay, idleMs) {
  const limit = idleLimit(global, minutesOfDay);
  return limit > 0 && idleMs >= limit * 60 * 1000;
}

/** true si la veille peut se déclencher (sinon inutile de surveiller l'inactivité). */
export function sleepEnabled(global) {
  return (Number(global.idleMinutes) || 0) > 0 || !!global.nightMode;
}
