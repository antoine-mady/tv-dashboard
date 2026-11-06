import Widget from '../../app/Widget.js';
import { h } from '../../app/dom.js';
import { crawl, shuffle } from './dlna.js';
import { listUsbImages } from './usb.js';

export default class PhotosWidget extends Widget {
  mount(el, s) {
    if (s.source === 'dlna' && !s.dlnaUrl) throw new Error('Renseignez l’URL DLNA de la box');
    el.classList.add('fit-' + s.fit);
    this.layers = [this.makeLayer(), this.makeLayer()];
    this.front = 0;
    this.captionEl = h('div', { className: 'ph-caption' });
    this.statusEl = h('div', { className: 'ph-status muted', text: 'Recherche des photos…' });
    this.layers.forEach((l) => el.appendChild(l.root));
    el.appendChild(this.captionEl);
    el.appendChild(this.statusEl);

    this.photos = [];
    this.index = 0;
    this.failures = 0;
    this.every(s.refreshHours * 3600 * 1000, () => this.loadList());
  }

  makeLayer() {
    const blur = h('div', { className: 'ph-blur' });
    const img = h('img', { className: 'ph-img', alt: '' });
    return { root: h('div', { className: 'ph-layer' }, blur, img), img, blur };
  }

  async loadList() {
    try {
      await this.indexPhotos();
    } catch (e) {
      if (!this.photos.length) this.statusEl.textContent = ''; // le message d'erreur prend la place
      throw e;
    }
  }

  async indexPhotos() {
    const s = this.settings;
    const list = s.source === 'usb'
      ? await listUsbImages(s.usbFolder, s.maxPhotos)
      : await crawl((url, opts) => this.fetchText(url, Object.assign({ timeout: 30000 }, opts)), s.dlnaUrl, s.rootId, {
        max: s.maxPhotos,
        onProgress: (n) => { if (!this.photos.length) this.statusEl.textContent = 'Indexation… ' + n + ' photos'; },
      });
    if (!list.length) throw new Error('Aucune photo trouvée dans ce dossier');

    this.photos = s.shuffle ? shuffle(list) : list;
    this.index = 0;
    this.statusEl.textContent = '';
    if (!this.started) {
      this.started = true;
      this.next();
      if (!this.asleep) this.restartTimer(); // sinon : relancé au réveil (onSleep)
    }
  }

  restartTimer() {
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => this.next(), this.settings.intervalSec * 1000);
  }

  next(step) {
    if (!this.photos.length) return;
    const n = this.photos.length;
    this.index = ((this.index + (step || 1)) % n + n) % n;
    const photo = this.photos[this.index];
    const back = this.layers[1 - this.front];
    const loader = new Image();
    loader.onload = () => {
      this.failures = 0;
      back.img.src = photo.url;
      back.blur.style.backgroundImage = 'url("' + photo.url.replace(/"/g, '%22') + '")';
      back.root.classList.add('is-visible');
      this.layers[this.front].root.classList.remove('is-visible');
      this.front = 1 - this.front;
      this.captionEl.textContent = this.settings.showCaption ? [photo.title, photo.date && photo.date.slice(0, 10)].filter(Boolean).join(' · ') : '';
    };
    loader.onerror = () => {
      // Photo illisible : on passe à la suivante (sans boucler à l'infini).
      if (++this.failures < 20) this.after(200, () => this.next());
      else this.showError('Les photos ne se chargent pas (box injoignable ?)');
    };
    loader.src = photo.url;
  }

  onKey(key) {
    if (key === 'enter') { this.next(); this.restartTimer(); return true; }
    return false;
  }

  /** En veille : plus de diaporama (ni téléchargement de photos) ; il reprend au réveil. */
  onSleep(asleep) {
    if (asleep) {
      if (this.timer) clearInterval(this.timer);
      this.timer = null;
    } else if (this.started) {
      this.next();
      this.restartTimer();
    }
  }

  destroy() {
    if (this.timer) clearInterval(this.timer);
  }
}
