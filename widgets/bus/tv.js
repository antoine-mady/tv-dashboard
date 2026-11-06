// Prochains départs à un arrêt : horaires embarqués (préparés par l'admin) + retards GTFS-RT.
import Widget from '../../app/Widget.js';
import { h } from '../../app/dom.js';
import { ListPanel, focusHint } from '../../app/list-panel.js';
import { feedsFor } from './networks.js';
import { decodeFeed } from './gtfsrt.js';
import {
  parseRouteFilter, selectRoutes, scheduledBetween, applyRealtime, pickNext,
  formatWait, formatDelay, relevantAlerts, tableExpired, daysLeft,
  formatClock, endOfTomorrow, departuresByDay,
} from './schedule.js';

const BACK = 60 * 60 * 1000;       // un bus prévu il y a moins d'1 h peut encore passer (retard)
const AHEAD = 6 * 60 * 60 * 1000;  // on cherche les départs des 6 prochaines heures
const STALE = 5 * 60 * 1000;       // au-delà, le temps réel est ignoré

function scopedId(network, id) { return network + '::' + id; }

function scopeRealtimeFeed(feed, network) {
  const trips = {};
  Object.keys(feed.trips || {}).forEach((id) => {
    const trip = Object.assign({}, feed.trips[id], {
      tripId: scopedId(network, feed.trips[id].tripId || id),
      routeId: feed.trips[id].routeId ? scopedId(network, feed.trips[id].routeId) : '',
      stops: (feed.trips[id].stops || []).map((stop) => Object.assign({}, stop, {
        stopId: stop.stopId ? scopedId(network, stop.stopId) : '',
      })),
    });
    trips[scopedId(network, id)] = trip;
  });
  return { timestamp: feed.timestamp, trips, alerts: scopeAlerts(feed.alerts || [], network) };
}

function scopeAlerts(alerts, network) {
  return (alerts || []).map((alert) => Object.assign({}, alert, {
    routes: (alert.routes || []).map((id) => scopedId(network, id)),
    stops: (alert.stops || []).map((id) => scopedId(network, id)),
  }));
}

