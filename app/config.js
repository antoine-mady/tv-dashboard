// Logique de config PURE, partagée par l'app TV, la page admin (navigateur) et Node (build/tests).
// Ne rien importer ici.

export const DEFAULT_GRID = { cols: 12, rows: 6 };

function coerce(field, value) {
  switch (field.type) {
    case 'number': {
      const n = Number(value);
      if (value === '' || value === null || isNaN(n)) return field.default;
      let v = n;
      if (typeof field.min === 'number' && v < field.min) v = field.min;
      if (typeof field.max === 'number' && v > field.max) v = field.max;
      return v;
    }
    case 'bool':
      return value === true || value === 'true' || value === 1;
    default:
      return value === undefined || value === null ? '' : String(value);
  }
}

/** Retourne les réglages complets : valeurs par défaut du schéma + valeurs saisies, typées. */
export function applyDefaults(schema, settings) {
  const out = {};
  const src = settings || {};
  (schema || []).forEach((field) => {
    let v = src[field.key];
    if (v === undefined || v === null || (v === '' && field.type !== 'text' && field.type !== 'password')) {
      v = field.default;
    }
    out[field.key] = coerce(field, v === undefined ? '' : v);
  });
  return out;
}

export function rectsOverlap(a, b) {
  return a.col < b.col + b.w && b.col < a.col + a.w && a.row < b.row + b.h && b.row < a.row + a.h;
}

export function fitsInGrid(w, grid) {
  return w.col >= 1 && w.row >= 1 && w.w >= 1 && w.h >= 1 &&
    w.col + w.w - 1 <= grid.cols && w.row + w.h - 1 <= grid.rows;
}

/** Cherche le premier emplacement libre (ligne par ligne) pour un widget de taille w×h. */
export function findFreeSpot(widgets, grid, w, h) {
  for (let row = 1; row + h - 1 <= grid.rows; row++) {
    for (let col = 1; col + w - 1 <= grid.cols; col++) {
      const cand = { col, row, w, h };
      if (!widgets.some((o) => rectsOverlap(cand, o))) return cand;
    }
  }
  return null;
}

/**
 * Pages du dashboard : `config.pages` = [{ id, name, widgets: [...] }].
 * Les anciennes configs (`config.widgets` sans pages) donnent une seule page.
 */
export function getPages(config) {
  if (config && Array.isArray(config.pages) && config.pages.length) {
    return config.pages.map((p, i) => ({
      id: p.id || 'page-' + (i + 1),
      name: p.name || 'Page ' + (i + 1),
      widgets: Array.isArray(p.widgets) ? p.widgets : [],
    }));
  }
  return [{ id: 'page-1', name: 'Principal', widgets: (config && Array.isArray(config.widgets)) ? config.widgets : [] }];
}

/** Copie de la config au format « pages » (migre l'ancien format `widgets`). */
export function normalizeConfig(config) {
  const out = Object.assign({}, config);
  out.pages = getPages(config);
  delete out.widgets;
  return out;
}

/**
 * Valide une config complète. `manifests` : { [type]: manifest }.
 * Retourne une liste d'erreurs { pageId, widgetId, message } (vide si tout va bien).
 */
export function validateConfig(config, manifests) {
  const errors = [];
  const pages = getPages(config);
  const seenPages = {};
  pages.forEach((page) => {
    if (seenPages[page.id]) errors.push({ pageId: page.id, message: 'Id de page en double : ' + page.id });
    seenPages[page.id] = true;
    const prefix = pages.length > 1 ? page.name + ' · ' : '';
    validatePage(page.widgets, config, manifests).forEach((e) => {
      errors.push({ pageId: page.id, widgetId: e.widgetId, message: prefix + e.message });
    });
  });
  return errors;
}

/** Une page : ids uniques, tailles, champs requis, chevauchements. */
function validatePage(widgets, config, manifests) {
  const errors = [];
  const grid = Object.assign({}, DEFAULT_GRID, config && config.grid);
  const seen = {};

  widgets.forEach((w) => {
    const err = (message) => errors.push({ widgetId: w.id, message });
    if (!w.id) err('Widget sans id');
    else if (seen[w.id]) err('Id en double : ' + w.id);
    seen[w.id] = true;

    const manifest = manifests[w.type];
    if (!manifest) { err('Type de widget inconnu : ' + w.type); return; }
    if (!fitsInGrid(w, grid)) err(manifest.name + ' dépasse de la grille');
    const min = (manifest.size && manifest.size.min) || { w: 1, h: 1 };
    if (w.w < min.w || w.h < min.h) err(manifest.name + ' est plus petit que la taille minimale (' + min.w + '×' + min.h + ')');

    const settings = applyDefaults(manifest.schema, w.settings);
    (manifest.schema || []).forEach((f) => {
      if (!f.required) return;
      if (f.when && !Object.keys(f.when).every((k) => settings[k] === f.when[k])) return;
      if (settings[f.key] === '' || settings[f.key] === undefined) err(manifest.name + ' : champ requis « ' + f.label + ' »');
    });
  });

  for (let i = 0; i < widgets.length; i++) {
    for (let j = i + 1; j < widgets.length; j++) {
      if (rectsOverlap(widgets[i], widgets[j])) {
        errors.push({ widgetId: widgets[j].id, message: widgets[i].id + ' et ' + widgets[j].id + ' se chevauchent' });
      }
    }
  }
  return errors;
}
