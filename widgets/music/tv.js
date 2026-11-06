// Widget musique connecté au compte YouTube (API YouTube Data v3 + lecteur YouTube via la page player/).
// États : 'login' (bouton connecter) → 'connecting' (QR code + code) → 'player' (mini-lecteur).
// OK sur le mini-lecteur ouvre la bibliothèque en plein écran (browser.js).
import Widget from '../../app/Widget.js';
import { h } from '../../app/dom.js';
import { qrSvg } from '../../app/qr.js';
import { parsePlaylistId, formatDuration, shuffleQueue } from './playlist.js';
import { createAuth, createLibrary } from './auth.js';
import { webSignInUrl } from './google.js';
import { MusicBrowser } from './browser.js';
import { PlayerBridge } from './bridge.js';

const PLAYING = 1;
const BUFFERING = 3;

export default class MusicWidget extends Widget {
  mount(el, s) {
    if (!s.clientId || !s.clientSecret) throw new Error('Renseignez l’ID et le secret client Google dans l’admin');
    this.auth = createAuth({ fetch: (url, opts) => this.fetchRaw(url, opts), store: this.store, clientId: s.clientId, clientSecret: s.clientSecret });
    this.library = createLibrary(this.auth);
    this.queue = { tracks: [], label: '' };
    this.errors = 0;
    this.focused = false;

    // Vue connexion
    this.loginQr = h('div', { className: 'mu-login-qr' });
    this.loginTitle = h('div', { className: 'mu-login-title', text: 'Connecter YouTube' });
    this.loginText = h('div', { className: 'mu-login-text' });
    this.loginView = h('div', { className: 'mu-login' }, this.loginQr, h('div', { className: 'mu-login-info' }, this.loginTitle, this.loginText));

    // Vue lecteur
    this.holder = h('div', { className: 'mu-player-inner' });
    this.coverEl = h('div', { className: 'mu-cover' });
    this.stateEl = h('div', { className: 'mu-state', text: '♪' });
    this.titleEl = h('div', { className: 'mu-title ellipsis', text: 'Aucune lecture' });
    this.artistEl = h('div', { className: 'mu-artist muted ellipsis', text: 'OK : ouvrir ma bibliothèque' });
    this.sourceEl = h('div', { className: 'mu-source ellipsis' });
    this.barEl = h('div', { className: 'mu-bar-fill' });
    this.timeEl = h('div', { className: 'mu-time muted' });
    this.hintEl = h('div', { className: 'mu-hint muted', text: 'OK : bibliothèque · ⏯ ⏭ ⏮ · 🔴 : app YouTube' });
    this.playerView = h('div', { className: 'mu-playerview' },
      h('div', { className: 'mu-media' }, h('div', { className: 'mu-player' }, this.holder), this.coverEl, this.stateEl),
      h('div', { className: 'mu-info' }, this.sourceEl, this.titleEl, this.artistEl, h('div', { className: 'mu-bar' }, this.barEl), this.timeEl, this.hintEl));

    el.classList.add(s.showVideo ? 'mu-video' : 'mu-audio');
    el.appendChild(this.loginView);
    el.appendChild(this.playerView);

    if (this.auth.isConnected()) this.showPlayer(true);
    else this.showLogin();
  }

  // ---- Connexion -------------------------------------------------------------------
  showLogin(message) {
    this.mode = 'login';
    this.device = null;
    this.loginView.style.display = '';
    this.playerView.style.display = 'none';
    this.loginQr.innerHTML = '';
    this.loginQr.style.display = 'none';
    this.loginTitle.textContent = 'Connecter YouTube';
    this.loginText.innerHTML = '';
    if (message) this.loginText.appendChild(h('div', { className: 'mu-login-warn', text: message }));
    this.loginText.appendChild(h('div', { text: 'Sélectionnez ce widget et appuyez sur OK pour associer votre compte YouTube à la TV.' }));
  }

  startLogin() {
    this.mode = 'connecting';
    this.loginTitle.textContent = 'Connexion…';
    this.loginText.textContent = '';
    this.auth.startDeviceFlow().then((dev) => {
      if (this.mode !== 'connecting') return;
      this.device = dev;
      this.loginQr.innerHTML = qrSvg(dev.verificationUrl);
      this.loginQr.style.display = '';
      this.loginTitle.textContent = 'Sur votre téléphone';
      this.loginText.innerHTML = '';
      this.loginText.appendChild(h('div', { text: '1. Scannez le QR code ou ouvrez ' + dev.verificationUrl.replace(/^https?:\/\/(www\.)?/, '') }));
      this.loginText.appendChild(h('div', { text: '2. Saisissez le code :' }));
      this.loginText.appendChild(h('div', { className: 'mu-login-code', text: dev.userCode }));
      this.pollLoop(dev, dev.interval);
    }, (e) => this.showLogin('⚠ ' + e.message));
  }

