// Prochains départs à un arrêt : horaires embarqués (préparés par l'admin) + retards GTFS-RT.
import Widget from '../../app/Widget.js';
import { h } from '../../app/dom.js';
import { feedsFor } from './networks.js';
import { decodeFeed } from './gtfsrt.js';
import {
  parseRouteFilter, selectRoutes, scheduledBetween, applyRealtime, pickNext,
  formatWait, formatDelay, relevantAlerts, tableExpired, daysLeft,
} from './schedule.js';

const BACK = 60 * 60 * 1000;       // un bus prévu il y a moins d'1 h peut encore passer (retard)
const AHEAD = 6 * 60 * 60 * 1000;  // on cherche les départs des 6 prochaines heures
const STALE = 5 * 60 * 1000;       // au-delà, le temps réel est ignoré

export default class BusWidget extends Widget {
  mount(el, s) {
    let table = null;
    try { table = s.timetable ? JSON.parse(s.timetable) : null; } catch (e) { table = null; }
    if (!table || !table.deps) throw new Error('Choisissez l’arrêt dans l’admin (recherche d’arrêt du widget)');
    if (table.network && table.network !== s.network) throw new Error('Réseau modifié : choisissez à nouveau l’arrêt dans l’admin');
    this.table = table;

    const sel = selectRoutes(table, parseRouteFilter(s.routes));
    if (!sel.ids.length) {
      const names = Object.keys(table.routes).map((id) => table.routes[id][0]).join(', ');
      throw new Error('Ligne(s) inconnue(s) à cet arrêt : ' + sel.unknown.join(', ') + '. Lignes disponibles : ' + names);
    }
    this.routeIds = sel.ids;
    if (sel.unknown.length) console.warn('Bus : lignes inconnues à cet arrêt : ' + sel.unknown.join(', '));

    this.feeds = feedsFor(s);
    this.rt = null;       // dernier flux de retards décodé
    this.rtAt = 0;        // quand il a été reçu
    this.alerts = [];

    this.liveEl = h('div', { className: 'bus-live' });
    this.listEl = h('div', { className: 'bus-list' });
    this.noteEl = h('div', { className: 'bus-note' });
    // Taille du texte selon le nombre de lignes affichées ET la largeur (un grand widget étroit ne doit pas tronquer).
    const size = this.size || { width: 600, height: 300 };
    const base = Math.max(12, Math.min(size.height / (s.count + 1.8) * 0.65, size.width / 15));
    el.appendChild(h('div', { className: 'bus-inner', style: { fontSize: Math.round(base) + 'px' } },
      h('div', { className: 'bus-head' },
        h('div', { className: 'bus-title', text: s.title || table.stopName }),
        this.liveEl),
      this.listEl,
      this.noteEl));

    this.every(15 * 1000, () => this.render());
    if (s.realtime && this.feeds.tripUpdates) {
      this.every(s.refreshSeconds * 1000, () => this.refreshRealtime());
    }
  }

  /** Le temps réel est un bonus : en cas d'échec on garde les horaires prévus, sans état d'erreur. */
  refreshRealtime() {
    const s = this.settings;
    const get = (url) => this.fetch(url).then((r) => r.arrayBuffer()).then((b) => decodeFeed(new Uint8Array(b)));
    const jobs = [get(this.feeds.tripUpdates).then((feed) => {
      this.rt = feed;
      this.rtAt = Date.now();
      if (!this.feeds.alerts) this.alerts = feed.alerts;
    })];
    if (s.showAlerts && this.feeds.alerts) {
      jobs.push(get(this.feeds.alerts).then((feed) => { this.alerts = feed.alerts; }));
    }
    return Promise.all(jobs.map((p) => p.catch((e) => console.warn('Bus, temps réel : ' + e.message))))
      .then(() => this.render());
  }

  render() {
    const s = this.settings;
    const now = Date.now();
    const table = this.table;
    if (tableExpired(table, now)) {
      throw new Error('Horaires expirés : dans l’admin, « Mettre à jour les horaires » puis envoyez sur la TV');
    }

    const live = this.rt && now - this.rtAt < STALE;
    const deps = pickNext(
      applyRealtime(scheduledBetween(table, now, this.routeIds, BACK, AHEAD), live ? this.rt : null),
      now, s.count, s.walkMinutes);

    this.liveEl.className = 'bus-live' + (live ? ' is-on' : '');
    this.liveEl.textContent = live ? 'temps réel' : '';

    this.listEl.innerHTML = '';
    if (!deps.length) {
      this.listEl.appendChild(h('div', { className: 'bus-empty muted', text: 'Aucun départ dans les prochaines heures' }));
    }
    deps.forEach((d) => {
      const r = table.routes[d.route] || [d.route, '', ''];
      const delay = d.live && !d.canceled ? formatDelay(d.delay) : null;
      this.listEl.appendChild(h('div', { className: 'bus-row' + (d.canceled ? ' is-canceled' : '') + (d.live ? ' is-live' : '') },
        h('div', { className: 'bus-line', text: r[0], style: { background: r[1] || '', color: r[1] ? (r[2] || '#FFFFFF') : '' } }),
        h('div', { className: 'bus-dest', text: d.dest }),
        delay ? h('div', { className: 'bus-delay' + (d.delay > 90 ? ' is-late' : ''), text: delay }) : null,
        h('div', { className: 'bus-wait', text: d.canceled ? 'supprimé' : formatWait(d.expected, now) })));
    });

    const notes = [];
    if (s.showAlerts) relevantAlerts(this.alerts, table, this.routeIds, now).forEach((a) => notes.push('⚠ ' + a.header));
    const left = daysLeft(table, now);
    if (left <= 7) notes.push('Horaires valables encore ' + left + ' jour(s) : mettez-les à jour dans l’admin');
    this.noteEl.textContent = notes.join('  ·  ');
    this.noteEl.style.display = notes.length ? '' : 'none';
  }
}
