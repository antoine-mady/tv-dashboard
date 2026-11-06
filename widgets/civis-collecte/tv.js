import Widget from '../../app/Widget.js';
import { h } from '../../app/dom.js';

const STREAMS = [
  { key: 'cartonDates', label: 'Carton · bac jaune', icon: '♻️', className: 'carton' },
  { key: 'menagerDates', label: 'Ménager · bac vert', icon: '🗑️', className: 'menager' },
  { key: 'encombrantsDates', label: 'Encombrants', icon: '🛋️', className: 'encombrants' },
  { key: 'vegetauxDates', label: 'Déchets végétaux', icon: '🌿', className: 'vegetaux' },
];

function dateKey(date) {
  return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' +
    String(date.getDate()).padStart(2, '0');
}

function nextDate(text, today) {
  const dates = String(text || '').split(/[\n,;]+/)
    .map((value) => value.trim())
    .filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value) && value >= today)
    .sort();
  return dates.length ? dates[0] : null;
}

function daysUntil(value, today) {
  const a = value.split('-').map(Number);
  const b = today.split('-').map(Number);
  return Math.round((Date.UTC(a[0], a[1] - 1, a[2]) - Date.UTC(b[0], b[1] - 1, b[2])) / 86400000);
}

function formatDate(value) {
  const parts = value.split('-').map(Number);
  return new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
    .format(new Date(parts[0], parts[1] - 1, parts[2]));
}

export default class CivisCollecteWidget extends Widget {
  mount(el, settings) {
    this.sectorEl = h('div', { className: 'civis-sector' });
    this.cardsEl = h('div', { className: 'civis-cards' });
    this.noteEl = h('div', { className: 'civis-note', text: 'Sortez les bacs la veille de la collecte.' });
    el.appendChild(h('div', { className: 'civis-inner' }, this.sectorEl, this.cardsEl, this.noteEl));
    this.settings = settings;
    this.render();
    this.every(15 * 60 * 1000, () => this.render());
  }

  render() {
    const today = dateKey(new Date());
    this.sectorEl.textContent = 'CIVIS  ·  ' + (this.settings.sector || 'Mon secteur');
    this.cardsEl.innerHTML = '';

    STREAMS.forEach((stream) => {
      const value = nextDate(this.settings[stream.key], today);
      const card = h('div', { className: 'civis-card civis-' + stream.className },
        h('div', { className: 'civis-icon', text: stream.icon }),
        h('div', { className: 'civis-label', text: stream.label }));

      if (value) {
        const remaining = daysUntil(value, today);
        const relative = remaining === 0 ? 'Aujourd’hui' : remaining === 1 ? 'Demain' : 'Dans ' + remaining + ' jours';
        card.appendChild(h('div', { className: 'civis-date', text: formatDate(value) }));
        card.appendChild(h('div', { className: 'civis-relative', text: relative }));
      } else {
        card.appendChild(h('div', { className: 'civis-date civis-missing', text: 'À renseigner' }));
      }
      this.cardsEl.appendChild(card);
    });
  }
}
