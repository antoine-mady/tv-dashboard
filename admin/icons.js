// Icônes de la page d'admin : SVG au trait, embarqués (pas de CDN), couleur = currentColor.
// HTML : <button data-icon="history">Historique</button> → l'icône est ajoutée devant le texte par applyIcons().
// JS : iconButton('copy', 'Dupliquer') ou icon('copy') (texte SVG).

const PATHS = {
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',
  history: '<path d="M3 12a9 9 0 1 0 2.6-6.4L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/>',
  sliders: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h11M19 18h1"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  send: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/><path d="M12 7v6"/><path d="m9 10 3 3 3-3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  layout: '<rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="5" rx="1.5"/><rect x="13" y="10" width="8" height="11" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/>',
  remote: '<rect x="7" y="2" width="10" height="20" rx="3"/><circle cx="12" cy="8" r="2"/><path d="M10 14h.01M14 14h.01M10 17.5h.01M14 17.5h.01"/>',
  dots: '<path d="M5 12h.01M12 12h.01M19 12h.01" stroke-width="3"/>',
  pencil: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M4 16V5a1 1 0 0 1 1-1h11"/>',
  left: '<path d="M19 12H5M12 19l-7-7 7-7"/>',
  right: '<path d="M5 12h14M12 5l7 7-7 7"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v5M14 11v5"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  bookmark: '<path d="M6 3h12v18l-6-4-6 4z"/>',
  download: '<path d="M12 4v11"/><path d="m7 10 5 5 5-5"/><path d="M5 20h14"/>',
  upload: '<path d="M12 15V4"/><path d="m7 9 5-5 5 5"/><path d="M5 20h14"/>',
  refresh: '<path d="M20 12a8 8 0 1 1-2.3-5.7L20 8"/><path d="M20 3v5h-5"/>',
  back: '<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 5 5v6"/>',
  chevronLeft: '<path d="m15 18-6-6 6-6"/>',
  restore: '<path d="M3 12a9 9 0 1 0 2.6-6.4L3 8"/><path d="M3 3v5h5"/>',
  close: '<path d="M18 6 6 18M6 6l12 12"/>',
  prev: '<path d="M6 5v14"/><path d="M18 6v12l-9-6z"/>',
  next: '<path d="M18 5v14"/><path d="M6 6v12l9-6z"/>',
  playpause: '<path d="M4 6v12l8-6z"/><path d="M16 6v12M20 6v12"/>',
};

/** Texte SVG de l'icône `name` (décorative : le texte ou aria-label du bouton la décrit). */
export function icon(name) {
  const p = PATHS[name];
  if (!p) return '';
  return '<svg class="i" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + p + '</svg>';
}

/** Ajoute l'icône de `data-icon` devant le contenu de chaque élément (une seule fois). */
export function applyIcons(root) {
  (root || document).querySelectorAll('[data-icon]').forEach((el) => {
    if (el.querySelector(':scope > svg.i')) return;
    el.insertAdjacentHTML('afterbegin', icon(el.dataset.icon));
  });
}

/** Contenu d'un bouton : icône + libellé (libellé échappé). */
export function iconLabel(name, label) {
  const span = document.createElement('span');
  span.textContent = label;
  return icon(name) + span.outerHTML;
}
