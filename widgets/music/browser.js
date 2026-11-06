// Panneau plein écran « bibliothèque musicale » (ouvert avec OK sur le widget).
// Colonne gauche : titre en cours + boutons ⏮ ⏯ ⏭ (▲ depuis le premier onglet), puis les onglets.
// Droite : liste (playlists, titres, recherches). Tout à la télécommande, touches média facultatives.
import { h } from '../../app/dom.js';
import { navigate } from './list-nav.js';
import { ICONS } from './icons.js';

const VISIBLE_ROWS = 7; // lignes visibles dans la liste (défilement au-delà)

export class MusicBrowser {
  /**
   * widget : instance MusicWidget (library, playTracks, queueInfo, logout, toggle…)
   * root : élément du panneau (this.openPanel())
   */
  constructor(widget, root) {
    this.w = widget;
    this.root = root;
    this.state = { zone: 'menu', control: 1, menu: 0, item: 0 };
    this.items = [];
    this.status = '';
    this.searchResultsFor = null;
    this.quick = String(widget.settings.quickSearches || '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    this.tabs = [
      { id: 'playlists', label: 'Playlists' },
      { id: 'liked', label: 'J’aime' },
      { id: 'search', label: 'Rechercher' },
      { id: 'queue', label: 'En cours' },
      { id: 'logout', label: 'Déconnexion' },
    ];
    this.controls = ['prev', 'playpause', 'next'];
    this.loadToken = 0;

    root.classList.add('w-music-panel');
    this.nowCover = h('div', { className: 'mp-now-cover' });
    this.nowTitle = h('div', { className: 'mp-now-title ellipsis' });
    this.nowArtist = h('div', { className: 'mp-now-artist ellipsis' });
    this.controlsEl = h('div', { className: 'mp-controls' });
    this.menuEl = h('div', { className: 'mp-menu' });
    this.titleEl = h('div', { className: 'mp-title' });
    this.searchEl = h('input', { className: 'mp-search', type: 'text', placeholder: 'Titre, artiste, album…' });
    this.searchWrap = h('div', { className: 'mp-search-wrap' }, this.searchEl);
    this.listEl = h('div', { className: 'mp-list' });
    this.statusEl = h('div', { className: 'mp-status' });
    root.appendChild(h('div', { className: 'mp-layout' },
      h('div', { className: 'mp-side' },
        h('div', { className: 'mp-now' }, this.nowCover, h('div', { className: 'mp-now-text' }, this.nowTitle, this.nowArtist)),
        this.controlsEl,
        this.menuEl),
      h('div', { className: 'mp-main' }, this.titleEl, this.searchWrap, this.statusEl, this.listEl)));

    this.searchEl.addEventListener('keydown', (e) => {
      // Touche « Terminé » du clavier TV ou Entrée : lancer la recherche.
      if (e.keyCode === 13 || e.keyCode === 65376) {
        e.preventDefault();
        e.stopPropagation();
        this.runSearch(this.searchEl.value);
      }
    });

    this.renderMenu();
    this.openTab();
    this.renderNow();
  }

  tab() { return this.tabs[this.state.menu]; }

  // ---- Rendu -----------------------------------------------------------------------
  renderMenu() {
    this.menuEl.innerHTML = '';
    this.tabs.forEach((t, i) => {
      const cls = 'mp-tab' + (i === this.state.menu ? ' is-current' : '') + (i === this.state.menu && this.state.zone === 'menu' ? ' is-selected' : '');
      this.menuEl.appendChild(h('div', { className: cls, text: t.label }));
    });
  }

