import Widget from '../../app/Widget.js';
import { h } from '../../app/dom.js';
import { ListPanel, focusHint } from '../../app/list-panel.js';
import { LEAGUES, leagueById } from './sports/league-of-legends/index.js';
import { fetchLeagueSchedule, formatMatchDate, formatMatchTime } from './sports/league-of-legends/api.js';

export default class SportAvoirWidget extends Widget {
  mount(el, settings) {
    this.settings = settings;
    this.activeLeague = leagueById(settings.defaultLeague || 'lec').id;
    this.schedules = {};
    this.errors = {};
    this.refreshPromise = null;
    this.list = null;

    this.titleEl = h('div', { className: 'sav-title' });
    this.statusEl = h('div', { className: 'sav-status' });
    this.matchesEl = h('div', { className: 'sav-matches' });
    this.metaEl = h('div', { className: 'sav-meta' });

    el.appendChild(h('div', { className: 'sav-inner' },
      h('div', { className: 'sav-head' }, this.titleEl, this.statusEl),
      this.matchesEl,
      this.metaEl,
      focusHint('OK : tous les matchs')));

    this.render();
    // Le premier chargement est explicite ; le timer ne doit pas le déclencher une seconde fois.
    this.refresh().catch((error) => this.showError(error.message || 'Calendrier indisponible.'));
    this.every((Number(settings.refreshMinutes) || 15) * 60 * 1000, () => this.refresh(), { immediate: false });
  }

  refresh() {
    if (this.refreshPromise) return this.refreshPromise;

    const task = Promise.all(LEAGUES.map((league) => {
      return fetchLeagueSchedule(
        (url, options) => this.fetchJson(url, options),
        league,
        this.settings.apiKey
      ).then((events) => {
        this.schedules[league.id] = events;
        this.errors[league.id] = '';
        return { ok: true };
      }, (error) => {
        this.errors[league.id] = error && error.message ? error.message : 'Erreur inconnue';
        return { ok: false };
      });
    })).then((results) => {
      this.render();
      if (this.list && this.panelOpen) this.list.refresh();
      if (!results.some((result) => result.ok)) {
        throw new Error('Impossible de récupérer les calendriers LEC et Worlds. Vérifiez la clé API et la connexion réseau.');
      }
    });

    const wrapped = task.finally(() => {
      if (this.refreshPromise === wrapped) this.refreshPromise = null;
    });
    this.refreshPromise = wrapped;
    return wrapped;
  }

  currentLeague() {
    return leagueById(this.activeLeague);
  }

  currentEvents() {
    return this.schedules[this.activeLeague] || [];
  }

  render() {
    const league = this.currentLeague();
    const events = this.currentEvents();
    const max = Math.max(1, Math.min(6, Number(this.settings.maxMatches) || 4));

    this.titleEl.textContent = league.name;
    this.statusEl.textContent = this.errors[league.id]
      ? 'Calendrier indisponible'
      : (events.some((event) => event.state === 'inProgress') ? 'EN DIRECT' : '');
    this.statusEl.className = 'sav-status' + (this.statusEl.textContent === 'EN DIRECT' ? ' is-live' : '');

    this.matchesEl.innerHTML = '';
    if (this.errors[league.id] && !events.length) {
      this.matchesEl.appendChild(h('div', { className: 'sav-empty', text: 'Erreur de chargement · vérifiez la clé API' }));
    } else if (!events.length) {
      this.matchesEl.appendChild(h('div', { className: 'sav-empty', text: 'Aucun match programmé pour le moment' }));
    } else {
      events.slice(0, max).forEach((event) => this.matchesEl.appendChild(this.matchCard(event)));
    }

    const other = LEAGUES.filter((item) => item.id !== league.id)[0];
    const otherCount = (this.schedules[other.id] || []).length;
    this.metaEl.textContent = other.name + (this.errors[other.id] ? ' · indisponible' : ' · ' + otherCount + ' match(s)');
  }

  matchCard(event) {
    const live = event.state === 'inProgress';
    const teams = event.teams;
    const teamLabel = (team) => team.code || team.name || 'TBD';
    return h('div', { className: 'sav-match' + (live ? ' is-live' : '') },
      h('div', { className: 'sav-match-time' },
        h('span', { className: 'sav-date', text: live ? 'EN DIRECT' : formatMatchDate(event.startAt) }),
        h('span', { className: 'sav-time', text: live ? 'LIVE' : formatMatchTime(event.startAt) })),
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
    if (key === 'left' || key === 'right') {
      const index = LEAGUES.findIndex((league) => league.id === this.activeLeague);
      const delta = key === 'right' ? 1 : -1;
      this.activeLeague = LEAGUES[(index + delta + LEAGUES.length) % LEAGUES.length].id;
      this.render();
      return true;
    }
    if (key === 'enter') {
      this.openList();
      return true;
    }
    return false;
  }

  onPanelClose() {
    this.list = null;
  }

  openList() {
    const league = this.currentLeague();
    this.list = new ListPanel(this, {
      className: 'w-sport-a-voir-panel',
      title: '🏆 ' + league.name + ' · calendrier',
      tabs: LEAGUES.map((item) => ({ id: item.id, label: item.name })),
      tabsHint: 'changer de compétition',
      rows: (ctx) => this.panelRows(ctx.tab ? ctx.tab.id : this.activeLeague),
      empty: () => this.errors[this.activeLeague] || 'Aucun match à venir',
    });
    this.list.showTab(LEAGUES.findIndex((item) => item.id === this.activeLeague));
  }

  panelRows(leagueId) {
    const events = this.schedules[leagueId] || [];
    const rows = [];
    let lastDay = '';
    events.forEach((event) => {
      const day = formatMatchDate(event.startAt);
      if (day !== lastDay) {
        rows.push({ header: day });
        lastDay = day;
      }
      const live = event.state === 'inProgress';
      rows.push({
        key: event.id,
        className: live ? 'sav-panel-live' : '',
        el: h('div', { className: 'sav-panel-row' },
          h('div', { className: 'sav-panel-time', text: live ? 'LIVE' : formatMatchTime(event.startAt) }),
          h('div', { className: 'sav-panel-teams' },
            h('div', { text: event.teams[0].name || 'Équipe à confirmer' }),
            h('div', { className: 'sav-panel-vs', text: 'contre' }),
            h('div', { text: event.teams[1].name || 'Équipe à confirmer' })),
          h('div', { className: 'sav-panel-bo', text: event.bestOf ? 'BO' + event.bestOf : '' })),
      });
    });
    return rows;
  }
}
