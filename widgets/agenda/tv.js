import Widget from '../../app/Widget.js';
import { h } from '../../app/dom.js';
import { parseIcs, parseUrlList, expandEvents } from './ical.js';
import { groupByDay, windowFor } from './agenda.js';

const COLORS = ['var(--accent)', '#ffb86b', '#7ee0a1', '#ff8fb1', '#c9a7ff', '#ffe27a'];

export default class AgendaWidget extends Widget {
  mount(el, s) {
    this.urls = parseUrlList(s.urls);
    if (!this.urls.length) throw new Error('Renseignez au moins une adresse iCal');
    this.listEl = h('div', { className: 'ag-list' });
    el.appendChild(h('div', { className: 'ag-inner' },
      s.title ? h('div', { className: 'ag-title', text: s.title }) : null,
      this.listEl));
    this.calendars = []; // événements bruts de chaque agenda (dernier téléchargement réussi)
    // Téléchargement espacé ; le rendu est recalculé chaque minute (« En cours », passage à minuit).
    this.every(s.refreshMinutes * 60 * 1000, () => this.refresh());
    this.every(60 * 1000, () => this.render(), { immediate: false });
  }

  async refresh() {
    const results = await Promise.all(this.urls.map((url, i) => this.fetchText(url).then(
      (text) => { this.calendars[i] = parseIcs(text); return null; },
      (e) => e)));
    const failed = results.filter(Boolean);
    this.loaded = true;
    this.render();
    // Un agenda en échec n'empêche pas d'afficher les autres ; tout en échec → message d'erreur.
    failed.forEach((e) => console.warn('Agenda : ' + e.message));
    if (failed.length === this.urls.length) throw new Error('Agenda injoignable : ' + failed[0].message);
  }

  render() {
    if (!this.loaded) return;
    const s = this.settings;
    const now = new Date();
    const win = windowFor(now, s.days);
    let occ = [];
    this.calendars.forEach((events, i) => {
      if (events) occ = occ.concat(expandEvents(events, win.from, win.to, { calendar: i }));
    });
    const groups = groupByDay(occ, now, s.maxEvents);

    this.listEl.innerHTML = '';
    if (!groups.length) {
      this.listEl.appendChild(h('div', { className: 'ag-empty muted', text: s.days === 1 ? 'Rien de prévu aujourd’hui' : 'Rien de prévu' }));
      return;
    }
    groups.forEach((g) => {
      this.listEl.appendChild(h('div', { className: 'ag-day' + (g.today ? ' is-today' : ''), text: g.label }));
      g.items.forEach((it) => {
        this.listEl.appendChild(h('div', { className: 'ag-event' + (it.now ? ' is-now' : '') },
          h('div', { className: 'ag-dot', style: { background: COLORS[it.calendar % COLORS.length] } }),
          h('div', { className: 'ag-time', text: it.time }),
          h('div', { className: 'ag-text' },
            h('div', { className: 'ag-summary', text: it.summary }),
            s.showLocation && it.location ? h('div', { className: 'ag-location muted', text: it.location }) : null)));
      });
    });
    this.trimOverflow();
  }

  /** Retire les lignes coupées en bas du widget (et un titre de jour resté sans événement). */
  trimOverflow() {
    const list = this.listEl;
    const max = list.clientHeight;
    if (!max) return;
    while (list.lastChild && list.lastChild.offsetTop + list.lastChild.offsetHeight > max + list.offsetTop) {
      list.removeChild(list.lastChild);
    }
    while (list.lastChild && /\bag-day\b/.test(list.lastChild.className)) list.removeChild(list.lastChild);
  }
}
