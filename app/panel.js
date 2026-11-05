// Hôte des panneaux plein écran ouverts par les widgets (un seul à la fois).
import { h } from './dom.js';

export function createPanelHost(stageRoot) {
  let current = null; // { owner, el }

  function close(owner) {
    if (!current || (owner && current.owner !== owner)) return;
    if (current.el.parentNode) current.el.parentNode.removeChild(current.el);
    current = null;
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
