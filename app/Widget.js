// Classe de base de tous les widgets. Un widget = une sous-classe dans widgets/<type>/tv.js.
import { proxify } from './platform.js';
import { h } from './dom.js';

/**
 * Petit stockage persistant sur la TV (localStorage), propre à chaque widget.
 * Ne lève jamais d'erreur : si le stockage est indisponible, get() renvoie la valeur par défaut.
 */
export function createStore(prefix, storage) {
  const s = () => {
    try { return storage || window.localStorage; } catch (e) { return null; }
  };
  return {
    get(key, fallback) {
      try {
        const raw = s().getItem(prefix + key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch (e) { return fallback; }
    },
    set(key, value) {
      try { s().setItem(prefix + key, JSON.stringify(value)); } catch (e) { /* stockage indisponible */ }
    },
    remove(key) {
      try { s().removeItem(prefix + key); } catch (e) { /* stockage indisponible */ }
    },
  };
}

export default class Widget {
  /** Appelé par l'app avant mount(). Ne pas surcharger. */
  _init(ctx) {
    this.id = ctx.id;            // id du widget dans la config
    this.cell = ctx.cell;        // cadre (géré par l'app)
    this.el = ctx.el;            // zone de rendu du widget : n'écrire QUE dedans
    this.manifest = ctx.manifest;
    this.settings = ctx.settings; // réglages complets (valeurs par défaut appliquées)
    this.size = ctx.size;        // { width, height } en px de this.el
    this.platform = ctx.platform; // { isTizen, isPreview, launchApp… }
    this._cleanups = [];
    this._errorEl = null;
    this._panels = ctx.panels;   // hôte des panneaux plein écran (géré par l'app)
    this._panel = null;
    this.store = createStore('tvdash:' + ctx.id + ':');
  }

  // ---- À surcharger ----------------------------------------------------------
  /** Construit le widget dans `el`. Peut être async. */
  mount(el, settings) {}
  /** Touche télécommande normalisée (left, enter, playpause…). Retourner true si gérée. */
  onKey(key) { return false; }
  /** Appelé quand le widget gagne / perd le focus. */
  onFocus(focused) {}
  /** Libère les ressources propres au widget (timers et listeners de this.every/after/listen sont déjà nettoyés). */
  destroy() {}
  /** Appelé quand le panneau plein écran du widget se ferme (Retour, ou closePanel()). */
  onPanelClose() {}

  // ---- Panneau plein écran ----------------------------------------------------
  /**
   * Ouvre un panneau plein écran (1920×1080) et renvoie l'élément à remplir.
   * Tant qu'il est ouvert, TOUTES les touches arrivent dans onKey() de ce widget ;
   * si onKey ne gère pas « back », l'app ferme le panneau.
   */
  openPanel() {
    if (!this._panel) this._panel = this._panels.open(this);
    return this._panel;
  }

  closePanel() {
    if (!this._panel) return;
    this._panels.close(this);
    this._panel = null;
    try { this.onPanelClose(); } catch (e) { console.error(e); }
  }

  get panelOpen() { return !!this._panel; }

  // ---- Utilitaires ------------------------------------------------------------
  /**
   * Exécute fn toutes les `ms` millisecondes. Si fn lève une erreur (ou renvoie une promesse rejetée),
   * le widget affiche un état d'erreur ; il est effacé au prochain succès.
   */
  every(ms, fn, opts) {
    const immediate = !opts || opts.immediate !== false;
    const run = () => {
      try {
        const r = fn();
        if (r && typeof r.then === 'function') {
          r.then(() => this.clearError(), (e) => this.showError(e && e.message ? e.message : String(e)));
        } else {
          this.clearError();
        }
      } catch (e) {
        this.showError(e && e.message ? e.message : String(e));
      }
    };
    if (immediate) run();
    const id = setInterval(run, ms);
    this._cleanups.push(() => clearInterval(id));
    return id;
  }

  after(ms, fn) {
    const id = setTimeout(fn, ms);
    this._cleanups.push(() => clearTimeout(id));
    return id;
  }

  /** addEventListener nettoyé automatiquement. */
  listen(target, type, fn, opts) {
    target.addEventListener(type, fn, opts);
    this._cleanups.push(() => target.removeEventListener(type, fn, opts));
  }

  /** fetch avec timeout (15 s par défaut) et proxy dans l'aperçu. Renvoie la réponse quel que soit le statut HTTP. */
  fetchRaw(url, opts) {
    const o = opts || {};
    const timeout = o.timeout || 15000;
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('Délai dépassé (' + url.split('?')[0] + ')')), timeout);
      fetch(proxify(url), o).then((r) => {
        clearTimeout(t);
        resolve(r);
      }, (e) => {
        clearTimeout(t);
        reject(new Error('Réseau indisponible (' + (e && e.message ? e.message : e) + ')'));
      });
    });
  }

  /** Comme fetchRaw, mais erreur si statut HTTP ≠ 2xx. */
  fetch(url, opts) {
    return this.fetchRaw(url, opts).then((r) => {
      if (!r.ok) throw new Error('Erreur HTTP ' + r.status);
      return r;
    });
  }

  fetchJson(url, opts) { return this.fetch(url, opts).then((r) => r.json()); }
  fetchText(url, opts) { return this.fetch(url, opts).then((r) => r.text()); }

  /** Affiche un message d'erreur par-dessus le widget (sans le détruire). */
  showError(message) {
    if (!this._errorEl) {
      this._errorEl = h('div', { className: 'cell-error' }, h('div', { className: 'cell-error-icon', text: '⚠' }), h('div', { className: 'cell-error-msg' }));
      this.cell.appendChild(this._errorEl);
    }
    this._errorEl.lastChild.textContent = message;
  }

  clearError() {
    if (this._errorEl) {
      this._errorEl.parentNode.removeChild(this._errorEl);
      this._errorEl = null;
    }
  }

  /** Appelé par l'app. Ne pas surcharger (surcharger destroy()). */
  _destroy() {
    this.closePanel();
    this._cleanups.forEach((fn) => { try { fn(); } catch (e) { /* ignore */ } });
    this._cleanups = [];
    try { this.destroy(); } catch (e) { /* ignore */ }
  }
}
