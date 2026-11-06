// Panneau plein écran « liste » réutilisable par les widgets (agenda, anniversaires, bus, météo…).
// Le widget fournit les lignes ; le panneau gère l'affichage, le défilement, les onglets (◀ ▶),
// la recherche (champ texte + clavier TV ou dictée) et le volet de détail de la ligne sélectionnée.
//
//   this.list = new ListPanel(this, {
//     className: 'w-agenda-panel',            // classe ajoutée au panneau, pour le styler
//     title: 'Agenda',
//     tabs: [{ id: 'all', label: 'Tous' }],    // facultatif : ◀ ▶ pour en changer
//     search: { placeholder: 'Nom…' },         // facultatif : champ de recherche en haut
//     detail: true,                            // facultatif : volet de droite (row.detail())
//     rows: ({ tab, tabIndex, query }) => [{ header: 'Aujourd’hui' }, { key, el, detail: () => el }],
//     empty: 'Rien à afficher',                // texte (ou fonction(ctx)) quand il n'y a aucune ligne
//     onActivate: (row) => {},                 // facultatif : OK sur une ligne
//   });
//   onKey(key) { if (this.list) return this.list.onKey(key); … }
//   onPanelClose() { this.list = null; }
//   this.list.refresh()  → recalcule les lignes (nouvelles données), la sélection est conservée (row.key).
//   this.list.setStatus('Chargement…'), this.list.showTab(index, key), this.list.setTitle(texte).
import { h } from './dom.js';
import { keyAction, firstSelectable, position } from './list-nav.js';

const MEDIA = ['playpause', 'play', 'pause', 'stop', 'next', 'prev'];

/** Petit badge « OK : tout voir » affiché seulement quand le widget a le focus (à ajouter dans `el`). */
export function focusHint(text) {
  return h('div', { className: 'lp-hint', text: text || 'OK : tout voir' });
}

export class ListPanel {
  constructor(widget, opts) {
    this.w = widget;
    this.o = opts;
    this.tabs = opts.tabs || [];
    this.state = { zone: 'list', index: -1, tab: opts.tab || 0 };
    this.rows = [];
    this.rowEls = [];
    this.status = '';
    this.error = '';

    const root = widget.openPanel();
    this.root = root;
    root.innerHTML = '';
    root.className = 'panel-layer lp-panel' + (opts.className ? ' ' + opts.className : '');
    this.titleEl = h('div', { className: 'lp-title', text: opts.title || '' });
    this.countEl = h('div', { className: 'lp-count' });
    this.tabsEl = h('div', { className: 'lp-tabs' });
    this.searchEl = opts.search
      ? h('input', { className: 'lp-search', type: 'text', placeholder: opts.search.placeholder || 'Rechercher…' })
      : null;
    this.statusEl = h('div', { className: 'lp-status' });
    this.listEl = h('div', { className: 'lp-list' });
    this.detailEl = opts.detail ? h('div', { className: 'lp-detail' }) : null;
    root.appendChild(h('div', { className: 'lp-layout' },
      h('div', { className: 'lp-head' }, this.titleEl, this.countEl),
      this.tabs.length > 1 ? this.tabsEl : null,
      this.searchEl ? h('div', { className: 'lp-search-wrap' }, this.searchEl) : null,
      h('div', { className: 'lp-body' },
        h('div', { className: 'lp-main' }, this.statusEl, this.listEl),
        this.detailEl),
      h('div', { className: 'lp-foot', text: this.hints() })));

    if (this.searchEl) {
      // Frappe au clavier de la TV ou dictée vocale (app/dictation.js émet « input ») : filtrage immédiat.
      this.searchEl.addEventListener('input', () => {
        this.state.index = -1;
        this.refresh();
      });
    }
    this.refresh();
  }

  hints() {
    const parts = ['▲▼ parcourir', 'CH▲▼ page'];
    if (this.tabs.length > 1) parts.push('◀▶ ' + (this.o.tabsHint || 'changer d’onglet'));
    if (this.searchEl) parts.push('▲ en haut : rechercher');
    parts.push('Retour : fermer');
    return parts.join('   ·   ');
  }

  context() {
    return {
      tab: this.tabs[this.state.tab],
      tabIndex: this.state.tab,
      query: this.searchEl ? this.searchEl.value.trim() : '',
    };
  }

  /** Message affiché au-dessus de la liste (« Chargement… », erreur). Vide = masqué. */
  setStatus(text) {
    this.status = text || '';
    this.renderStatus();
  }

  setTitle(text) { this.titleEl.textContent = text; }

  /** Affiche l'onglet `tabIndex` et sélectionne la ligne de clé `key` (ex. OK sur un jour → ses heures). */
  showTab(tabIndex, key) {
    this.state.tab = Math.max(0, Math.min(this.tabs.length - 1, tabIndex));
    this.state.zone = 'list';
    this.state.index = -1;
    this.pendingKey = key;
    this.refresh();
  }

