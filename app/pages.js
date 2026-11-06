// Navigation entre les pages du dashboard (logique pure, testée).

/** Index de la page suivante (dir = 1) ou précédente (dir = -1), en boucle. */
export function stepPage(count, index, dir) {
  if (count < 1) return 0;
  return ((index + dir) % count + count) % count;
}

/**
 * Page affichée au démarrage : celle demandée (aperçu de l'admin), sinon la dernière affichée
 * (si `remember`), sinon la première.
 */
export function initialPage(pages, opts) {
  const o = opts || {};
  const find = (id) => {
    for (let i = 0; i < pages.length; i++) if (id && pages[i].id === id) return i;
    return -1;
  };
  const requested = find(o.requested);
  if (requested !== -1) return requested;
  const saved = o.remember ? find(o.saved) : -1;
  return saved !== -1 ? saved : 0;
}

/**
 * Deux widgets de pages différentes sont « le même » (le widget reste affiché et continue de tourner,
 * ex. la musique ne se coupe pas) s'ils ont le même id, le même type, la même place et les mêmes réglages.
 */
export function sameWidget(a, b) {
  if (!a || !b || a.id !== b.id || a.type !== b.type) return false;
  if (a.col !== b.col || a.row !== b.row || a.w !== b.w || a.h !== b.h) return false;
  return JSON.stringify(a.settings || {}) === JSON.stringify(b.settings || {});
}