  pollLoop(dev, interval) {
    this.after(interval, () => {
      if (this.mode !== 'connecting' || this.device !== dev) return;
      this.auth.poll(dev).then((r) => {
        if (r === 'connected') this.showPlayer(true);
        else this.pollLoop(dev, r === 'slow_down' ? interval + 5000 : interval);
      }, (e) => this.showLogin('⚠ ' + e.message));
    });
  }

  logout() {
    this.auth.logout();
    this.library.clear();
    if (this.player && this.player.stopVideo) this.player.stopVideo();
    this.queue = { tracks: [], label: '' };
    this.closePanel();
    this.showLogin('Compte déconnecté.');
  }

  /**
   * Ouvre la connexion Google « web » pour créer une session youtube.com dans l'app : c'est elle (et non le
   * jeton OAuth) qui permet au lecteur intégré de reconnaître un compte Premium. Sur la TV, l'app quitte le
   * dashboard (navigation de la page entière, autorisée par <tizen:allow-navigation>) ; on y revient en
   * relançant l'app. Dans l'aperçu, le navigateur du PC a déjà sa propre session : nouvel onglet.
   */
  openGoogleSignIn() {
    const url = webSignInUrl();
    if (this.platform.isPreview || !this.platform.isTizen) { window.open(url, '_blank'); return; }
    if (this.player && this.player.pauseVideo) this.player.pauseVideo();
    window.location.href = url;
  }

  /** La connexion a expiré ou a été révoquée : retour à l'écran de connexion. */
  onAuthLost(e) {
    this.closePanel();
    if (this.player && this.player.pauseVideo) this.player.pauseVideo();
    this.showLogin('⚠ ' + (e && e.message ? e.message : 'Reconnectez-vous'));
  }

  // ---- Lecteur ---------------------------------------------------------------------
  showPlayer(startup) {
    this.mode = 'player';
    this.loginView.style.display = 'none';
    this.playerView.style.display = '';
    this.ensurePlayer().then(() => {
      if (startup && this.settings.autoplay) this.startSource();
    }, (e) => this.showError(e.message));
  }

  /** Adresse de la page lecteur : servie par l'admin dans l'aperçu, hébergée (HTTPS) sur la TV. */
  playerUrl() {
    return this.platform.isPreview ? '/player/' : this.settings.playerUrl;
  }

  ensurePlayer() {
    if (this.playerReady) return this.playerReady;
    this.playerReady = new Promise((resolve, reject) => {
      if (!this.playerUrl()) { reject(new Error('Renseignez l’adresse de la page lecteur dans l’admin')); return; }
      // YouTube refuse de lire dans une app chargée en file:// (erreur 153) : le lecteur tourne dans une page
      // hébergée en HTTPS (player/), pilotée par messages.
      const timeout = setTimeout(() => {
        this.playerReady = null;
        reject(new Error('Page lecteur injoignable (' + this.playerUrl() + ')'));
      }, 30000);
      this.player = new PlayerBridge(this.holder, this.playerUrl(), {
        onReady: () => { clearTimeout(timeout); this.player.setVolume(this.settings.volume); resolve(); },
        onStateChange: (e) => this.onState(e.data),
        onError: (e) => this.onPlayerError(e.data),
      });
      this.every(1000, () => this.updateProgress(), { immediate: false });
    });
    return this.playerReady;
  }

  startSource() {
    const s = this.settings;
    let p = null;
    if (s.startSource === 'liked') p = this.library.liked().then((t) => this.playTracks(t, s.shuffle ? -1 : 0, 'J’aime'));
    if (s.startSource === 'playlist') {
      const id = parsePlaylistId(s.startPlaylist);
      if (id) p = this.playPlaylist({ id, title: 'Playlist de démarrage' });
    }
    if (p) p.catch((e) => (e && e.authLost ? this.onAuthLost(e) : this.setSource('⚠ ' + e.message)));
  }

  playPlaylist(playlist) {
    return this.library.playlistTracks(playlist.id).then((tracks) => {
      if (!tracks.length) throw new Error('Playlist vide ou illisible');
      this.playTracks(tracks, this.settings.shuffle ? -1 : 0, playlist.title);
    });
  }

  /** Lance une liste de titres à partir de l'index donné (-1 = tout mélangé). */
  playTracks(tracks, index, label) {
    if (!tracks.length) return;
    const ordered = this.settings.shuffle ? shuffleQueue(tracks, index) : tracks;
    const start = this.settings.shuffle ? 0 : Math.max(0, index);
    this.queue = { tracks: ordered, label: label || '' };
    this.errors = 0;
    this.setSource(label);
    this.ensurePlayer().then(() => {
      this.player.loadPlaylist(ordered.map((t) => t.id), start);
      this.player.setLoop(true);
    }, (e) => this.setSource('⚠ ' + e.message));
  }