  renderList() {
    this.listEl.innerHTML = '';
    this.statusEl.textContent = this.status;
    this.statusEl.style.display = this.status ? '' : 'none';
    const sel = this.state.item;
    const first = Math.max(0, Math.min(sel - Math.floor(VISIBLE_ROWS / 2), this.items.length - VISIBLE_ROWS));
    const current = this.w.currentTrack();
    this.items.slice(first, first + VISIBLE_ROWS).forEach((it, k) => {
      const i = first + k;
      const selected = this.state.zone === 'list' && i === sel;
      const playing = it.kind === 'track' && current && current.id === it.id && this.tab().id === 'queue';
      this.listEl.appendChild(h('div', { className: 'mp-row' + (selected ? ' is-selected' : '') + (playing ? ' is-playing' : '') },
        it.thumb ? h('div', { className: 'mp-thumb', style: { backgroundImage: 'url("' + it.thumb + '")' } }) : h('div', { className: 'mp-thumb mp-thumb-icon', text: it.icon || '♪' }),
        h('div', { className: 'mp-row-text' },
          h('div', { className: 'mp-row-title ellipsis', text: it.title }),
          h('div', { className: 'mp-row-sub ellipsis', text: it.sub || '' })),
        playing ? h('div', { className: 'mp-row-badge', text: '▶' }) : null));
    });
    if (this.items.length > VISIBLE_ROWS) {
      this.listEl.appendChild(h('div', { className: 'mp-more', text: (sel + 1) + ' / ' + this.items.length }));
    }
  }

  /** Titre en cours + boutons de lecture (appelé aussi par le widget à chaque changement d'état). */
  renderNow() {
    const t = this.w.currentTrack();
    this.nowTitle.textContent = t ? t.title : 'Aucune lecture';
    this.nowArtist.textContent = t ? t.artist || '' : '';
    this.nowCover.style.backgroundImage = t ? 'url(https://i.ytimg.com/vi/' + t.id + '/mqdefault.jpg)' : '';
    this.controlsEl.innerHTML = '';
    this.controls.forEach((id, i) => {
      const icon = id === 'playpause' ? (this.w.isPlaying() ? 'pause' : 'play') : id;
      const selected = this.state.zone === 'controls' && i === this.state.control;
      const btn = h('div', { className: 'mp-btn' + (selected ? ' is-selected' : '') });
      btn.innerHTML = ICONS[icon];
      this.controlsEl.appendChild(btn);
    });
  }

  render() { this.renderMenu(); this.renderList(); this.renderNow(); }

  // ---- Chargement des onglets ------------------------------------------------------
  setItems(items, status) {
    this.items = items;
    this.status = status || (items.length ? '' : 'Rien à afficher');
    if (this.state.item >= items.length) this.state.item = 0;
    this.render();
  }

  load(title, promise, mapItems) {
    const token = ++this.loadToken;
    this.titleEl.textContent = title;
    this.items = [];
    this.status = 'Chargement…';
    this.render();
    promise.then((data) => {
      if (token !== this.loadToken) return;
      this.setItems(mapItems(data));
    }, (e) => {
      if (token !== this.loadToken) return;
      if (e && e.authLost) { this.w.onAuthLost(e); return; }
      this.setItems([], '⚠ ' + (e && e.message ? e.message : e));
    });
  }

  openTab() {
    const lib = this.w.library;
    const tab = this.tab();
    this.searchWrap.style.display = tab.id === 'search' ? '' : 'none';
    if (tab.id !== 'search') this.searchEl.blur();
    switch (tab.id) {
      case 'playlists':
        this.load('Mes playlists', lib.playlists(), (pls) => pls.map((p) => ({
          kind: 'playlist', id: p.id, title: p.title, thumb: p.thumb, data: p,
          sub: p.count != null ? p.count + ' titres' : '',
        })));
        break;
      case 'liked':
        this.load('J’aime', lib.liked(), (tracks) => this.trackItems(tracks, 'J’aime'));
        break;
      case 'search':
        // Avant toute recherche : les recherches rapides de l'admin, accessibles sans clavier.
        this.titleEl.textContent = this.searchResultsFor === null ? 'Rechercher' : 'Résultats : ' + this.searchResultsFor;
        if (this.searchResultsFor === null) {
          this.setItems(this.quick.map((q) => ({ kind: 'query', id: q, title: q, icon: '🔍' })), this.quick.length ? '' : 'OK pour saisir une recherche');
        } else this.render();
        break;
      case 'queue': {
        const q = this.w.queueInfo();
        this.titleEl.textContent = 'En cours' + (q.label ? ' · ' + q.label : '');
        this.setItems(this.trackItems(q.tracks, q.label), q.tracks.length ? '' : 'Aucune lecture en cours');
        this.state.item = Math.max(0, q.index);
        this.render();
        break;
      }
      case 'logout':
        this.titleEl.textContent = 'Déconnexion';
        this.setItems([], 'OK pour déconnecter le compte YouTube de cette TV');
        break;
      default:
    }
  }

