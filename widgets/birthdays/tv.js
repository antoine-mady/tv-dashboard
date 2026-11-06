import Widget from '../../app/Widget.js';
import { h } from '../../app/dom.js';
// Lecture iCal partagée avec le widget Agenda (logique pure, sans DOM).
import { parseIcs, parseUrlList, expandEvents } from '../agenda/ical.js';
import { ListPanel, focusHint } from '../../app/list-panel.js';
import {
  upcoming, windowFor, parseContacts, contactOccurrences, searchBirthdays, groupBirthdays, ageSentence,
} from './birthdays.js';

const TABS = [{ id: 'date', label: 'Par date' }, { id: 'name', label: 'Par nom' }];

export default class BirthdaysWidget extends Widget {
  mount(el, s) {
    if (s.source === 'contacts') {
      this.contacts = parseContacts(s.contacts).list;
      if (!this.contacts.length) throw new Error('Importez vos contacts dans l’admin');
    } else {
      this.urls = parseUrlList(s.urls);
      if (!this.urls.length) throw new Error('Renseignez au moins une adresse iCal');
    }
    this.listEl = h('div', { className: 'bd-list' });
    el.appendChild(h('div', { className: 'bd-inner' },
      s.title ? h('div', { className: 'bd-title', text: s.title }) : null,
      this.listEl),
      focusHint('OK : tout voir · chercher'));
    this.calendars = [];
    if (this.contacts) {
      this.loaded = true;
      this.every(10 * 60 * 1000, () => this.update());
      return;
    }
    this.every(s.refreshMinutes * 60 * 1000, () => this.refresh());
    // Recalcul régulier pour passer « Demain » → « Aujourd’hui » à minuit sans retélécharger.
    this.every(10 * 60 * 1000, () => this.update(), { immediate: false });
  }

  update() {
    this.render();
    if (this.list) this.list.refresh();
  }

  async refresh() {
    const results = await Promise.all(this.urls.map((url, i) => this.fetchText(url).then(
      (text) => { this.calendars[i] = parseIcs(text); return null; },
      (e) => e)));
    const failed = results.filter(Boolean);
    this.loaded = true;
    this.update();
    failed.forEach((e) => console.warn('Anniversaires : ' + e.message));
    if (failed.length === this.urls.length) throw new Error('Agenda injoignable : ' + failed[0].message);
  }

  render() {
    if (!this.loaded) return;
    const s = this.settings;
    const now = new Date();
    const win = windowFor(now, s.daysAhead);
    let occ = this.contacts ? contactOccurrences(this.contacts, win.from, win.to) : [];
    this.calendars.forEach((events) => {
      if (events) occ = occ.concat(expandEvents(events, win.from, win.to));
    });
    const items = upcoming(occ, now, { filter: this.contacts ? '' : s.filter, max: s.maxItems, showAge: s.showAge });

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

  // ---- Panneau « tout voir » : tous les anniversaires de l'année, recherche par nom ----------
  onKey(key) {
    if (this.list) return this.list.onKey(key);
    if (key === 'enter') { this.openList(); return true; }
    return false;
  }

  onPanelClose() { this.list = null; }

  openList() {
    this.list = new ListPanel(this, {
      className: 'w-birthdays-panel',
      title: this.settings.title || 'Anniversaires',
      tabs: TABS,
      tabsHint: 'trier par date / par nom',
      search: { placeholder: '🔍 Chercher une personne (OK pour écrire, ou dictée)' },
      detail: true,
      rows: (ctx) => this.panelRows(ctx.tab.id, ctx.query),
      empty: (ctx) => (!this.loaded ? 'Chargement…' : ctx.query ? 'Personne ne correspond à « ' + ctx.query + ' »' : 'Aucun anniversaire'),
    });
  }

  /** Tous les anniversaires des 12 prochains mois (une fois par personne). */
  allBirthdays() {
    const s = this.settings;
    const now = new Date();
    const win = windowFor(now, 365);
    let occ = this.contacts ? contactOccurrences(this.contacts, win.from, win.to) : [];
    this.calendars.forEach((events) => {
      if (events) occ = occ.concat(expandEvents(events, win.from, win.to));
    });
    return upcoming(occ, now, { filter: this.contacts ? '' : s.filter, max: Infinity, showAge: s.showAge });
  }

  panelRows(sort, query) {
    if (!this.loaded) return [];
    const rows = [];
    groupBirthdays(searchBirthdays(this.allBirthdays(), query, sort), sort).forEach((g) => {
      rows.push({ header: g.label });
      g.items.forEach((b) => {
        rows.push({
          key: b.name + '|' + b.day.getTime(),
          className: b.today ? 'is-today' : '',
          el: h('div', { className: 'bdp-row' },
            h('div', { className: 'bdp-icon', text: b.today ? '🎉' : '🎂' }),
            h('div', { className: 'bdp-name ellipsis', text: b.name + (b.age ? ' · ' + b.age + ' ans' : '') }),
            h('div', { className: 'bdp-when', text: b.today ? 'Aujourd’hui !' : b.date + ' · ' + b.when.toLowerCase() })),
          detail: () => this.detail(b),
        });
      });
    });
    return rows;
  }

  detail(b) {
    const full = b.day.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    return h('div', { className: 'bdp-detail' + (b.today ? ' is-today' : '') },
      h('div', { className: 'bdp-detail-icon', text: b.today ? '🎉' : '🎂' }),
      h('div', { className: 'bdp-detail-name', text: b.name }),
      h('div', { className: 'bdp-detail-line', text: full.charAt(0).toUpperCase() + full.slice(1) }),
      h('div', { className: 'bdp-detail-when', text: b.today ? 'C’est aujourd’hui !' : b.when }),
      b.age ? h('div', { className: 'bdp-detail-line', text: ageSentence(b) }) : null,
      b.year ? h('div', { className: 'bdp-detail-line muted', text: 'Année de naissance : ' + b.year }) : null);
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