export default class BusWidget extends Widget {
  mount(el, s) {
    let table = null;
    try { table = s.timetable ? JSON.parse(s.timetable) : null; } catch (e) { table = null; }
    if (!table || !table.deps) throw new Error('Choisissez l’arrêt dans l’admin (recherche d’arrêt du widget)');
    if (table.network && !table.networks && table.network !== s.network) throw new Error('Réseau modifié : choisissez à nouveau l’arrêt dans l’admin');
    this.table = table;

    const sel = selectRoutes(table, parseRouteFilter(s.routes));
    if (!sel.ids.length) {
      const names = Object.keys(table.routes).map((id) => table.routes[id][0]).join(', ');
      throw new Error('Ligne(s) inconnue(s) à cet arrêt : ' + sel.unknown.join(', ') + '. Lignes disponibles : ' + names);
    }
    this.routeIds = sel.ids;
    if (sel.unknown.length) console.warn('Bus : lignes inconnues à cet arrêt : ' + sel.unknown.join(', '));

    this.networkIds = table.networks || [table.network || s.network];
    this.feedsByNetwork = {};
    this.networkIds.forEach((network) => {
      this.feedsByNetwork[network] = feedsFor({
        network,
        gtfsUrl: network === s.network ? s.gtfsUrl : '',
        realtimeUrl: network === s.network ? s.realtimeUrl : '',
      });
    });
    this.rtByNetwork = {};
    this.alertsByNetwork = {};

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
      this.noteEl),
      focusHint('OK : tous les horaires'));

    this.every(15 * 1000, () => this.update());
    if (s.realtime && this.networkIds.some((network) => this.feedsByNetwork[network].tripUpdates || this.feedsByNetwork[network].alerts)) {
      this.every(s.refreshSeconds * 1000, () => this.refreshRealtime());
    }
  }

  /** Le temps réel est facultatif et chargé indépendamment pour chaque réseau configuré. */
  refreshRealtime() {
    const s = this.settings;
    const get = (url) => this.fetch(url).then((r) => r.arrayBuffer()).then((b) => decodeFeed(new Uint8Array(b)));
    const jobs = [];
    this.networkIds.forEach((network) => {
      const feeds = this.feedsByNetwork[network];
      if (feeds.tripUpdates) jobs.push(get(feeds.tripUpdates).then((feed) => {
        this.rtByNetwork[network] = { feed: scopeRealtimeFeed(feed, network), at: Date.now() };
        if (!feeds.alerts) this.alertsByNetwork[network] = scopeAlerts(feed.alerts, network);
      }));
      if (s.showAlerts && feeds.alerts) jobs.push(get(feeds.alerts).then((feed) => {
        this.alertsByNetwork[network] = scopeAlerts(feed.alerts, network);
      }));
    });
    return Promise.all(jobs.map((p) => p.catch((e) => console.warn('Bus, temps réel : ' + e.message))))
      .then(() => this.update());
  }

  update() {
    this.render();
    if (this.list) this.list.refresh();
  }

  /** Départs (temps réel appliqué s'il est récent) entre now - BACK et now + ahead. */
  departures(now, aheadMs) {
    const rt = { trips: {} };
    let liveCount = 0;
    this.networkIds.forEach((network) => {
      const entry = this.rtByNetwork[network];
      if (!entry || now - entry.at >= STALE) return;
      liveCount++;
      Object.assign(rt.trips, entry.feed.trips);
    });
    return { live: liveCount > 0, partial: liveCount < this.networkIds.length, deps: applyRealtime(scheduledBetween(this.table, now, this.routeIds, BACK, aheadMs), liveCount ? rt : null) };
  }

  render() {
    const s = this.settings;
    const now = Date.now();
    const table = this.table;
    if (tableExpired(table, now)) {
      throw new Error('Horaires expirés : dans l’admin, « Mettre à jour les horaires » puis envoyez sur la TV');
    }

    const next = this.departures(now, AHEAD);
    const live = next.live;
    const deps = pickNext(next.deps, now, s.count, s.walkMinutes);

    this.liveEl.className = 'bus-live' + (live ? ' is-on' : '');
    this.liveEl.textContent = live ? (next.partial ? 'temps réel partiel' : 'temps réel') : '';

    this.listEl.innerHTML = '';
    if (!deps.length) {
      this.listEl.appendChild(h('div', { className: 'bus-empty muted', text: 'Aucun départ dans les prochaines heures' }));
    }
    deps.forEach((d) => {
      const r = table.routes[d.route] || [d.route, '', ''];
      const delay = d.live && !d.canceled ? formatDelay(d.delay) : null;
      this.listEl.appendChild(h('div', { className: 'bus-row' + (d.canceled ? ' is-canceled' : '') + (d.live ? ' is-live' : '') },
        h('div', { className: 'bus-line', text: r[0], style: { background: r[1] || '', color: r[1] ? (r[2] || '#FFFFFF') : '' } }),
        h('div', { className: 'bus-dest', text: this.stopAndDestination(d) }),
        delay ? h('div', { className: 'bus-delay' + (d.delay > 90 ? ' is-late' : ''), text: delay }) : null,
        h('div', { className: 'bus-wait', text: d.canceled ? 'supprimé' : formatWait(d.expected, now) })));
    });

    const notes = [];
    if (s.showAlerts) {
      const alerts = [];
      Object.keys(this.alertsByNetwork).forEach((network) => {
        this.alertsByNetwork[network].forEach((alert) => alerts.push(alert));
      });
      relevantAlerts(alerts, table, this.routeIds, now).forEach((a) => notes.push('⚠ ' + a.header));
    }
    const left = daysLeft(table, now);
    if (left <= 7) notes.push('Horaires valables encore ' + left + ' jour(s) : mettez-les à jour dans l’admin');
    this.noteEl.textContent = notes.join('  ·  ');
    this.noteEl.style.display = notes.length ? '' : 'none';
  }

  // ---- Panneau « tous les horaires » (OK sur le widget) : jusqu'à demain soir, une ligne par onglet ----
  onKey(key) {
    if (this.list) return this.list.onKey(key);
    if (key === 'enter') { this.openList(); return true; }
    return false;
  }

  onPanelClose() { this.list = null; }

  routeName(id) { return (this.table.routes[id] || [id])[0]; }
  
  stopAndDestination(departure) {
    const stop = this.table.stopCount > 1 && this.table.stopNames
      ? this.table.stopNames[departure.stopId] : '';
    return stop ? stop + ' · ' + departure.dest : departure.dest;
  }

  openList() {
    const tabs = this.routeIds.length > 1
      ? [{ id: null, label: 'Toutes les lignes' }].concat(this.routeIds.map((id) => ({ id, label: 'Ligne ' + this.routeName(id) })))
      : [];
    this.list = new ListPanel(this, {
      className: 'w-bus-panel',
      title: '🚌 ' + (this.settings.title || this.table.stopName) + ' · tous les horaires',
      tabs,
      tabsHint: 'choisir la ligne',
      rows: (ctx) => this.panelRows(ctx.tab ? ctx.tab.id : null),
      empty: 'Aucun départ d’ici demain soir',
    });
  }

  panelRows(only) {
    const s = this.settings;
    const now = Date.now();
    if (tableExpired(this.table, now)) throw new Error('Horaires expirés : mettez-les à jour dans l’admin');
    const all = this.departures(now, endOfTomorrow(now) - now).deps.filter((d) => !only || d.route === only);
    const deps = pickNext(all, now, Infinity, 0);
    const catchable = now + (s.walkMinutes || 0) * 60 * 1000 - 30 * 1000;
    const rows = [];
    departuresByDay(deps, now).forEach((g) => {
      rows.push({ header: g.label + ' · ' + g.items.length + ' départ' + (g.items.length > 1 ? 's' : '') });
      g.items.forEach((d) => {
        const r = this.table.routes[d.route] || [d.route, '', ''];
        const at = d.canceled ? d.scheduled : d.expected;
        const delay = d.live && !d.canceled ? formatDelay(d.delay) : null;
        const soon = at - now < 60 * 60 * 1000;
        const missed = !d.canceled && at < catchable;
        rows.push({
          key: d.tripId + '|' + d.date,
          className: (d.canceled ? 'is-canceled' : '') + (d.live ? ' is-live' : '') + (missed ? ' is-missed' : ''),
          el: h('div', { className: 'busp-row' },
            h('div', { className: 'busp-time', text: formatClock(at) }),
            h('div', { className: 'busp-line', text: r[0], style: { background: r[1] || '', color: r[1] ? (r[2] || '#FFFFFF') : '' } }),
            h('div', { className: 'busp-dest ellipsis', text: this.stopAndDestination(d) }),
            d.delay && Math.abs(d.delay) >= 60 ? h('div', { className: 'busp-planned', text: 'prévu ' + formatClock(d.scheduled) }) : null,
            delay ? h('div', { className: 'busp-delay' + (d.delay > 90 ? ' is-late' : ''), text: delay }) : null,
            h('div', { className: 'busp-wait', text: d.canceled ? 'supprimé' : missed ? 'trop tard' : soon ? formatWait(at, now) : '' })),
        });
      });
    });
    return rows;
  }
}
