// Navigation à la télécommande (logique pure, testée).
//
// Panneau bibliothèque — état : { zone: 'controls' | 'menu' | 'list', control, menu, item }
//   'controls' = rangée de boutons ⏮ ⏯ ⏭ en haut à gauche, 'menu' = onglets, 'list' = contenu.
// navigate(state, key, ctx) → { state, action } ; ctx = { menuLength, listLength, controlsLength }
// Actions : null, { type: 'tab' } (le menu a changé), { type: 'activate-menu' }, { type: 'activate-item' },
//           { type: 'control' } (bouton de lecture validé), { type: 'close' }

export const PAGE = 6;

function clamp(i, len) {
  return Math.max(0, Math.min(len - 1, i));
}

export function navigate(state, key, ctx) {
  const s = { zone: state.zone, control: state.control || 0, menu: state.menu, item: state.item };
  if (s.zone === 'controls') {
    switch (key) {
      case 'left':
      case 'right':
        s.control = clamp(s.control + (key === 'right' ? 1 : -1), ctx.controlsLength);
        return { state: s, action: null };
      case 'down':
        s.zone = 'menu';
        return { state: s, action: null };
      case 'enter':
        return { state: s, action: { type: 'control' } };
      case 'back':
        return { state: s, action: { type: 'close' } };
      default:
        return { state: s, action: null };
    }
  }
  if (s.zone === 'menu') {
    switch (key) {
      case 'up':
      case 'down': {
        if (key === 'up' && s.menu === 0 && ctx.controlsLength) {
          s.zone = 'controls';
          return { state: s, action: null };
        }
        const next = clamp(s.menu + (key === 'down' ? 1 : -1), ctx.menuLength);
        if (next === s.menu) return { state: s, action: null };
        s.menu = next;
        s.item = 0;
        return { state: s, action: { type: 'tab' } };
      }
      case 'right':
        if (ctx.listLength > 0) { s.zone = 'list'; s.item = clamp(s.item, ctx.listLength); }
        return { state: s, action: null };
      case 'enter':
        return { state: s, action: { type: 'activate-menu' } };
      case 'back':
        return { state: s, action: { type: 'close' } };
      default:
        return { state: s, action: null };
    }
  }
  // zone 'list'
  switch (key) {
    case 'up':
    case 'down':
      s.item = clamp(s.item + (key === 'down' ? 1 : -1), ctx.listLength);
      return { state: s, action: null };
    case 'next':
    case 'prev':
      // Avance / recul rapide d'une page avec ⏭ ⏮ quand la liste a le focus.
      s.item = clamp(s.item + (key === 'next' ? PAGE : -PAGE), ctx.listLength);
      return { state: s, action: null };
    case 'left':
    case 'back':
      s.zone = 'menu';
      return { state: s, action: null };
    case 'enter':
      return { state: s, action: ctx.listLength ? { type: 'activate-item' } : null };
    default:
      return { state: s, action: null };
  }
}

/**
 * Rangée de boutons du mini-lecteur : ◀ ▶ déplacent la sélection. Au bord, la touche n'est pas gérée
 * (handled: false) pour que l'app déplace le focus vers le widget voisin.
 */
export function stepControl(index, key, length) {
  if (key !== 'left' && key !== 'right') return { index, handled: false };
  const next = index + (key === 'right' ? 1 : -1);
  if (next < 0 || next >= length) return { index, handled: false };
  return { index: next, handled: true };
}
