// Animations de l'app TV (logique pure, testée). Le rendu est en CSS (styles.css, classes .anim-*).
// Seuls `transform` et `opacity` sont animés : c'est ce que le GPU d'une TV sait faire sans saccader.

/** Niveaux du réglage général `animations`. */
export const ANIM_MODES = ['full', 'reduced', 'none'];

/**
 * Durées (ms) selon le niveau : `enter` / `leave` = apparition / disparition d'un widget,
 * `stagger` = décalage entre deux widgets, `panel` = fermeture d'un panneau plein écran.
 * Doivent correspondre aux durées de styles.css.
 */
export function animTiming(mode) {
  if (mode === 'none') return { enter: 0, leave: 0, stagger: 0, panel: 0 };
  if (mode === 'reduced') return { enter: 300, leave: 200, stagger: 0, panel: 150 };
  return { enter: 550, leave: 320, stagger: 60, panel: 220 };
}

/** Niveau valide (les valeurs inconnues donnent « full »). */
export function animMode(value) {
  return ANIM_MODES.indexOf(value) !== -1 ? value : 'full';
}

/**
 * Délai d'apparition (ms) de chaque widget : en partant du haut à gauche, ligne par ligne.
 * `widgets` : [{ id, col, row }] ; retourne { [id]: délai }. Plafonné à `max` pour ne pas faire attendre.
 */
export function staggerDelays(widgets, step, max) {
  const limit = typeof max === 'number' ? max : 600;
  const sorted = widgets.slice().sort((a, b) => a.row - b.row || a.col - b.col);
  const out = {};
  sorted.forEach((w, i) => { out[w.id] = Math.min(limit, i * (step || 0)); });
  return out;
}

/** Classe d'animation d'entrée : au démarrage (`dir` = 0) ou en changeant de page (1 = suivante, -1 = précédente). */
export function enterClass(dir) {
  return dir > 0 ? 'cell-in-next' : dir < 0 ? 'cell-in-prev' : 'cell-in';
}

/** Classe d'animation de sortie quand on change de page. */
export function leaveClass(dir) {
  return dir < 0 ? 'cell-out-prev' : 'cell-out-next';
}
