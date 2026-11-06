// Navigation au focus avec les flèches de la télécommande (logique pure, testée).

function geometry(it) {
  const col = Number(it.col);
  const row = Number(it.row);
  const w = Number(it.w);
  const h = Number(it.h);
  return { left: col, top: row, right: col + w, bottom: row + h, x: col + w / 2, y: row + h / 2 };
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
  const a = geometry(cur);
  let best = null;
  let bestPrimary = Infinity;
  let bestSecondary = Infinity;

  items.forEach((it) => {
    if (it.id === cur.id) return;
    const b = geometry(it);
    let primaryGap;
    let secondaryDistance;
    if (dir === 'right') {
      primaryGap = b.left - a.right;
      secondaryDistance = Math.max(0, b.top - a.y, a.y - b.bottom);
    } else if (dir === 'left') {
      primaryGap = a.left - b.right;
      secondaryDistance = Math.max(0, b.top - a.y, a.y - b.bottom);
    } else if (dir === 'down') {
      primaryGap = b.top - a.bottom;
      secondaryDistance = Math.max(0, b.left - a.x, a.x - b.right);
    } else if (dir === 'up') {
      primaryGap = a.top - b.bottom;
      secondaryDistance = Math.max(0, b.left - a.x, a.x - b.right);
    } else {
      return;
    }

    // Le widget doit être entièrement dans le sens demandé. Un simple décalage
    // des centres ne suffit pas : de grands widgets peuvent se chevaucher sur cet axe.
    if (primaryGap < 0) return;

    // La distance dans le sens de la flèche prime sur l'écart latéral. Ainsi,
    // un widget juste au-dessus gagne face à un autre plus éloigné mais mieux aligné.
    if (primaryGap < bestPrimary ||
        (primaryGap === bestPrimary && secondaryDistance < bestSecondary)) {
      bestPrimary = primaryGap;
      bestSecondary = secondaryDistance;
      best = it.id;
    }
  });
  return best;
}

/** Premier widget focusable en partant du haut à gauche. */
export function firstItem(items) {
  const sorted = items.slice().sort((a, b) => Number(a.row) - Number(b.row) || Number(a.col) - Number(b.col));
  return sorted.length ? sorted[0].id : null;
}
