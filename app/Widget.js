// Classe de base de tous les widgets. Un widget = une sous-classe dans widgets/<type>/tv.js.
import { proxify } from './platform.js';
import { h } from './dom.js';

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

  /** fetch avec timeout (15 s par défaut) et erreur si statut HTTP ≠ 2xx. */
  fetch(url, opts) {
    const o = opts || {};
    const timeout = o.timeout || 15000;
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('Délai dépassé (' + url.split('?')[0] + ')')), timeout);
      fetch(proxify(url), o).then((r) => {
        clearTimeout(t);
        if (!r.ok) reject(new Error('Erreur HTTP ' + r.status));
        else resolve(r);
      }, (e) => {
        clearTimeout(t);
        reject(new Error('Réseau indisponible (' + (e && e.message ? e.message : e) + ')'));
      });
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
    this._cleanups.forEach((fn) => { try { fn(); } catch (e) { /* ignore */ } });
    this._cleanups = [];
    try { this.destroy(); } catch (e) { /* ignore */ }
  }
}
