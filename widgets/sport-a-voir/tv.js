import Widget from '../../app/Widget.js';
import { h } from '../../app/dom.js';
import { ListPanel, focusHint } from '../../app/list-panel.js';
import { LEAGUES } from './sports/catalog.js';
import { fetchLeagueSchedule as fetchLoLSchedule, formatMatchDate, formatMatchTime } from './sports/league-of-legends/api.js';
import { fetchEspnSchedule } from './sports/espn/api.js';

export default class SportAvoirWidget extends Widget {
  mount(el, settings) {
    this.settings = settings || {};
    this.selectedLeagues = this.store.get('selectedLeagues', LEAGUES.map((league) => league.id));
    if (!Array.isArray(this.selectedLeagues)) this.selectedLeagues = LEAGUES.map((league) => league.id);
    this.selectedLeagues = this.selectedLeagues.filter((id) => LEAGUES.some((league) => league.id === id));
    if (this.store.get('selectionInitialized', false) !== true) {
      this.selectedLeagues = LEAGUES.map((league) => league.id);
      this.store.set('selectionInitialized', true);
    }
    this.schedules = {};
    this.errors = {};
    this.refreshPromise = null;
    this.list = null;

    this.titleEl = h('div', { className: 'sav-title', text: 'SPORT À VOIR' });
    this.statusEl = h('div', { className: 'sav-status' });
    this.matchesEl = h('div', { className: 'sav-matches' });
    this.metaEl = h('div', { className: 'sav-meta' });
    el.appendChild(h('div', { className: 'sav-inner' },
      h('div', { className: 'sav-head' }, this.titleEl, this.statusEl),
      this.matchesEl, this.metaEl, focusHint('OK : filtrer les ligues')));
    this.render();
    this.refresh().catch((error) => this.showError(error.message || 'Calendriers indisponibles.'));
    this.every((Number(this.settings.refreshMinutes) || 15) * 60 * 1000, () => this.refresh(), { immediate: false });
  }

  saveSelection() {
    this.store.set('selectedLeagues', this.selectedLeagues);
    this.render();
  }

  toggleAll() {
    this.selectedLeagues = this.selectedLeagues.length === LEAGUES.length
      ? [] : LEAGUES.map((league) => league.id);
    this.saveSelection();
    this.refresh().catch(() => {});
    if (this.list) this.list.refresh();
  }

  toggleLeague(id) {
    const index = this.selectedLeagues.indexOf(id);
    if (index === -1) this.selectedLeagues.push(id);
    else this.selectedLeagues.splice(index, 1);
    this.saveSelection();
    this.refresh().catch(() => {});
    if (this.list) this.list.refresh();
  }

  refresh() {
    if (this.refreshPromise) return this.refreshPromise;
    const active = LEAGUES.filter((league) => this.selectedLeagues.indexOf(league.id) !== -1);
    const task = Promise.all(active.map((league) => {
      // Une clé Riot absente ne bloque que les ligues LoL ; les autres sports continuent normalement.
      const request = league.provider === 'lol'
        ? fetchLoLSchedule((url, options) => this.fetchJson(url, options), league, this.settings.apiKey)
        : fetchEspnSchedule((url) => this.fetchJson(url), league);
      return request.then((events) => {
        this.schedules[league.id] = events;
        this.errors[league.id] = '';
        return true;
      }, (error) => {
        this.errors[league.id] = error && error.message ? error.message : 'Erreur inconnue';
        this.schedules[league.id] = [];
        return false;
      });
    })).then(() => {
      this.render();
      if (this.list && this.panelOpen) this.list.refresh();
    });
    const wrapped = task.finally(() => { if (this.refreshPromise === wrapped) this.refreshPromise = null; });
    this.refreshPromise = wrapped;
    return wrapped;
  }

  allEvents() {
    return LEAGUES.filter((league) => this.selectedLeagues.indexOf(league.id) !== -1)
      .reduce((all, league) => all.concat(this.schedules[league.id] || []), [])
      .filter((event) => event.state === 'inProgress' || event.state === 'upcoming' || event.state === 'unstarted')
      .sort((a, b) => {
        if (a.state === 'inProgress' && b.state !== 'inProgress') return -1;
        if (b.state === 'inProgress' && a.state !== 'inProgress') return 1;
        return Date.parse(a.startAt) - Date.parse(b.startAt);
      });
  }

