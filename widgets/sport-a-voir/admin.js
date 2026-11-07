import { LEAGUES } from './sports/catalog.js';

function el(tag, props, ...children) {
  const node = document.createElement(tag);
  Object.assign(node, props || {});
  children.forEach((child) => node.append(child));
  return node;
}

function readSelection(settings) {
  const raw = typeof settings.selectedLeagues === 'string'
    ? settings.selectedLeagues.split(',').map((id) => id.trim()).filter(Boolean)
    : LEAGUES.map((league) => league.id);
  return new Set(raw.filter((id) => LEAGUES.some((league) => league.id === id)));
}

function update(onChange, selected) {
  onChange({ selectedLeagues: LEAGUES.filter((league) => selected.has(league.id)).map((league) => league.id).join(',') });
}

export function renderEditor(container, settings, onChange) {
  container.innerHTML = '';
  const selected = readSelection(settings);
  const groups = [];
  LEAGUES.forEach((league) => {
    let group = groups.find((item) => item.id === league.sportId);
    if (!group) {
      group = { id: league.sportId, name: league.sportName, leagues: [] };
      groups.push(group);
    }
    group.leagues.push(league);
  });

  container.append(el('p', {
    className: 'help',
    textContent: 'Choisissez ici les calendriers actifs par défaut. Vous pouvez aussi modifier la sélection depuis le menu du widget sur la TV.',
  }));

  const global = el('div', { className: 'ext-actions' });
  global.append(
    el('button', { type: 'button', textContent: 'Tout sélectionner', onclick: () => update(onChange, new Set(LEAGUES.map((league) => league.id))) }),
    el('button', { type: 'button', textContent: 'Tout désélectionner', onclick: () => update(onChange, new Set()) })
  );
  container.append(global);

  groups.forEach((group, index) => {
    const active = group.leagues.filter((league) => selected.has(league.id)).length;
    const details = el('details', { className: 'sav-admin-sport', open: index === 0 });
    const summary = el('summary', { textContent: group.name + ' · ' + active + ' / ' + group.leagues.length });
    details.append(summary);

    const toggle = el('button', {
      type: 'button',
      textContent: active === group.leagues.length ? 'Tout désélectionner' : 'Tout sélectionner',
      onclick: () => {
        const next = new Set(selected);
        if (active === group.leagues.length) group.leagues.forEach((league) => next.delete(league.id));
        else group.leagues.forEach((league) => next.add(league.id));
        update(onChange, next);
      },
    });
    details.append(el('div', { className: 'ext-actions' }, toggle));

    group.leagues.forEach((league) => {
      const input = el('input', { type: 'checkbox', checked: selected.has(league.id) });
      input.onchange = () => {
        const next = new Set(selected);
        if (input.checked) next.add(league.id);
        else next.delete(league.id);
        update(onChange, next);
      };
      details.append(el('label', { className: 'sav-admin-league' }, input, el('span', { textContent: league.name })));
    });
    container.append(details);
  });
}
