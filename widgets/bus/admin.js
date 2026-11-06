// Assistant de l'admin : chercher l'arrêt, choisir les lignes, (re)télécharger les horaires.
// Les horaires de chaque arrêt sont embarqués dans la configuration de la TV.
import { NETWORKS } from './networks.js';

function el(tag, props, ...children) {
  const e = document.createElement(tag);
  Object.assign(e, props || {});
  children.forEach((c) => e.append(c));
  return e;
}

function fmtDate(d) {
  return d ? d.slice(6, 8) + '/' + d.slice(4, 6) + '/' + d.slice(0, 4) : '?';
}

function readTable(settings) {
  try { return settings.timetable ? JSON.parse(settings.timetable) : null; } catch (e) { return null; }
}

function readTables(settings) {
  try {
    const saved = settings.stops ? JSON.parse(settings.stops) : [];
    if (Array.isArray(saved) && saved.length) return saved.filter((t) => t && Array.isArray(t.deps));
  } catch (e) { /* ancienne configuration */ }
  const legacy = readTable(settings);
  return legacy ? [legacy] : [];
}

function networkName(id) { return NETWORKS[id] ? NETWORKS[id].name.split(' (')[0] : id; }

function scopedId(network, id) { return network + '::' + id; }

function combineTables(tables, defaultNetwork) {
  if (!tables.length) return null;
  const routes = {};
  const services = {};
  const stopNames = {};
  const stopRoutes = {};
  const allStopRoutes = {};
  const deps = [];
  const stopIds = [];
  const seenRoutes = {};
  const networks = [];
  tables.forEach((t) => {
    const network = t.network || defaultNetwork;
    if (networks.indexOf(network) < 0) networks.push(network);
    const ownRoutes = {};
    Object.keys(t.routes || {}).forEach((id) => {
      const key = scopedId(network, id);
      ownRoutes[id] = key;
      routes[key] = t.routes[id];
    });
    Object.assign(services, Object.keys(t.services || {}).reduce((all, id) => {
      all[scopedId(network, id)] = t.services[id];
      return all;
    }, {}));
    const firstStopRoutes = {};
    Object.keys(ownRoutes).forEach((id) => {
      if (!seenRoutes[ownRoutes[id]]) firstStopRoutes[ownRoutes[id]] = true;
      seenRoutes[ownRoutes[id]] = true;
    });
    (t.stopIds || []).forEach((id) => {
      const key = scopedId(network, id);
      if (stopIds.indexOf(key) < 0) stopIds.push(key);
      stopNames[key] = networkName(network) + ' · ' + t.stopName;
      stopRoutes[key] = Object.keys(firstStopRoutes);
      allStopRoutes[key] = Object.keys(ownRoutes).map((id) => ownRoutes[id]);
    });
    (t.deps || []).forEach((dep) => {
      const route = scopedId(network, dep[1]);
      if (!firstStopRoutes[route]) return;
      deps.push([dep[0], route, dep[2], scopedId(network, dep[3]), scopedId(network, dep[4]), dep[5], scopedId(network, dep[6])]);
    });
  });
  deps.sort((a, b) => a[0] - b[0] || String(a[1]).localeCompare(String(b[1])));
  const starts = tables.map((t) => t.start).filter(Boolean).sort();
  const ends = tables.map((t) => t.end).filter(Boolean).sort();
  return {
    v: 1, networks, stopName: tables.map((t) => networkName(t.network || defaultNetwork) + ' · ' + t.stopName).join(' / '),
    stopNames, stopRoutes, allStopRoutes, stopIds, stopCount: tables.length,
    generated: new Date().toISOString(), start: starts[0] || '', end: ends[0] || '',
    routes, services, deps,
  };
}

function routeNames(table) {
  return Object.keys(table.routes).map((id) => table.routes[id][0])
    .sort((a, b) => a.localeCompare(b, 'fr', { numeric: true }));
}