  trackItems(tracks, label) {
    return tracks.map((t) => ({ kind: 'track', id: t.id, title: t.title, sub: t.artist, thumb: t.thumb, label, tracks }));
  }

  runSearch(query) {
    const q = String(query || '').trim();
    if (!q) return;
    this.searchEl.blur();
    this.searchResultsFor = q;
    this.state.item = 0;
    this.load('Résultats : ' + q, this.w.library.search(q), (tracks) => this.trackItems(tracks, 'Recherche : ' + q));
    // Les résultats prennent le focus dès qu'ils arrivent.
    this.state.zone = 'list';
  }

  // ---- Touches ---------------------------------------------------------------------
  activateMenu() {
    const tab = this.tab();
    if (tab.id === 'search') { this.searchEl.focus(); return; }
    if (tab.id === 'logout') { this.w.logout(); return; }
    if (this.items.length) { this.state.zone = 'list'; this.render(); }
  }

  activateItem() {
    const it = this.items[this.state.item];
    if (!it) return;
    if (it.kind === 'playlist') {
      this.status = 'Chargement de « ' + it.title + ' »…';
      this.renderList();
      this.w.playPlaylist(it.data).then(() => this.w.closePanel(), (e) => {
        if (e && e.authLost) { this.w.onAuthLost(e); return; }
        this.status = '⚠ ' + e.message;
        this.renderList();
      });
    } else if (it.kind === 'track') {
      if (this.tab().id === 'queue') this.w.playAt(this.state.item);
      else this.w.playTracks(it.tracks, this.state.item, it.label);
      this.w.closePanel();
    } else if (it.kind === 'query') {
      this.searchEl.value = it.title;
      this.runSearch(it.title);
    }
  }

  /** Bouton ⏮ ⏯ ⏭ validé avec OK. */
  pressControl() {
    this.w.mediaKey(this.controls[this.state.control]);
    this.after(300, () => this.renderNow());
  }

  onKey(key) {
    // Pendant la saisie : haut/bas/Retour quittent le champ.
    if (document.activeElement === this.searchEl) {
      if (key === 'enter') { this.runSearch(this.searchEl.value); return true; }
      if (key === 'back' || key === 'up' || key === 'down') { this.searchEl.blur(); return true; }
      return true;
    }
    if (key === 'playpause' || key === 'play' || key === 'pause' || key === 'stop') {
      this.w.mediaKey(key);
      this.after(300, () => this.renderNow());
      return true;
    }
    if ((key === 'next' || key === 'prev') && this.state.zone !== 'list') {
      this.w.mediaKey(key);
      this.after(300, () => this.renderNow());
      return true;
    }
    if (key === 'red') return false;
    const r = navigate(this.state, key, { menuLength: this.tabs.length, listLength: this.items.length, controlsLength: this.controls.length });
    this.state = r.state;
    const a = r.action;
    if (a && a.type === 'close') { this.w.closePanel(); return true; }
    if (a && a.type === 'tab') this.openTab();
    if (a && a.type === 'activate-menu') this.activateMenu();
    if (a && a.type === 'activate-item') this.activateItem();
    if (a && a.type === 'control') this.pressControl();
    this.render();
    return true;
  }

  after(ms, fn) { this.w.after(ms, fn); }
}
