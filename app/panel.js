// Hôte des panneaux plein écran ouverts par les widgets (un seul à la fois).
import { h } from './dom.js';

/** `opts.leaveMs` : durée de l'animation de fermeture (0 = retrait immédiat). */
export function createPanelHost(stageRoot, opts) {
  const leaveMs = (opts && opts.leaveMs) || 0;
  let current = null; // { owner, el }

  function close(owner) {
    if (!current || (owner && current.owner !== owner)) return;
    const el = current.el;
    current = null;
    const remove = () => { if (el.parentNode) el.parentNode.removeChild(el); };
    if (!leaveMs) return remove();
    el.className += ' panel-out';
    setTimeout(remove, leaveMs + 50);
  }

  return {
    /** Ouvre un panneau pour `owner` (un widget). Ferme le panneau d'un autre widget s'il y en a un. */
    open(owner) {
      if (current && current.owner !== owner) current.owner.closePanel();
      if (current) return current.el;
      const el = h('div', { className: 'panel-layer' });
      stageRoot.appendChild(el);
      current = { owner, el };
      return el;
    },
    close,
    /** Widget propriétaire du panneau ouvert, ou null. */
    owner() { return current ? current.owner : null; },
  };
}
