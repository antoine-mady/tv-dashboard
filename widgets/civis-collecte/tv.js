import Widget from '../../app/Widget.js';
import { h } from '../../app/dom.js';

const STREAMS = [
  { key: 'cartonDates', label: 'Cartons · bac jaune', color: '#ffe27a' },
  { key: 'menagerDates', label: 'Ménager · bac vert', color: '#7ee0a1' },
  { key: 'encombrantsDates', label: 'Encombrants', color: '#b8c2cc' },
  { key: 'vegetauxDates', label: 'Déchets végétaux', color: '#c6ad79' },
];

function twoDigits(value) {
  return ('0' + value).slice(-2);
}

function dateKey(date) {
  return date.getFullYear() + '-' + twoDigits(date.getMonth() + 1) + '-' + twoDigits(date.getDate());
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
    this.titleEl = h('div', { className: 'civis-title' });
    this.listEl = h('div', { className: 'civis-list' });
    this.noteEl = h('div', { className: 'civis-note', text: 'Sortez les déchets la veille de la collecte.' });
    el.appendChild(h('div', { className: 'civis-inner' }, this.titleEl, this.listEl, this.noteEl));
    this.settings = settings;
    this.render();
    this.every(60 * 1000, () => this.render());
  }

  render() {
    const today = dateKey(new Date());
    this.titleEl.textContent = 'CIVIS  ·  ' + (this.settings.sector || 'Mon secteur');
    this.listEl.innerHTML = '';

    const events = STREAMS.map((stream, index) => ({
      stream,
      index,
      date: nextDate(this.settings[stream.key], today),
    })).sort((a, b) => {
      if (!a.date) return b.date ? 1 : a.index - b.index;
      if (!b.date) return -1;
      return a.date < b.date ? -1 : a.date > b.date ? 1 : a.index - b.index;
    });

    events.forEach((event) => {
      const value = event.date;
      const row = h('div', { className: 'civis-event' },
        h('div', { className: 'civis-dot', style: { background: event.stream.color } }),
        h('div', { className: 'civis-date', text: value ? formatDate(value) : '—' }),
        h('div', { className: 'civis-text' },
          h('div', { className: 'civis-summary', text: event.stream.label }),
          h('div', { className: 'civis-relative muted',
            text: value ? relativeDate(daysUntil(value, today)) : 'À renseigner' })));
      this.listEl.appendChild(row);
    });
  }
}

function relativeDate(remaining) {
  if (remaining === 0) return 'Aujourd’hui';
  if (remaining === 1) return 'Demain';
  return 'Dans ' + remaining + ' jours';
}