  render() {
    const events = this.allEvents();
    const max = Math.max(1, Math.min(10, Number(this.settings.maxMatches) || 10));
    const selectedCount = this.selectedLeagues.length;
    const liveCount = events.filter((event) => event.state === 'inProgress').length;
    this.statusEl.textContent = liveCount ? liveCount + ' EN DIRECT' : '';
    this.statusEl.className = 'sav-status' + (liveCount ? ' is-live' : '');
    this.matchesEl.innerHTML = '';
    if (!selectedCount) {
      this.matchesEl.appendChild(h('div', { className: 'sav-empty', text: 'Aucune ligue sélectionnée · appuyez sur OK pour filtrer' }));
    } else if (!events.length) {
      const lolSelected = LEAGUES.some((league) => league.provider === 'lol' && this.selectedLeagues.indexOf(league.id) !== -1);
      const hasErrors = this.selectedLeagues.some((id) => this.errors[id]);
      const message = lolSelected && !String(this.settings.apiKey || '').trim() && hasErrors
        ? 'Ajoutez une clé API LoL dans les réglages pour voir League of Legends. Les autres sports restent disponibles.'
        : (hasErrors ? 'Calendriers momentanément indisponibles' : 'Aucun événement programmé pour le moment');
      this.matchesEl.appendChild(h('div', { className: 'sav-empty', text: message }));
    } else {
      events.slice(0, max).forEach((event) => this.matchesEl.appendChild(this.matchCard(event)));
    }
    this.metaEl.textContent = selectedCount + ' / ' + LEAGUES.length + ' ligues actives · ' + Math.min(events.length, max) + ' événements affichés · OK pour filtrer';
  }

  matchCard(event) {
    const live = event.state === 'inProgress';
    const teams = event.teams || [{}, {}];
    const teamLabel = (team) => team.code || team.name || 'À confirmer';
    return h('div', { className: 'sav-match' + (live ? ' is-live' : '') },
      h('div', { className: 'sav-match-time' },
        h('span', { className: 'sav-date', text: (event.sportName || 'Sport') + ' · ' + (event.leagueName || '') }),
        h('span', { className: 'sav-time', text: live ? 'EN DIRECT' : formatMatchDate(Date.parse(event.startAt)) + ' ' + formatMatchTime(Date.parse(event.startAt)) })),
      h('div', { className: 'sav-team' },
        h('span', { className: 'sav-team-code', text: teamLabel(teams[0]) }),
        h('span', { className: 'sav-team-name', text: teams[0].name || 'Équipe à confirmer' })),
      h('div', { className: 'sav-vs', text: 'VS' }),
      h('div', { className: 'sav-team sav-team-right' },
        h('span', { className: 'sav-team-code', text: teamLabel(teams[1]) }),
        h('span', { className: 'sav-team-name', text: teams[1].name || 'Équipe à confirmer' })),
      h('div', { className: 'sav-format', text: event.bestOf ? 'BO' + event.bestOf : '' }));
  }

  onKey(key) {
    if (this.list) return this.list.onKey(key);
    if (key === 'enter') { this.openList(); return true; }
    return false;
  }

  onPanelClose() { this.list = null; }

  openList() {
    this.list = new ListPanel(this, {
      className: 'w-sport-a-voir-panel',
      title: '🏆 Filtrer les ligues',
      tabs: [{ id: 'selection', label: 'Ligues' }],
      rows: () => this.selectionRows(),
      empty: 'Aucune ligue disponible',
      onActivate: (row) => {
        if (row.action === 'all') this.toggleAll();
        else if (row.action === 'league') this.toggleLeague(row.leagueId);
      },
    });
    this.list.showTab(0);
  }

  selectionRows() {
    const all = this.selectedLeagues.length === LEAGUES.length;
    const rows = [{
      key: 'toggle-all',
      action: 'all',
      className: 'sav-select-all',
      el: h('div', { className: 'sav-select-row' },
        h('div', { className: 'sav-select-name', text: all ? '☐ Tout désélectionner' : '☑ Tout sélectionner' }),
        h('div', { className: 'sav-select-state', text: all ? 'Toutes les ligues actives' : this.selectedLeagues.length + ' / ' + LEAGUES.length })),
    }, { header: 'Sélectionner les ligues à afficher' }];
    LEAGUES.forEach((league) => {
      const selected = this.selectedLeagues.indexOf(league.id) !== -1;
      rows.push({
        key: league.id, action: 'league', leagueId: league.id,
        el: h('div', { className: 'sav-select-row' },
          h('div', { className: 'sav-select-name', text: (selected ? '☑ ' : '☐ ') + league.name }),
          h('div', { className: 'sav-select-state', text: league.sportName })),
      });
    });
    return rows;
  }
}
