// Navigation au focus avec les flèches de la télécommande (logique pure, testée).

function center(it) {
  return { x: it.col + it.w / 2, y: it.row + it.h / 2 };
}

function rangesOverlap(a1, a2, b1, b2) {
  return a1 < b2 && b1 < a2;
}

/**
 * items : [{ id, col, row, w, h }] — widgets focusables.
 * Retourne l'id du voisin le plus pertinent dans la direction `dir` (left|right|up|down), ou null.
 * Les widgets alignés (qui se recouvrent sur l'axe perpendiculaire) sont prioritaires.
 */
export function findNeighbor(items, currentId, dir) {
  const cur = items.find((i) => i.id === currentId);
  if (!cur) return items.length ? items[0].id : null;
  const c = center(cur);
  let best = null;
  let bestScore = Infinity;

  items.forEach((it) => {
    if (it.id === cur.id) return;
    const p = center(it);
    const dx = p.x - c.x;
    const dy = p.y - c.y;
    const horizontal = dir === 'left' || dir === 'right';
    const primary = dir === 'right' ? dx : dir === 'left' ? -dx : dir === 'down' ? dy : -dy;
    if (primary <= 0) return;
    const secondary = horizontal ? Math.abs(dy) : Math.abs(dx);
    const aligned = horizontal
      ? rangesOverlap(cur.row, cur.row + cur.h, it.row, it.row + it.h)
      : rangesOverlap(cur.col, cur.col + cur.w, it.col, it.col + it.w);
    const score = (aligned ? 0 : 1000) + primary + secondary * 2;
    if (score < bestScore) { bestScore = score; best = it.id; }
  });
  return best;
}

/** Premier widget focusable en partant du haut à gauche. */
export function firstItem(items) {
  const sorted = items.slice().sort((a, b) => a.row - b.row || a.col - b.col);
  return sorted.length ? sorted[0].id : null;
}