  /** Recalcule les lignes (à appeler quand les données du widget changent). */
  refresh() {
    if (!this.w.panelOpen) return;
    const prev = this.rows[this.state.index];
    const prevKey = this.pendingKey !== undefined ? this.pendingKey : prev && prev.key;
    this.pendingKey = undefined;
    let rows;
    this.error = '';
    try {
      rows = this.o.rows(this.context()) || [];
    } catch (e) {
      console.error(e);
      rows = [];
      this.error = '⚠ ' + (e && e.message ? e.message : e);
    }
    this.rows = rows;
    let index = -1;
    if (prevKey !== undefined && prevKey !== null) {
      for (let i = 0; i < rows.length; i++) if (!rows[i].header && rows[i].key === prevKey) { index = i; break; }
    }
    if (index < 0) index = Math.min(this.state.index, rows.length - 1);
    if (index < 0 || !rows[index] || rows[index].header) index = firstSelectable(rows);
    this.state.index = index;
    this.renderTabs();
    this.renderList();
  }

  // ---- Rendu ----------------------------------------------------------------------
  renderTabs() {
    this.tabsEl.innerHTML = '';
    this.tabs.forEach((t, i) => {
      this.tabsEl.appendChild(h('div', { className: 'lp-tab' + (i === this.state.tab ? ' is-current' : ''), text: t.label }));
    });
  }

  renderStatus() {
    const empty = firstSelectable(this.rows) < 0;
    let text = this.error || this.status;
    if (!text && empty) {
      const e = this.o.empty;
      text = typeof e === 'function' ? e(this.context()) : (e || 'Rien à afficher');
    }
    this.statusEl.textContent = text;
    this.statusEl.style.display = text ? '' : 'none';
  }

  renderList() {
    this.listEl.innerHTML = '';
    this.rowEls = this.rows.map((r) => {
      const el = r.header
        ? h('div', { className: 'lp-group' + (r.className ? ' ' + r.className : ''), text: r.header })
        : h('div', { className: 'lp-row' + (r.className ? ' ' + r.className : '') }, r.el || h('div', { text: r.text || '' }));
      this.listEl.appendChild(el);
      return el;
    });
    this.listEl.scrollTop = 0;
    this.renderStatus();
    this.renderSelection();
  }

  renderSelection() {
    const listZone = this.state.zone === 'list';
    this.rowEls.forEach((el, i) => {
      if (this.rows[i].header) return;
      const sel = i === this.state.index;
      el.className = 'lp-row' + (this.rows[i].className ? ' ' + this.rows[i].className : '')
        + (sel ? ' is-current' : '') + (sel && listZone ? ' is-selected' : '');
    });
    if (this.searchEl) this.searchEl.className = 'lp-search' + (this.state.zone === 'search' ? ' is-selected' : '');
    const pos = position(this.rows, this.state.index);
    this.countEl.textContent = pos.count ? pos.at + ' / ' + pos.count : '';
    this.scrollToSelection();
    this.renderDetail();
  }

  scrollToSelection() {
    const list = this.listEl;
    const i = this.state.index;
    const el = this.rowEls[i];
    if (!el) return;
    if (i === firstSelectable(this.rows)) { list.scrollTop = 0; return; }
    // On garde visible le titre de groupe juste au-dessus et une ligne de marge en dessous.
    const above = i > 0 && this.rows[i - 1].header ? this.rowEls[i - 1] : el;
    const margin = el.offsetHeight;
    const top = above.offsetTop - (above === el ? margin : 0);
    const bottom = el.offsetTop + el.offsetHeight + margin;
    const view = list.clientHeight;
    if (top < list.scrollTop) list.scrollTop = Math.max(0, top);
    else if (bottom > list.scrollTop + view) list.scrollTop = bottom - view;
  }

  renderDetail() {
    if (!this.detailEl) return;
    this.detailEl.innerHTML = '';
    const row = this.rows[this.state.index];
    let content = null;
    try { content = row && row.detail ? row.detail() : null; } catch (e) { console.error(e); }
    if (content) this.detailEl.appendChild(content);
    this.detailEl.style.visibility = content ? '' : 'hidden';
  }

  // ---- Touches --------------------------------------------------------------------
  onKey(key) {
    // Touches média : laissées aux autres widgets (la musique continue de répondre).
    if (MEDIA.indexOf(key) !== -1) return false;
    const input = this.searchEl;
    if (input && document.activeElement === input) {
      // Pendant la saisie, la télécommande n'envoie que Entrée, Retour, haut et bas.
      input.blur();
      if ((key === 'enter' || key === 'down') && firstSelectable(this.rows) >= 0) {
        this.state.zone = 'list';
        this.state.index = firstSelectable(this.rows);
      } else {
        this.state.zone = 'search';
      }
      this.renderSelection();
      return true;
    }
    const r = keyAction(this.state, key, { rows: this.rows, tabs: this.tabs.length, search: !!input });
    this.state = r.state;
    switch (r.action) {
      case 'close': this.w.closePanel(); return true;
      case 'tab': this.state.index = -1; this.refresh(); return true;
      case 'edit':
        this.state.zone = 'search';
        this.renderSelection();
        if (input) input.focus();
        return true;
      case 'activate': {
        const row = this.rows[this.state.index];
        if (row && this.o.onActivate) this.o.onActivate(row);
        return true;
      }
      default:
        this.renderSelection();
        return true;
    }
  }
}
