// Navigation à la télécommande dans le panneau musique (logique pure, testée).
// État : { zone: 'menu' | 'list', menu: index du menu, item: index dans la liste }
// navigate(state, key, ctx) → { state, action } ; ctx = { menuLength, listLength }
// Actions : null, { type: 'tab' } (le menu a changé), { type: 'activate-menu' }, { type: 'activate-item' }, { type: 'close' }

export const PAGE = 6;

function clamp(i, len) {
  return Math.max(0, Math.min(len - 1, i));
}

export function navigate(state, key, ctx) {
  const s = { zone: state.zone, menu: state.menu, item: state.item };
  if (s.zone === 'menu') {
    switch (key) {
      case 'up':
      case 'down': {
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
