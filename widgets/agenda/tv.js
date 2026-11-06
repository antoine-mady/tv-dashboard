import Widget from '../../app/Widget.js';
import { h } from '../../app/dom.js';
import { ListPanel, focusHint } from '../../app/list-panel.js';
import { parseIcs, parseUrlList, expandEvents, calendarName } from './ical.js';
import { groupByDay, windowFor, rangeLabel, fullDate } from './agenda.js';

const COLORS = ['var(--accent)', '#ffb86b', '#7ee0a1', '#ff8fb1', '#c9a7ff', '#ffe27a'];
const PANEL_DAYS = 90; // le panneau « tout voir » montre les 3 prochains mois

function color(i) { return COLORS[i % COLORS.length]; }

export default class AgendaWidget extends Widget {
  mount(el, s) {
    this.urls = parseUrlList(s.urls);
    if (!this.urls.length) throw new Error('Renseignez au moins une adresse iCal');
    this.listEl = h('div', { className: 'ag-list' });
    el.appendChild(h('div', { className: 'ag-inner' },
      s.title ? h('div', { className: 'ag-title', text: s.title }) : null,
      this.listEl),
      focusHint());
    this.calendars = []; // événements bruts de chaque agenda (dernier téléchargement réussi)
    this.names = [];     // nom de chaque agenda (X-WR-CALNAME)
    // Téléchargement espacé ; le rendu est recalculé chaque minute (« En cours », passage à minuit).
    this.every(s.refreshMinutes * 60 * 1000, () => this.refresh());
    this.every(60 * 1000, () => this.update(), { immediate: false });
  }

  update() {
    this.render();
    if (this.list) this.list.refresh();
  }

  async refresh() {
    const results = await Promise.all(this.urls.map((url, i) => this.fetchText(url).then(
      (text) => { this.calendars[i] = parseIcs(text); this.names[i] = calendarName(text); return null; },
      (e) => e)));
    const failed = results.filter(Boolean);
    this.loaded = true;
    this.update();
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
          h('div', { className: 'ag-dot', style: { background: color(it.calendar) } }),
          h('div', { className: 'ag-time', text: it.time }),
          h('div', { className: 'ag-text' },
            h('div', { className: 'ag-summary', text: it.summary }),
            s.showLocation && it.location ? h('div', { className: 'ag-location muted', text: it.location }) : null)));
      });
    });
    this.trimOverflow();
  }

  // ---- Panneau « tout voir » (OK sur le widget) ----------------------------------------
  calendarLabel(i) { return this.names[i] || (this.urls.length > 1 ? 'Agenda ' + (i + 1) : this.settings.title || 'Agenda'); }

  onKey(key) {
    if (this.list) return this.list.onKey(key);
    if (key === 'enter') { this.openList(); return true; }
    return false;
  }

  onPanelClose() { this.list = null; }

  openList() {
    // Plusieurs agendas : un onglet par agenda (◀ ▶), en plus de « Tous ».
    const tabs = this.urls.length > 1
      ? [{ id: -1, label: 'Tous' }].concat(this.urls.map((u, i) => ({ id: i, label: this.calendarLabel(i) })))
      : [];
    this.list = new ListPanel(this, {
      className: 'w-agenda-panel',
      title: (this.settings.title || 'Agenda') + ' · ' + PANEL_DAYS + ' prochains jours',
      tabs,
      tabsHint: 'changer d’agenda',
      detail: true,
      rows: (ctx) => this.panelRows(ctx.tab ? ctx.tab.id : -1),
      empty: () => (this.loaded ? 'Rien de prévu' : 'Chargement…'),
    });
  }

  panelRows(only) {
    if (!this.loaded) return [];
    const now = new Date();
    const win = windowFor(now, PANEL_DAYS);
    let occ = [];
    this.calendars.forEach((events, i) => {
      if (events && (only < 0 || only === i)) occ = occ.concat(expandEvents(events, win.from, win.to, { calendar: i }));
    });
    const rows = [];
    groupByDay(occ, now, Infinity).forEach((g) => {
      rows.push({ header: g.label });
      g.items.forEach((it) => {
        rows.push({
          key: it.calendar + '|' + it.start.getTime() + '|' + it.summary,
          className: it.now ? 'is-now' : '',
          el: h('div', { className: 'agp-row' },
            h('div', { className: 'agp-dot', style: { background: color(it.calendar) } }),
            h('div', { className: 'agp-time', text: it.time }),
            h('div', { className: 'agp-text' },
              h('div', { className: 'agp-summary ellipsis', text: it.summary }),
              it.location ? h('div', { className: 'agp-location muted ellipsis', text: it.location }) : null)),
          detail: () => this.detail(it),
        });
      });
    });
    return rows;
  }

  detail(it) {
    const desc = it.description.length > 700 ? it.description.slice(0, 700) + '…' : it.description;
    return h('div', { className: 'agp-detail' },
      h('div', { className: 'agp-detail-cal' },
        h('span', { className: 'agp-dot', style: { background: color(it.calendar) } }),
        h('span', { text: this.calendarLabel(it.calendar) })),
      h('div', { className: 'agp-detail-title', text: it.summary }),
      h('div', { className: 'agp-detail-line', text: '📅 ' + fullDate(it.start) }),
      h('div', { className: 'agp-detail-line', text: '🕒 ' + rangeLabel(it) + (it.now ? ' · en cours' : '') }),
      it.location ? h('div', { className: 'agp-detail-line', text: '📍 ' + it.location }) : null,
      desc ? h('div', { className: 'agp-detail-desc', text: desc }) : null);
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
