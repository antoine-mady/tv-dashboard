// Client du lecteur hébergé (player/ sur GitHub Pages) : YouTube refuse de lire dans une app chargée
// en file:// (erreur 153, pas de référent). On ouvre donc la page lecteur dans une iframe et on la pilote
// par postMessage. Cette classe imite la partie de l'API YT.Player utilisée par tv.js.

export class PlayerBridge {
  /**
   * container : élément où placer l'iframe ; url : adresse de la page lecteur.
   * events : { onReady(), onStateChange({ data }), onError({ data }) }
   * win : window (injectable pour les tests).
   */
  constructor(container, url, events, win) {
    this.win = win || window;
    this.events = events || {};
    this.status = { state: -1, time: 0, duration: 0, index: -1, videoId: '', title: '', author: '' };
    this.ready = false;
    this.targetOrigin = originOf(url, this.win);
    const doc = container.ownerDocument;
    this.iframe = doc.createElement('iframe');
    this.iframe.setAttribute('allow', 'autoplay; encrypted-media');
    this.iframe.setAttribute('frameborder', '0');
    this.iframe.src = url;
    container.appendChild(this.iframe);
    this.onMessage = (e) => this.handle(e);
    this.win.addEventListener('message', this.onMessage);
  }

  handle(e) {
    const m = e.data;
    if (!m || m.tvdash !== 'evt' || e.source !== this.iframe.contentWindow) return;
    switch (m.type) {
      case 'ready':
        this.ready = true;
        if (this.events.onReady) this.events.onReady();
        break;
      case 'state':
        this.status.state = m.state;
        if (this.events.onStateChange) this.events.onStateChange({ data: m.state });
        break;
      case 'status': {
        const changed = m.videoId !== this.status.videoId || m.state !== this.status.state;
        this.status = m;
        if (changed && this.events.onStateChange) this.events.onStateChange({ data: m.state });
        break;
      }
      case 'error':
        if (this.events.onError) this.events.onError({ data: m.code });
        break;
      default:
    }
  }

  send(cmd, extra) {
    const msg = Object.assign({ tvdash: 'cmd', cmd }, extra);
    if (this.iframe.contentWindow) this.iframe.contentWindow.postMessage(msg, this.targetOrigin);
  }

  // ---- Même interface que YT.Player (partie utilisée) ----
  loadPlaylist(ids, index) { this.send('load', { ids, index }); }
  setLoop() { /* la page lecteur boucle toujours */ }
  playVideo() { this.send('play'); }
  pauseVideo() { this.send('pause'); }
  stopVideo() { this.send('stop'); }
  nextVideo() { this.send('next'); }
  previousVideo() { this.send('prev'); }
  playVideoAt(index) { this.send('playAt', { index }); }
  setVolume(value) { this.send('volume', { value }); }
  getPlayerState() { return this.status.state; }
  getCurrentTime() { return this.status.time; }
  getDuration() { return this.status.duration; }
  getPlaylistIndex() { return this.status.index; }
  getVideoData() { return { video_id: this.status.videoId, title: this.status.title, author: this.status.author }; }

  destroy() {
    this.win.removeEventListener('message', this.onMessage);
    if (this.iframe.parentNode) this.iframe.parentNode.removeChild(this.iframe);
  }
}

/** Origine de la page lecteur (pour cibler postMessage) ; '*' si l'URL est relative et la page en file://. */
export function originOf(url, win) {
  const m = /^(https?:\/\/[^/]+)/i.exec(url);
  if (m) return m[1];
  const here = win && win.location && win.location.origin;
  return here && here !== 'null' && here !== 'file://' ? here : '*';
}