export function renderEditor(container, settings, onChange, api) {
  container.innerHTML = '';
  const out = el('div', { className: 'ext-out' });
  const message = (text, cls) => { out.innerHTML = ''; out.append(el('p', { className: cls || 'help', textContent: text })); };
  const qs = (params) => Object.keys(params).filter((k) => params[k])
    .map((k) => k + '=' + encodeURIComponent(params[k])).join('&');

  // ---- État actuel
  const tables = readTables(settings);
  const table = combineTables(tables, settings.network);
  if (tables.length && table) {
    const names = routeNames(table);
    const wanted = (settings.routes || '').split(/[,;\s]+/).map((s) => s.toLowerCase()).filter(Boolean);
    const status = el('div', { className: 'ext-out' },
      el('p', { className: 'ok', textContent: '✓ ' + tables.length + ' arrêt' + (tables.length > 1 ? 's' : '') + ' configuré' + (tables.length > 1 ? 's' : '') + ' · horaires valables du '
        + fmtDate(table.start) + ' au ' + fmtDate(table.end) + '.' }),
      el('p', { className: 'help', textContent: 'Arrêts enregistrés :' }));
    tables.forEach((t, index) => {
      status.append(el('div', { className: 'ext-row' },
        el('span', { textContent: networkName(t.network || settings.network) + ' · ' + t.stopName + ' · ' + t.deps.length + ' passages · lignes : ' + routeNames(t).join(', ') }),
        el('button', { type: 'button', textContent: 'Actualiser', onclick: () => choose(t.stopName, t.stopIds, t.network || settings.network, index) }),
        el('button', { type: 'button', textContent: 'Retirer', onclick: () => saveTables(tables.filter((_, i) => i !== index)) })));
    });
    status.append(el('p', { className: 'help', textContent: 'Toutes les lignes de chaque arrêt sont listées. Si une même ligne passe par plusieurs arrêts du même réseau, ses départs sont pris au premier arrêt de la liste.' }));
    status.append(el('p', { className: 'help', textContent: 'Lignes à afficher :' }));
    const chips = el('div', { className: 'ext-actions' });
    names.forEach((n) => {
      const on = !wanted.length || wanted.indexOf(n.toLowerCase()) >= 0;
      chips.append(el('button', { type: 'button', className: on ? 'primary' : '', innerHTML: on ? api.iconLabel('check', n) : api.iconLabel('plus', n), onclick: () => {
        const current = wanted.length ? names.filter((x) => wanted.indexOf(x.toLowerCase()) >= 0) : names.slice();
        const next = on ? current.filter((x) => x !== n) : current.concat([n]);
        onChange({ routes: next.length === names.length || !next.length ? '' : next.join(', ') });
      } }));
    });
    status.append(chips);
    container.append(status);
  }

  // ---- Recherche d'arrêt
  const networkSelect = el('select', {});
  networkSelect.setAttribute('aria-label', 'Réseau des arrêts à rechercher');
  Object.keys(NETWORKS).forEach((id) => networkSelect.append(new Option(NETWORKS[id].name, id, false, id === settings.network)));
  const input = el('input', { type: 'text', placeholder: 'Nom de l’arrêt, ex. église grands bois', value: '' });
  const btnSearch = el('button', { type: 'button', className: 'primary', innerHTML: api.iconLabel('search', 'Chercher l’arrêt') });
  const btnUpdate = el('button', { type: 'button', innerHTML: api.iconLabel('refresh', 'Mettre à jour les horaires'), disabled: !tables.length && !settings.stopIds });
  container.append(el('div', { className: 'ext-actions' }, networkSelect, input, btnSearch, btnUpdate), out);

  const saveTables = (next, selectedNetwork) => {
    const defaultNetwork = selectedNetwork || settings.network || networkSelect.value;
    const merged = combineTables(next, defaultNetwork);
    onChange({
      network: defaultNetwork,
      stops: JSON.stringify(next),
      stopName: merged ? merged.stopName : '',
      stopIds: merged ? merged.stopIds.join(',') : '',
      timetable: merged ? JSON.stringify(merged) : '',
    });
  };

  const choose = async (name, ids, network, replaceIndex) => {
    message('Préparation des horaires de « ' + name + ' »…');
    try {
      const { timetable } = await api.call('timetable?' + qs({ network, gtfsUrl: network === settings.network ? settings.gtfsUrl : '', ids: ids.join(','), name }));
      const next = tables.slice();
      const existing = next.findIndex((t) => (t.network || settings.network) === network && (t.stopIds || []).some((id) => ids.indexOf(id) >= 0));
      const index = replaceIndex === undefined ? existing : replaceIndex;
      if (index >= 0) next[index] = timetable;
      else next.push(timetable);
      saveTables(next, network);
    } catch (e) {
      message('Erreur : ' + e.message, 'error');
    }
  };

  let searchTimer = null;
  let searchGeneration = 0;
  out.setAttribute('aria-live', 'polite');
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-controls', 'bus-stop-suggestions');
  input.setAttribute('aria-expanded', 'false');

  const search = async (generation) => {
    const q = input.value.trim();
    const current = generation === undefined ? ++searchGeneration : generation;
    if (q.length < 2) {
      out.innerHTML = '';
      input.setAttribute('aria-expanded', 'false');
      if (q) message('Saisissez au moins 2 caractères pour rechercher.');
      return;
    }
    message('Recherche des arrêts sur ' + networkName(networkSelect.value) + '… (la première fois, le téléchargement peut prendre jusqu’à une minute)');
    try {
      const { stops } = await api.call('stops?' + qs({ network: networkSelect.value, gtfsUrl: networkSelect.value === settings.network ? settings.gtfsUrl : '', q }));
      if (current !== searchGeneration) return;
      out.innerHTML = '';
      if (!stops.length) {
        input.setAttribute('aria-expanded', 'false');
        message('Aucun arrêt trouvé. Essayez un autre nom.');
        return;
      }
      const list = el('div', { id: 'bus-stop-suggestions', className: 'ext-suggestions' });
      list.setAttribute('role', 'listbox');
      stops.forEach((stop) => {
        const button = el('button', {
          type: 'button',
          textContent: stop.name + ' — lignes ' + stop.routes.join(', '),
          onclick: () => {
            clearTimeout(searchTimer);
            searchGeneration++;
            choose(stop.name, stop.ids, networkSelect.value);
          },
        });
        button.setAttribute('role', 'option');
        button.setAttribute('aria-selected', 'false');
        button.setAttribute('aria-label', stop.name + ' — lignes ' + stop.routes.join(', ') + ' — choisir');
        button.onkeydown = (e) => {
          const options = Array.from(list.querySelectorAll('[role="option"]'));
          const i = options.indexOf(button);
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            options[(i + (e.key === 'ArrowDown' ? 1 : options.length - 1)) % options.length].focus();
          } else if (e.key === 'Escape') {
            out.innerHTML = '';
            input.setAttribute('aria-expanded', 'false');
            input.focus();
          }
        };
        list.append(button);
      });
      out.append(list);
      input.setAttribute('aria-expanded', 'true');
    } catch (e) {
      if (current !== searchGeneration) return;
      input.setAttribute('aria-expanded', 'false');
      message('Erreur : ' + e.message, 'error');
    }
  };

  const scheduleSearch = () => {
    clearTimeout(searchTimer);
    out.innerHTML = '';
    input.setAttribute('aria-expanded', 'false');
    const generation = ++searchGeneration;
    if (input.value.trim().length < 2) {
      out.innerHTML = '';
      input.setAttribute('aria-expanded', 'false');
      return;
    }
    searchTimer = setTimeout(() => search(generation), 350);
  };

  btnSearch.onclick = () => search();
  networkSelect.onchange = scheduleSearch;
  input.oninput = scheduleSearch;
  input.onkeydown = (e) => {
    if (e.key === 'ArrowDown') {
      const first = out.querySelector('[role="option"]');
      if (first) { e.preventDefault(); first.focus(); }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const first = out.querySelector('[role="option"]');
      if (first) first.click();
      else search();
    } else if (e.key === 'Escape') {
      clearTimeout(searchTimer);
      searchGeneration++;
      out.innerHTML = '';
      input.setAttribute('aria-expanded', 'false');
    }
  };
  btnUpdate.onclick = async () => {
    message('Mise à jour des horaires de tous les arrêts…');
    try {
      const next = [];
      for (const t of tables) {
        const { timetable } = await api.call('timetable?' + qs({ network: t.network || settings.network, gtfsUrl: (t.network || settings.network) === settings.network ? settings.gtfsUrl : '', ids: t.stopIds.join(','), name: t.stopName }));
        next.push(timetable);
      }
      saveTables(next);
    } catch (e) {
      message('Erreur : ' + e.message, 'error');
    }
  };
}
