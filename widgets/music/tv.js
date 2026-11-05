// Lecteur de playlist via l'API IFrame YouTube (il n'existe pas d'API publique YouTube Music :
// les playlists YouTube Music sont des playlists YouTube classiques).
/* global YT */
import Widget from '../../app/Widget.js';
import { h } from '../../app/dom.js';
import { parsePlaylistId, formatDuration } from './playlist.js';

let apiPromise = null;
function loadYouTubeApi() {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve, reject) => {
    if (window.YT && window.YT.Player) { resolve(window.YT); return; }
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { if (prev) prev(); resolve(window.YT); };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.onerror = () => { apiPromise = null; reject(new Error('Impossible de charger YouTube (connexion internet ?)')); };
    document.head.appendChild(s);
  });
  return apiPromise;
}

const PLAYING = 1;
const PAUSED = 2;
const BUFFERING = 3;

export default class MusicWidget extends Widget {
  mount(el, s) {
    const list = parsePlaylistId(s.playlist);
    if (!list) throw new Error('Renseignez une playlist YouTube Music valide');

    this.errors = 0;
    this.holder = h('div', { className: 'mu-player-inner' });
    this.coverEl = h('div', { className: 'mu-cover' });
    this.stateEl = h('div', { className: 'mu-state', text: '…' });
    this.titleEl = h('div', { className: 'mu-title ellipsis', text: 'Chargement…' });
    this.artistEl = h('div', { className: 'mu-artist muted ellipsis' });
    this.barEl = h('div', { className: 'mu-bar-fill' });
    this.timeEl = h('div', { className: 'mu-time muted' });
    this.hintEl = h('div', { className: 'mu-hint muted', text: 'OK : lecture / pause · ⏭ ⏮ : piste · 🔴 : YouTube' });

    el.classList.add(s.showVideo ? 'mu-video' : 'mu-audio');
    el.appendChild(h('div', { className: 'mu-media' }, h('div', { className: 'mu-player' }, this.holder), this.coverEl, this.stateEl));
    el.appendChild(h('div', { className: 'mu-info' },
      this.titleEl, this.artistEl,
      h('div', { className: 'mu-bar' }, this.barEl),
      this.timeEl, this.hintEl));

    return loadYouTubeApi().then(() => {
      this.player = new YT.Player(this.holder, {
        width: '100%',
        height: '100%',
        playerVars: {
          listType: 'playlist', list, autoplay: s.autoplay ? 1 : 0, controls: 0, disablekb: 1,
          rel: 0, modestbranding: 1, playsinline: 1, iv_load_policy: 3, fs: 0, loop: 1,
        },
        events: {
          onReady: () => this.onReady(),
          onStateChange: (e) => this.onState(e.data),
          onError: (e) => this.onPlayerError(e.data),
        },
      });
      this.every(1000, () => this.updateProgress(), { immediate: false });
    });
  }

  onReady() {
    const p = this.player;
    p.setVolume(this.settings.volume);
    p.setLoop(true);
    if (this.settings.shuffle) {
      p.setShuffle(true);
      // setShuffle n'agit qu'après le chargement de la liste : on repart sur la 1re piste mélangée.
      this.after(800, () => { if (this.settings.autoplay) p.playVideoAt(0); });
    } else if (this.settings.autoplay) {
      p.playVideo();
    }
  }

  onState(state) {
    this.stateEl.textContent = state === PLAYING ? '' : state === BUFFERING ? '…' : '▶';
    this.stateEl.style.opacity = state === PLAYING ? '0' : '1';
    if (state === PLAYING) this.errors = 0;
    const data = this.player.getVideoData ? this.player.getVideoData() : null;
    if (data && data.video_id && data.video_id !== this.videoId) {
      this.videoId = data.video_id;
      this.titleEl.textContent = data.title || '—';
      this.artistEl.textContent = (data.author || '').replace(/ - Topic$/, '');
      this.coverEl.style.backgroundImage = 'url(https://i.ytimg.com/vi/' + data.video_id + '/hqdefault.jpg)';
    }
  }

  onPlayerError(code) {
    // 101/150 : intégration refusée par l'ayant droit ; 100 : vidéo supprimée → piste suivante.
    this.errors++;
    if (this.errors > 15) {
      this.showError('Aucune piste de cette playlist n’est lisible ici (erreur YouTube ' + code + ')');
      return;
    }
    this.after(500, () => this.player.nextVideo());
  }

  updateProgress() {
    if (!this.player || !this.player.getDuration) return;
    const d = this.player.getDuration();
    const t = this.player.getCurrentTime();
    this.barEl.style.width = d ? (100 * t / d) + '%' : '0';
    this.timeEl.textContent = d ? formatDuration(t) + ' / ' + formatDuration(d) : '';
  }

  toggle() {
    if (!this.player || !this.player.getPlayerState) return;
    if (this.player.getPlayerState() === PLAYING) this.player.pauseVideo();
    else this.player.playVideo();
  }

  onKey(key) {
    if (!this.player || !this.player.getPlayerState) return false;
    switch (key) {
      case 'enter':
      case 'playpause': this.toggle(); return true;
      case 'play': this.player.playVideo(); return true;
      case 'pause':
      case 'stop': this.player.pauseVideo(); return true;
      case 'next': this.player.nextVideo(); return true;
      case 'prev': this.player.previousVideo(); return true;
      case 'red':
        this.player.pauseVideo();
        this.platform.launchApp(this.settings.youtubeAppId);
        return true;
      default: return false;
    }
  }

  onFocus(focused) {
    this.hintEl.style.opacity = focused ? '1' : '0';
  }

  destroy() {
    if (this.player && this.player.destroy) this.player.destroy();
  }
}
