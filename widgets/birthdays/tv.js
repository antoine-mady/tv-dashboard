import Widget from '../../app/Widget.js';
import { h } from '../../app/dom.js';
// Lecture iCal partagée avec le widget Agenda (logique pure, sans DOM).
import { parseIcs, parseUrlList, expandEvents } from '../agenda/ical.js';
import { upcoming, windowFor } from './birthdays.js';

export default class BirthdaysWidget extends Widget {
  mount(el, s) {
    this.urls = parseUrlList(s.urls);
    if (!this.urls.length) throw new Error('Renseignez au moins une adresse iCal');
    this.listEl = h('div', { className: 'bd-list' });
    el.appendChild(h('div', { className: 'bd-inner' },
      s.title ? h('div', { className: 'bd-title', text: s.title }) : null,
      this.listEl));
    this.calendars = [];
    this.every(s.refreshMinutes * 60 * 1000, () => this.refresh());
    // Recalcul régulier pour passer « Demain » → « Aujourd’hui » à minuit sans retélécharger.
    this.every(10 * 60 * 1000, () => this.render(), { immediate: false });
  }

  async refresh() {
    const results = await Promise.all(this.urls.map((url, i) => this.fetchText(url).then(
      (text) => { this.calendars[i] = parseIcs(text); return null; },
      (e) => e)));
    const failed = results.filter(Boolean);
    this.loaded = true;
    this.render();
    failed.forEach((e) => console.warn('Anniversaires : ' + e.message));
    if (failed.length === this.urls.length) throw new Error('Agenda injoignable : ' + failed[0].message);
  }

  render() {
    if (!this.loaded) return;
    const s = this.settings;
    const now = new Date();
    const win = windowFor(now, s.daysAhead);
    let occ = [];
    this.calendars.forEach((events) => {
      if (events) occ = occ.concat(expandEvents(events, win.from, win.to));
    });
    const items = upcoming(occ, now, { filter: s.filter, max: s.maxItems, showAge: s.showAge });

    this.listEl.innerHTML = '';
    if (!items.length) {
      this.listEl.appendChild(h('div', { className: 'bd-empty muted',
        text: 'Aucun anniversaire dans les ' + s.daysAhead + ' prochains jours' }));
      return;
    }
    items.forEach((it) => {
      this.listEl.appendChild(h('div', { className: 'bd-item' + (it.today ? ' is-today' : '') },
        h('div', { className: 'bd-icon', text: it.today ? '🎉' : '🎂' }),
        h('div', { className: 'bd-text' },
          h('div', { className: 'bd-name', text: it.name + (it.age ? ' · ' + it.age + ' ans' : '') }),
          h('div', { className: 'bd-when muted', text: it.today ? 'Aujourd’hui !' : it.when + ' · ' + it.date }))));
    });
    this.trimOverflow();
  }

  /** Retire les lignes coupées en bas du widget. */
  trimOverflow() {
    const list = this.listEl;
    const max = list.clientHeight;
    if (!max) return;
    while (list.children.length > 1 && list.lastChild.offsetTop + list.lastChild.offsetHeight > max + list.offsetTop) {
      list.removeChild(list.lastChild);
    }
  }
}
