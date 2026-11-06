// Widget de référence (le plus simple) : à copier pour comprendre l'architecture.
import Widget from '../../app/Widget.js';
import { h } from '../../app/dom.js';
import { formatTime, formatDate } from './format.js';

export default class ClockWidget extends Widget {
  mount(el, s) {
    this.timeEl = h('div', { className: 'clock-time' });
    this.dateEl = h('div', { className: 'clock-date muted' });
    el.appendChild(h('div', { className: 'clock-inner' },
      s.label ? h('div', { className: 'clock-label', text: s.label }) : null,
      this.timeEl,
      s.showDate ? this.dateEl : null));

    this.render();
    // Démarre pile sur la seconde suivante pour rester synchronisé.
    this.after(1000 - (Date.now() % 1000), () => this.every(1000, () => this.render(), { whileAsleep: true }));
  }

  render() {
    const now = new Date();
    const tz = this.settings.timezone || undefined;
    this.timeEl.textContent = formatTime(now, { timeZone: tz, seconds: this.settings.seconds });
    this.dateEl.textContent = formatDate(now, { timeZone: tz });
  }
}
