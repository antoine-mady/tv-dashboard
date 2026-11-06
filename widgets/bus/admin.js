// Assistant de l'admin : chercher l'arrêt, choisir les lignes, (re)télécharger les horaires.
// Les horaires de l'arrêt sont stockés dans le réglage caché `timetable` et embarqués dans le build.

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
  const table = readTable(settings);
  if (table && table.network === settings.network) {
    const names = routeNames(table);
    const wanted = (settings.routes || '').split(/[,;\s]+/).map((s) => s.toLowerCase()).filter(Boolean);
    const status = el('div', { className: 'ext-out' },
      el('p', { className: 'ok', textContent: '✓ ' + table.stopName + ' : ' + table.deps.length + ' passages, horaires valables du '
        + fmtDate(table.start) + ' au ' + fmtDate(table.end) + '.' }),
      el('p', { className: 'help', textContent: 'Lignes à cet arrêt (cliquez pour afficher ou masquer) :' }));
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
  } else if (table) {
    container.append(el('p', { className: 'error', textContent: 'Le réseau a changé : cherchez à nouveau l’arrêt.' }));
  }

  // ---- Recherche d'arrêt
  const input = el('input', { type: 'text', placeholder: 'Nom de l’arrêt, ex. église grands bois', value: settings.stopName || '' });
  const btnSearch = el('button', { type: 'button', className: 'primary', innerHTML: api.iconLabel('search', 'Chercher l’arrêt') });
  const btnUpdate = el('button', { type: 'button', innerHTML: api.iconLabel('refresh', 'Mettre à jour les horaires'), disabled: !settings.stopIds });
  container.append(el('div', { className: 'ext-actions' }, input, btnSearch, btnUpdate), out);

  const choose = async (name, ids) => {
    message('Préparation des horaires de « ' + name + ' »…');
    try {
      const { timetable } = await api.call('timetable?' + qs({ network: settings.network, gtfsUrl: settings.gtfsUrl, ids: ids.join(','), name }));
      onChange({ stopName: timetable.stopName, stopIds: ids.join(','), timetable: JSON.stringify(timetable) });
    } catch (e) {
      message('Erreur : ' + e.message, 'error');
    }
  };

  const search = async () => {
    const q = input.value.trim();
    if (!q) return;
    message('Téléchargement des horaires du réseau et recherche (la première fois, jusqu’à une minute)…');
    try {
      const { stops } = await api.call('stops?' + qs({ network: settings.network, gtfsUrl: settings.gtfsUrl, q }));
      out.innerHTML = '';
      if (!stops.length) { message('Aucun arrêt trouvé. Essayez un seul mot (ex. « grands bois »).', 'error'); return; }
      stops.forEach((s) => out.append(el('div', { className: 'ext-row' },
        el('span', { textContent: s.name + ' — lignes ' + s.routes.join(', ') }),
        el('button', { type: 'button', textContent: 'Choisir', onclick: () => choose(s.name, s.ids) }))));
    } catch (e) {
      message('Erreur : ' + e.message, 'error');
    }
  };
  btnSearch.onclick = search;
  input.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); search(); } };
  btnUpdate.onclick = () => choose(settings.stopName, settings.stopIds.split(','));
}
