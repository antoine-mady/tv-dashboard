// Navigation à la télécommande dans un panneau liste (app/list-panel.js). Logique pure, testée.
//
// rows : [{ header: true } | { … }] — les titres de groupe (header) ne sont jamais sélectionnés.
// État : { zone: 'search' | 'list', index (ligne sélectionnée), tab }
// keyAction(state, key, ctx) → { state, action }
//   ctx = { rows, tabs (nombre d'onglets), search (bool : un champ de recherche existe) }
//   actions : null, 'tab' (onglet changé), 'edit' (ouvrir la saisie), 'activate' (OK sur une ligne), 'close'

export const PAGE = 6;

function selectable(row) { return !!row && !row.header; }

/** Première ligne sélectionnable, ou -1. */
export function firstSelectable(rows) {
  for (let i = 0; i < rows.length; i++) if (selectable(rows[i])) return i;
  return -1;
}

/** Dernière ligne sélectionnable, ou -1. */
export function lastSelectable(rows) {
  for (let i = rows.length - 1; i >= 0; i--) if (selectable(rows[i])) return i;
  return -1;
}

/** Avance de |delta| lignes sélectionnables dans le sens de delta, sans dépasser les bords. */
export function moveSelection(rows, index, delta) {
  if (firstSelectable(rows) < 0) return -1;
  let i = selectable(rows[index]) ? index : firstSelectable(rows);
  const dir = delta < 0 ? -1 : 1;
  let left = Math.abs(delta);
  for (let j = i + dir; left > 0 && j >= 0 && j < rows.length; j += dir) {
    if (selectable(rows[j])) { i = j; left--; }
  }
  return i;
}

/** Position « 3 / 12 » de la ligne sélectionnée parmi les lignes sélectionnables. */
export function position(rows, index) {
  let n = 0;
  let at = 0;
  rows.forEach((r, i) => {
    if (!selectable(r)) return;
    n++;
    if (i === index) at = n;
  });
  return { at, count: n };
}

export function keyAction(state, key, ctx) {
  const s = { zone: state.zone, index: state.index, tab: state.tab || 0 };
  const rows = ctx.rows || [];
  const tabs = ctx.tabs || 0;
  const hasRows = firstSelectable(rows) >= 0;
  const result = (action) => ({ state: s, action: action || null });

  if (key === 'back') return result('close');
  if (key === 'left' || key === 'right') {
    if (tabs < 2) return result();
    const next = Math.max(0, Math.min(tabs - 1, s.tab + (key === 'right' ? 1 : -1)));
    if (next === s.tab) return result();
    s.tab = next;
    return result('tab');
  }

  if (s.zone === 'search') {
    if (key === 'enter') return result('edit');
    if (key === 'down' && hasRows) { s.zone = 'list'; s.index = firstSelectable(rows); }
    return result();
  }

  // zone 'list'
  switch (key) {
    case 'up':
    case 'down': {
      if (!hasRows) {
        if (key === 'up' && ctx.search) s.zone = 'search';
        return result();
      }
      if (key === 'up' && ctx.search && s.index <= firstSelectable(rows)) { s.zone = 'search'; return result(); }
      s.index = moveSelection(rows, s.index, key === 'down' ? 1 : -1);
      return result();
    }
    case 'chup':
    case 'chdown':
      // CH▲ / CH▼ : une page vers le haut / le bas.
      if (hasRows) s.index = moveSelection(rows, s.index, key === 'chdown' ? PAGE : -PAGE);
      return result();
    case 'enter':
      if (!hasRows && ctx.search) return result('edit');
      return result(hasRows ? 'activate' : null);
    default:
      return result();
  }
}
