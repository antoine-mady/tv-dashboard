// Navigation au focus avec les flèches de la télécommande (logique pure, testée).

function center(it) {
  return { x: it.col + it.w / 2, y: it.row + it.h / 2 };
}

function intervalGap(a1, a2, b1, b2) {
  return Math.max(0, b1 - a2, a1 - b2);
}

/**
 * items : [{ id, col, row, w, h }] — widgets focusables.
 * Retourne l'id du voisin le plus proche dans la direction `dir`, ou null.
 * L'identifiant sert à retrouver le widget courant et à retourner le voisin ;
 * le choix lui-même dépend uniquement de la géométrie.
 */
export function findNeighbor(items, currentId, dir) {
  const cur = items.find((i) => i.id === currentId);
  if (!cur) return items.length ? firstItem(items) : null;
  const c = center(cur);
  let best = null;
  let bestScore = Infinity;
  let bestDistance = Infinity;

  items.forEach((it) => {
    if (it.id === cur.id) return;
    const p = center(it);
    const dx = p.x - c.x;
    const dy = p.y - c.y;
    const horizontal = dir === 'left' || dir === 'right';
    const primary = dir === 'right' ? dx : dir === 'left' ? -dx : dir === 'down' ? dy : -dy;
    if (primary <= 0) return;

    // Mesure l'écart entre les bords des widgets, pas entre leurs centres.
    // Un chevauchement sur l'axe perpendiculaire vaut 0 et reste prioritaire
    // naturellement, sans le saut arbitraire imposé par un gros bonus fixe.
    const primaryGap = dir === 'right'
      ? Math.max(0, it.col - (cur.col + cur.w))
      : dir === 'left'
        ? Math.max(0, cur.col - (it.col + it.w))
        : dir === 'down'
          ? Math.max(0, it.row - (cur.row + cur.h))
          : Math.max(0, cur.row - (it.row + it.h));
    const secondaryGap = horizontal
      ? intervalGap(cur.row, cur.row + cur.h, it.row, it.row + it.h)
      : intervalGap(cur.col, cur.col + cur.w, it.col, it.col + it.w);

    // Favorise l'alignement et la proximité dans la direction, tout en laissant
    // un voisin diagonal proche gagner face à un voisin aligné très éloigné.
    const score = primaryGap + secondaryGap * 2;
    const distance = Math.hypot(dx, dy);
    if (score < bestScore || (score === bestScore && distance < bestDistance)) {
      bestScore = score;
      bestDistance = distance;
      best = it.id;
    }
  });
  return best;
}

/** Premier widget focusable en partant du haut à gauche. */
export function firstItem(items) {
  const sorted = items.slice().sort((a, b) => a.row - b.row || a.col - b.col);
  return sorted.length ? sorted[0].id : null;
}