  playAt(index) {
    if (this.player && this.player.playVideoAt) this.player.playVideoAt(index);
  }

  setSource(text) {
    this.sourceEl.textContent = text || '';
  }

  currentTrack() {
    if (!this.player || !this.player.getVideoData) return null;
    const data = this.player.getVideoData() || {};
    if (!data.video_id) return null;
    const known = this.queue.tracks.find((t) => t.id === data.video_id);
    return known || { id: data.video_id, title: data.title || '—', artist: (data.author || '').replace(/ - Topic$/, ''), thumb: '' };
  }

  queueInfo() {
    const index = this.player && this.player.getPlaylistIndex ? this.player.getPlaylistIndex() : -1;
    return { tracks: this.queue.tracks, label: this.queue.label, index };
  }

  isPlaying() {
    return !!(this.player && this.player.getPlayerState && this.player.getPlayerState() === PLAYING);
  }

  onState(state) {
    this.stateEl.textContent = state === PLAYING ? '' : state === BUFFERING ? '…' : '▶';
    this.stateEl.style.opacity = state === PLAYING ? '0' : '1';
    if (state === PLAYING && this.errors) { this.errors = 0; this.setSource(this.queue.label); }
    const t = this.currentTrack();
    if (t && t.id !== this.videoId) {
      this.videoId = t.id;
      this.titleEl.textContent = t.title;
      this.artistEl.textContent = t.artist;
      this.coverEl.style.backgroundImage = 'url(https://i.ytimg.com/vi/' + t.id + '/hqdefault.jpg)';
    }
    if (this.browser) this.browser.renderNow();
  }

  onPlayerError(code) {
    // 100 : vidéo supprimée ; 101/150 : intégration refusée par l'ayant droit → piste suivante.
    // 152/153 : le lecteur refuse l'environnement (référent manquant) → inutile d'insister.
    this.errors++;
    if (code === 'api') {
      this.setSource('⚠ La page lecteur n’arrive pas à charger YouTube');
      return;
    }
    if (code === 152 || code === 153) {
      this.setSource('⚠ Lecteur YouTube refusé sur cette TV (erreur ' + code + ')');
      return;
    }
    if (this.errors > 15) {
      this.setSource('⚠ Aucun titre lisible ici (erreur YouTube ' + code + ')');
      return;
    }
    this.setSource((this.queue.label || '') + ' · titre ignoré (erreur ' + code + ')');
    this.after(500, () => this.player.nextVideo());
  }

  updateProgress() {
    if (!this.player || !this.player.getDuration) return;
    const d = this.player.getDuration();
    const t = this.player.getCurrentTime();
    this.barEl.style.width = d ? (100 * t / d) + '%' : '0';
    this.timeEl.textContent = d ? formatDuration(t) + ' / ' + formatDuration(d) : '';
  }

  /** Touches média (aussi utilisées par le panneau). Retourne true si gérée. */
  mediaKey(key) {
    const p = this.player;
    if (!p || !p.getPlayerState || !this.queue.tracks.length) return false;
    switch (key) {
      case 'playpause': if (this.isPlaying()) p.pauseVideo(); else p.playVideo(); return true;
      case 'play': p.playVideo(); return true;
      case 'pause':
      case 'stop': p.pauseVideo(); return true;
      case 'next': p.nextVideo(); return true;
      case 'prev': p.previousVideo(); return true;
      default: return false;
    }
  }

  // ---- Télécommande ------------------------------------------------------------------
  onKey(key) {
    if (key === 'red') {
      if (this.player && this.player.pauseVideo) this.player.pauseVideo();
      this.platform.launchApp(this.settings.youtubeAppId);
      return true;
    }
    if (this.browser) return this.browser.onKey(key);
    if (this.mode === 'login') {
      if (key === 'enter') { this.startLogin(); return true; }
      return false;
    }
    if (this.mode === 'connecting') {
      if (key === 'back') { this.showLogin(); return true; }
      return key === 'enter';
    }
    if (key === 'enter') {
      this.browser = new MusicBrowser(this, this.openPanel());
      return true;
    }
    return this.mediaKey(key);
  }

  onPanelClose() {
    this.browser = null;
  }

  onFocus(focused) {
    this.focused = focused;
    this.hintEl.style.opacity = focused ? '1' : '0';
  }

  destroy() {
    if (this.player && this.player.destroy) this.player.destroy();
  }
}
