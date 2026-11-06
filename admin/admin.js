// Page d'admin : édition de config/dashboard.json + aperçu + envoi sur la TV.
// Aucun code spécifique à un widget ici : tout vient des manifest.js (et admin.js optionnels).
import { applyDefaults, validateConfig, rectsOverlap, fitsInGrid, findFreeSpot, normalizeConfig, DEFAULT_GRID } from '/app/config.js';
import GLOBAL_SCHEMA from '/app/global-schema.js';
import { renderForm } from '/admin/form.js';
import { createHistory } from '/admin/history.js';
import { gridGeometry, STAGE_W, STAGE_H } from '/app/grid.js';

const $ = (sel) => document.querySelector(sel);
const state = {
  config: null,
  widgets: {},       // type → { manifest, admin }
  selected: null,    // id du widget sélectionné, null = réglages généraux
  page: null,        // id de la page en cours d'édition
  mode: 'layout',    // 'layout' = disposer les widgets sur l'écran, 'test' = piloter l'aperçu
  renaming: null,    // id de la page dont le nom est en cours de modification
  drawer: false,     // panneau de réglages (à droite) ouvert
};

function grid() { return Object.assign({}, DEFAULT_GRID, state.config.grid); }
function manifestsMap() { return Object.fromEntries(Object.entries(state.widgets).map(([t, w]) => [t, w.manifest])); }
function currentPage() { return state.config.pages.find((p) => p.id === state.page) || state.config.pages[0]; }
function pageWidgets() { return currentPage().widgets; }
function findWidget(id) { return pageWidgets().find((w) => w.id === id); }
function allWidgets() { return [].concat(...state.config.pages.map((p) => p.widgets)); }

// ---- Sauvegarde + aperçu ---------------------------------------------------------

let saveTimer = null;
let previewTimer = null;

function setStatus(text, cls) {
  const s = $('#status');
  s.textContent = text;
  s.className = 'status ' + (cls || '');
}

/**
 * À appeler après chaque modification de state.config : enregistre (avec un petit délai) et ajoute une
 * étape à l'historique. `mergeKey` : les modifications rapprochées d'un même élément (frappe dans un champ,
 * flèches) ne forment qu'une seule étape d'annulation.
 */
function scheduleSave(mergeKey) {
  setStatus('Modifications…', 'pending');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 400);
  if (hist) hist.commit(JSON.stringify(state.config), mergeKey);
  updateHistoryButtons();
  renderErrors();
}

// ---- Annuler / Rétablir --------------------------------------------------------------

let hist = null;

function updateHistoryButtons() {
  $('#btn-undo').disabled = !hist || !hist.canUndo();
  $('#btn-redo').disabled = !hist || !hist.canRedo();
}

function restore(snap, label) {
  if (snap === null) return;
  const pageBefore = state.page;
  state.config = JSON.parse(snap);
  if (!state.config.pages.some((p) => p.id === state.page)) state.page = state.config.pages[0].id;
  if (state.selected && !findWidget(state.selected)) closeDrawer();
  setStatus(label, 'pending');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 400);
  updateHistoryButtons();
  renderAll();
  if (state.page !== pageBefore) reloadPreview();
}

function undo() { if (hist) restore(hist.undo(), 'Annulé'); }
function redo() { if (hist) restore(hist.redo(), 'Rétabli'); }

// ---- Notifications (remplacent alert / confirm) ------------------------------------

/**
 * Petit message en bas de l'écran. `opts.action` = { label, fn } (ex. « Annuler ») ;
 * `opts.kind` = 'warn' | 'error' ; disparaît tout seul.
 */
function notify(message, opts) {
  const o = opts || {};
  const box = document.createElement('div');
  box.className = 'toast' + (o.kind ? ' toast-' + o.kind : '');
  box.setAttribute('role', o.kind ? 'alert' : 'status');
  const text = document.createElement('span');
  text.textContent = message;
  box.append(text);
  const close = () => {
    if (box.classList.contains('leaving')) return;
    box.classList.add('leaving');
    setTimeout(() => box.remove(), 200);
  };
  if (o.action) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = o.action.label;
    b.onclick = () => { o.action.fn(); close(); };
    box.append(b);
  }
  const x = document.createElement('button');
  x.type = 'button';
  x.className = 'ghost toast-close';
  x.title = 'Fermer';
  x.textContent = '✕';
  x.onclick = close;
  box.append(x);
  const stack = $('#toasts');
  // Une boîte de dialogue modale passe au-dessus de tout : les notifications vont dedans le temps qu'elle est ouverte.
  const host = document.querySelector('dialog[open]') || document.body;
  if (stack.parentNode !== host) host.append(stack);
  stack.append(box);
  // Pas plus de 3 notifications à la fois : les plus anciennes partent.
  const shown = stack.querySelectorAll('.toast:not(.leaving)');
  for (let i = 0; i < shown.length - 3; i++) shown[i].querySelector('.toast-close').click();
  setTimeout(close, o.duration || (o.action ? 7000 : 4000));
}

/** Notification « … · Annuler » juste après une modification : n'annule que si rien n'a changé depuis. */
function notifyUndoable(message) {
  const at = hist.index;
  notify(message, { action: { label: 'Annuler', fn: () => { if (hist.index === at) undo(); } } });
}

async function save() {
  try {
    const r = await fetch('/api/config', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(state.config) });
    if (!r.ok) throw new Error((await r.json()).error);
    setStatus('Enregistré', 'ok');
    clearTimeout(previewTimer);
    previewTimer = setTimeout(reloadPreview, 300);
  } catch (e) {
    setStatus('Erreur : ' + e.message, 'error');
  }
}

function reloadPreview() {
  $('#preview').src = '/preview/?t=' + Date.now() + '&page=' + encodeURIComponent(currentPage().id);
}

function fitPreview() {
  $('#preview').style.transform = 'scale(' + $('#screen').clientWidth / STAGE_W + ')';
}

// ---- Éditeur de disposition (posé sur l'aperçu, aux positions exactes de la TV) -------------

function globalSettings() { return applyDefaults(GLOBAL_SCHEMA, state.config.global); }

function geometry() {
  const gl = globalSettings();
  return gridGeometry(grid(), gl.padding, gl.gap);
}

function placeBox(box, w, geo) {
  const r = (geo || geometry()).rect(w);
  box.style.left = (r.left / STAGE_W * 100) + '%';
  box.style.top = (r.top / STAGE_H * 100) + '%';
  box.style.width = (r.width / STAGE_W * 100) + '%';
  box.style.height = (r.height / STAGE_H * 100) + '%';
}

/** Position du pointeur en cases (fractionnaires, 0 = bord gauche / haut de la grille). */
function pointerCells(clientX, clientY) {
  const geo = geometry();
  const rect = $('#editor').getBoundingClientRect();
  const sx = (clientX - rect.left) / rect.width * STAGE_W;
  const sy = (clientY - rect.top) / rect.height * STAGE_H;
  return { x: (sx - geo.pad + geo.gap / 2) / (geo.colW + geo.gap), y: (sy - geo.pad + geo.gap / 2) / (geo.rowH + geo.gap) };
}

function isFree(candidate, ignoreId) {
  return fitsInGrid(candidate, grid()) && !pageWidgets().some((o) => o.id !== ignoreId && rectsOverlap(candidate, o));
}

/** Nombre de réglages à compléter par widget de la page affichée. */
function errorsByWidget() {
  const out = {};
  validateConfig(state.config, manifestsMap()).forEach((e) => {
    if (e.widgetId && e.pageId === currentPage().id) out[e.widgetId] = (out[e.widgetId] || 0) + 1;
  });
  return out;
}

function renderEditor() {
  const editor = $('#editor');
  const g = grid();
  const geo = geometry();
  const problems = errorsByWidget();
  editor.innerHTML = '';

  // Emplacements de la grille : visibles pendant un déplacement.
  const slots = document.createElement('div');
  slots.className = 'slots';
  for (let row = 1; row <= g.rows; row++) {
    for (let col = 1; col <= g.cols; col++) {
      const slot = document.createElement('div');
      slot.className = 'slot';
      placeBox(slot, { col, row, w: 1, h: 1 }, geo);
      slots.append(slot);
    }
  }
  editor.append(slots);

  if (!pageWidgets().length) {
    const empty = document.createElement('div');
    empty.className = 'editor-empty';
    empty.innerHTML = '<strong>Page vide</strong><span>Glissez un widget depuis la liste de gauche, ou cliquez dessus.</span>';
    editor.append(empty);
  }

  pageWidgets().forEach((w) => {
    const info = state.widgets[w.type];
    const m = info ? info.manifest : { name: w.type + ' (inconnu)', icon: '❓', size: { min: { w: 1, h: 1 } } };
    const box = document.createElement('div');
    box.className = 'box' + (w.id === state.selected ? ' selected' : '') + (problems[w.id] ? ' has-problem' : '');
    box.dataset.id = w.id;
    box.innerHTML = '<div class="box-chip"><span class="box-icon"></span><span class="box-name"></span><span class="box-size"></span></div>'
      + '<div class="box-problem" hidden></div><div class="resize" title="Redimensionner"></div>';
    box.querySelector('.box-icon').textContent = m.icon;
    box.querySelector('.box-name').textContent = m.name;
    box.querySelector('.box-size').textContent = w.w + '×' + w.h;
    if (problems[w.id]) {
      const pb = box.querySelector('.box-problem');
      pb.hidden = false;
      pb.textContent = '⚠ ' + problems[w.id] + ' réglage' + (problems[w.id] > 1 ? 's' : '') + ' à compléter';
    }
    placeBox(box, w, geo);
    editor.append(box);

    box.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      // Le focus quitte le champ de l'inspecteur : les flèches du clavier déplacent alors le widget.
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      select(w.id);
      const resizing = e.target.classList.contains('resize');
      const rect = editor.getBoundingClientRect();
      const cw = (geo.colW + geo.gap) / STAGE_W * rect.width;  // pas d'une case, en px de l'écran
      const ch = (geo.rowH + geo.gap) / STAGE_H * rect.height;
      const start = { x: e.clientX, y: e.clientY, col: w.col, row: w.row, w: w.w, h: w.h };
      const min = (m.size && m.size.min) || { w: 1, h: 1 };
      let candidate = null;
      const liveBox = box;
      liveBox.setPointerCapture(e.pointerId);
      liveBox.classList.add('dragging');
      editor.classList.add('is-dragging');

      const move = (ev) => {
        const dc = Math.round((ev.clientX - start.x) / cw);
        const dr = Math.round((ev.clientY - start.y) / ch);
        candidate = Object.assign({}, w, resizing
          ? { w: Math.max(min.w, Math.min(g.cols - w.col + 1, start.w + dc)), h: Math.max(min.h, Math.min(g.rows - w.row + 1, start.h + dr)) }
          : { col: Math.max(1, Math.min(g.cols - w.w + 1, start.col + dc)), row: Math.max(1, Math.min(g.rows - w.h + 1, start.row + dr)) });
        placeBox(liveBox, candidate, geo);
        liveBox.querySelector('.box-size').textContent = candidate.w + '×' + candidate.h;
        liveBox.classList.toggle('invalid', !isFree(candidate, w.id));
      };
      const up = () => {
        liveBox.removeEventListener('pointermove', move);
        liveBox.removeEventListener('pointerup', up);
        liveBox.removeEventListener('pointercancel', up);
        editor.classList.remove('is-dragging');
        if (candidate && isFree(candidate, w.id) &&
            (candidate.col !== w.col || candidate.row !== w.row || candidate.w !== w.w || candidate.h !== w.h)) {
          Object.assign(w, { col: candidate.col, row: candidate.row, w: candidate.w, h: candidate.h });
          scheduleSave();
        } else if (candidate && !isFree(candidate, w.id)) {
          notify('Cette place est déjà prise : le widget reste où il était.', { kind: 'warn' });
        }
        renderAll();
      };
      liveBox.addEventListener('pointermove', move);
      liveBox.addEventListener('pointerup', up);
      liveBox.addEventListener('pointercancel', up);
    });
  });
}

// ---- Mode de l'écran : disposer / tester ---------------------------------------------------

function setMode(mode) {
  state.mode = mode === 'test' ? 'test' : 'layout';
  if (state.mode === 'test') closeDrawer();
  try { localStorage.setItem('tvdash-admin-mode', state.mode); } catch (e) { /* stockage indisponible */ }
  document.body.classList.toggle('is-testing', state.mode === 'test');
  document.querySelectorAll('.mode-switch [data-mode]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.mode === state.mode)));
  $('#deck-layout').hidden = state.mode === 'test';
  $('#deck-test').hidden = state.mode !== 'test';
}

// ---- Panneau de réglages (droite) et liste des widgets (gauche) ---------------------------

/** Ouvre le panneau de réglages ; `focus` : place le focus dedans (ouverture au clavier / bouton). */
function openDrawer(focus) {
  state.drawer = true;
  const d = $('#drawer');
  d.inert = false;
  document.body.classList.add('drawer-open');
  if (focus) setTimeout(() => $('#drawer-close').focus(), 0);
}

/** Ferme le panneau et désélectionne le widget. */
function closeDrawer() {
  if (!state.drawer && !state.selected) return;
  const d = $('#drawer');
  if (d.contains(document.activeElement)) document.activeElement.blur();
  state.drawer = false;
  d.inert = true;
  document.body.classList.remove('drawer-open');
  if (state.selected) {
    state.selected = null;
    document.querySelectorAll('#editor .box.selected').forEach((b) => b.classList.remove('selected'));
    renderLibrary();
    renderInspector();
  }
}

function toggleGlobalSettings() {
  if (state.drawer && !state.selected) return closeDrawer();
  select(null);
  openDrawer(true);
}

function setRailPinned(on) {
  document.body.classList.toggle('rail-pinned', on);
  $('#rail-pin').setAttribute('aria-pressed', String(on));
  $('#rail-pin').textContent = on ? '«' : '»';
  $('#rail-pin').title = on ? 'Réduire la liste' : 'Garder la liste ouverte';
  try { localStorage.setItem('tvdash-admin-rail', on ? '1' : '0'); } catch (e) { /* stockage indisponible */ }
}

// ---- Glisser-déposer depuis la bibliothèque ---------------------------------------------

const drag = { type: null, ghost: null, spot: null };

/**
 * Place visée sous le pointeur : parmi les positions qui recouvrent la case survolée, la place libre dont
 * le centre est le plus proche du pointeur (taille par défaut, sinon minimale).
 */
function dropSpot(type, clientX, clientY) {
  const g = grid();
  const { x, y } = pointerCells(clientX, clientY);
  const pc = Math.min(g.cols, Math.max(1, Math.floor(x) + 1));
  const pr = Math.min(g.rows, Math.max(1, Math.floor(y) + 1));
  const { def, min } = widgetSizes(type);
  const clampAt = (size, col, row) => ({
    col: Math.max(1, Math.min(g.cols - size.w + 1, col)),
    row: Math.max(1, Math.min(g.rows - size.h + 1, row)),
    w: size.w, h: size.h,
  });
  for (const size of [def, min]) {
    let best = null;
    let bestDist = Infinity;
    for (let row = pr - size.h + 1; row <= pr; row++) {
      for (let col = pc - size.w + 1; col <= pc; col++) {
        const c = clampAt(size, col, row);
        if (!isFree(c)) continue;
        const d = Math.pow(c.col - 1 + c.w / 2 - x, 2) + Math.pow(c.row - 1 + c.h / 2 - y, 2);
        if (d < bestDist) { bestDist = d; best = c; }
      }
    }
    if (best) return { spot: best, ok: true };
  }
  return { spot: clampAt(def, pc - Math.floor((def.w - 1) / 2), pr - Math.floor((def.h - 1) / 2)), ok: false };
}

function showGhost(type, target) {
  const editor = $('#editor');
  if (!drag.ghost) {
    const m = state.widgets[type].manifest;
    drag.ghost = document.createElement('div');
    drag.ghost.className = 'box ghost';
    drag.ghost.innerHTML = '<div class="box-chip"><span class="box-icon"></span><span class="box-name"></span><span class="box-size"></span></div>';
    drag.ghost.querySelector('.box-icon').textContent = m.icon;
    drag.ghost.querySelector('.box-name').textContent = m.name;
  }
  if (drag.ghost.parentNode !== editor) editor.append(drag.ghost);
  placeBox(drag.ghost, target.spot);
  drag.ghost.querySelector('.box-size').textContent = target.ok ? target.spot.w + '×' + target.spot.h : 'pas de place';
  drag.ghost.classList.toggle('invalid', !target.ok);
}

function hideGhost() {
  if (drag.ghost) drag.ghost.remove();
  drag.ghost = null;
  drag.spot = null;
}

function endLibraryDrag() {
  hideGhost();
  drag.type = null;
  $('#editor').classList.remove('is-dragging');
}

function initLibraryDrop() {
  const editor = $('#editor');
  editor.addEventListener('dragover', (e) => {
    if (!drag.type) return;
    e.preventDefault();
    if (state.mode !== 'layout') setMode('layout');
    const target = dropSpot(drag.type, e.clientX, e.clientY);
    e.dataTransfer.dropEffect = target.ok ? 'copy' : 'none';
    drag.spot = target.ok ? target.spot : null;
    showGhost(drag.type, target);
  });
  editor.addEventListener('dragleave', (e) => {
    if (drag.type && !editor.contains(e.relatedTarget)) hideGhost();
  });
  editor.addEventListener('drop', (e) => {
    if (!drag.type) return;
    e.preventDefault();
    const type = drag.type;
    const spot = drag.spot;
    endLibraryDrag();
    if (spot) addWidget(type, spot);
    else notify('Pas assez de place à cet endroit pour ce widget.', { kind: 'warn' });
  });
}

// ---- Historique des configs, export / import ------------------------------------------

const REASON_ICONS = { deploy: '📺', wgt: '⬇', manual: '📌' };

async function openHistory() {
  $('#history-dialog').showModal();
  await renderBackups();
}

async function renderBackups() {
  const box = $('#backup-list');
  box.innerHTML = '<p class="help">Chargement…</p>';
  let list;
  try {
    list = await (await fetch('/api/backups')).json();
  } catch (e) {
    box.innerHTML = '<p class="error"></p>';
    box.firstChild.textContent = 'Impossible de lire l’historique : ' + e.message;
    return;
  }
  box.innerHTML = '';
  if (!list.length) {
    box.innerHTML = '<p class="help empty">Aucune sauvegarde pour l’instant : la première sera faite au prochain envoi sur la TV.</p>';
    return;
  }
  const fmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  list.forEach((b, i) => {
    const row = document.createElement('div');
    row.className = 'backup-row';
    row.innerHTML = '<span class="backup-icon"></span><div class="backup-main"><div class="backup-date"></div><div class="backup-meta"></div></div>';
    row.querySelector('.backup-icon').textContent = REASON_ICONS[b.reason] || '🕘';
    row.querySelector('.backup-date').textContent = fmt.format(new Date(b.date)) + (i === 0 ? '  · la plus récente' : '');
    row.querySelector('.backup-meta').textContent = b.label + ' · ' + b.pages + ' page' + (b.pages > 1 ? 's' : '')
      + ' · ' + b.widgets + ' widget' + (b.widgets > 1 ? 's' : '') + (b.pageNames.length ? ' · ' + b.pageNames.join(', ') : '');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Restaurer';
    btn.onclick = () => restoreBackup(b, fmt);
    row.append(btn);
    box.append(row);
  });
}

async function restoreBackup(b, fmt) {
  try {
    const r = await fetch('/api/backups/' + encodeURIComponent(b.name));
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'HTTP ' + r.status);
    replaceConfig(data, 'Config du ' + fmt.format(new Date(b.date)) + ' restaurée');
    $('#history-dialog').close();
  } catch (e) {
    notify('Restauration impossible : ' + e.message, { kind: 'error' });
  }
}

/** Remplace toute la config (restauration, import) — annulable. */
function replaceConfig(raw, message) {
  if (!raw || typeof raw !== 'object') throw new Error('fichier vide ou invalide');
  const config = normalizeConfig(raw);
  if (!config.pages.every((p) => p && Array.isArray(p.widgets))) throw new Error('pages invalides');
  state.config = config;
  state.page = config.pages[0].id;
  state.selected = null;
  scheduleSave();
  renderAll();
  reloadPreview();
  notifyUndoable(message);
}

async function backupNow() {
  clearTimeout(saveTimer);
  await save(); // la sauvegarde copie le fichier enregistré : on enregistre d'abord les dernières modifications
  try {
    const r = await (await fetch('/api/backups', { method: 'POST' })).json();
    notify(r.unchanged ? 'Déjà sauvegardée : identique à la dernière copie.' : 'Config sauvegardée dans l’historique.');
    renderBackups();
  } catch (e) {
    notify('Sauvegarde impossible : ' + e.message, { kind: 'error' });
  }
}

function exportConfig() {
  const blob = new Blob([JSON.stringify(state.config, null, 2) + '\n'], { type: 'application/json' });
  const a = document.createElement('a');
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  a.href = URL.createObjectURL(blob);
  a.download = 'dashboard-' + d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + '.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  notify('Config exportée. Elle contient vos mots de passe (Wi-Fi…) : gardez-la pour vous.');
}

async function importConfig(file) {
  try {
    replaceConfig(JSON.parse(await file.text()), 'Config « ' + file.name + ' » importée');
    $('#history-dialog').close();
  } catch (e) {
    notify('Import impossible : ' + e.message, { kind: 'error' });
  }
}

// ---- Pages ---------------------------------------------------------------------------

function showPage(id) {
  if (state.page === id) return;
  state.page = id;
  if (state.selected) closeDrawer(); // le widget réglé n'est pas sur l'autre page
  renderAll();
  reloadPreview();
}

function newPageId() {
  let n = 1;
  while (state.config.pages.some((p) => p.id === 'page-' + n)) n++;
  return 'page-' + n;
}

function addPage() {
  const page = { id: newPageId(), name: 'Page ' + (state.config.pages.length + 1), widgets: [] };
  state.config.pages.push(page);
  scheduleSave();
  state.renaming = page.id; // le nom est tout de suite modifiable dans l'onglet
  showPage(page.id);
}

function duplicatePage() {
  const src = currentPage();
  // Les widgets gardent leur id : tant qu'ils ne sont ni déplacés ni modifiés, ils restent affichés
  // (sans redémarrer) quand on change de page sur la TV, et partagent leurs données (ex. connexion YouTube).
  const page = { id: newPageId(), name: src.name + ' (copie)', widgets: JSON.parse(JSON.stringify(src.widgets)) };
  state.config.pages.splice(state.config.pages.indexOf(src) + 1, 0, page);
  scheduleSave();
  state.renaming = page.id;
  showPage(page.id);
}

function renamePage() {
  state.renaming = currentPage().id;
  renderPages();
}

function movePage(dir) {
  const pages = state.config.pages;
  const i = pages.indexOf(currentPage());
  const j = i + dir;
  if (j < 0 || j >= pages.length) return;
  pages.splice(j, 0, pages.splice(i, 1)[0]);
  scheduleSave();
  renderAll();
}

function removePage() {
  const pages = state.config.pages;
  if (pages.length < 2) return;
  const page = currentPage();
  const i = pages.indexOf(page);
  pages.splice(i, 1);
  scheduleSave();
  showPage(pages[Math.max(0, i - 1)].id);
  notifyUndoable('Page « ' + page.name + ' » supprimée (' + page.widgets.length + ' widget' + (page.widgets.length > 1 ? 's' : '') + ')');
}

/** Onglets « chaînes » : sur la TV, CH▲ / CH▼ passent d'une page à l'autre dans cet ordre. */
function renderPages() {
  const bar = $('#pages');
  bar.innerHTML = '';
  const pages = state.config.pages;
  const cur = currentPage();
  pages.forEach((p, i) => {
    if (state.renaming === p.id) {
      const input = document.createElement('input');
      input.className = 'channel-rename';
      input.value = p.name;
      input.setAttribute('aria-label', 'Nom de la page');
      input.size = Math.max(6, p.name.length + 1);
      let done = false;
      const finish = (commit) => {
        if (done) return;
        done = true;
        const name = input.value.trim();
        state.renaming = null;
        if (commit && name && name !== p.name) {
          p.name = name;
          scheduleSave();
        }
        renderPages();
      };
      input.onkeydown = (e) => {
        if (e.key === 'Enter') { e.preventDefault(); finish(true); }
        if (e.key === 'Escape') { e.preventDefault(); finish(false); }
      };
      input.oninput = () => { input.size = Math.max(6, input.value.length + 1); };
      input.onblur = () => finish(true);
      bar.append(input);
      setTimeout(() => { input.focus(); input.select(); });
      return;
    }
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'channel' + (p === cur ? ' selected' : '');
    b.setAttribute('aria-current', p === cur ? 'page' : 'false');
    b.innerHTML = '<span class="channel-num"></span><span class="channel-name"></span>';
    b.querySelector('.channel-num').textContent = 'CH ' + (i + 1);
    b.querySelector('.channel-name').textContent = p.name;
    b.title = (i === 0 ? 'Page affichée au démarrage. ' : '') + p.widgets.length + ' widget' + (p.widgets.length > 1 ? 's' : '') + ' · double-clic pour renommer';
    b.onclick = () => showPage(p.id);
    b.ondblclick = () => { showPage(p.id); renamePage(); };
    bar.append(b);
  });
  const more = document.createElement('button');
  more.type = 'button';
  more.className = 'ghost icon channel-more';
  more.textContent = '⋯';
  more.title = 'Actions sur cette page';
  more.setAttribute('aria-haspopup', 'menu');
  more.onclick = (e) => { e.stopPropagation(); openPageMenu(more); };
  const add = document.createElement('button');
  add.type = 'button';
  add.className = 'ghost channel-add';
  add.textContent = '+ Page';
  add.title = 'Nouvelle page (ex. pour les invités)';
  add.onclick = addPage;
  bar.append(more, add);
}

function openPageMenu(anchor) {
  const menu = $('#page-menu');
  const pages = state.config.pages;
  const i = pages.indexOf(currentPage());
  menu.querySelector('[data-action="left"]').disabled = i === 0;
  menu.querySelector('[data-action="right"]').disabled = i === pages.length - 1;
  menu.querySelector('[data-action="delete"]').disabled = pages.length < 2;
  const r = anchor.getBoundingClientRect();
  menu.style.left = Math.min(window.innerWidth - 240, r.left) + 'px';
  menu.style.top = (r.bottom + window.scrollY + 6) + 'px';
  menu.hidden = false;
  const first = menu.querySelector('button:not(:disabled)');
  if (first) first.focus();
}

function closePageMenu() { $('#page-menu').hidden = true; }

function initPageMenu() {
  const menu = $('#page-menu');
  const actions = { rename: renamePage, duplicate: duplicatePage, left: () => movePage(-1), right: () => movePage(1), delete: removePage };
  menu.querySelectorAll('[data-action]').forEach((b) => {
    b.onclick = () => { closePageMenu(); actions[b.dataset.action](); };
  });
  document.addEventListener('click', (e) => { if (!menu.hidden && !menu.contains(e.target)) closePageMenu(); });
  menu.addEventListener('keydown', (e) => {
    const items = Array.from(menu.querySelectorAll('button:not(:disabled)'));
    const k = items.indexOf(document.activeElement);
    if (e.key === 'Escape') { closePageMenu(); }
    if (e.key === 'ArrowDown') { e.preventDefault(); items[(k + 1) % items.length].focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); items[(k - 1 + items.length) % items.length].focus(); }
  });
}

// ---- Bibliothèque, liste, inspecteur ----------------------------------------------

function widgetSizes(type) {
  const m = state.widgets[type].manifest;
  return { def: (m.size && m.size.default) || { w: 3, h: 2 }, min: (m.size && m.size.min) || { w: 1, h: 1 } };
}

/** Ajoute un widget : à `at` (glisser-déposer) ou à la première place libre. */
function addWidget(type, at) {
  const m = state.widgets[type].manifest;
  const g = grid();
  const { def, min } = widgetSizes(type);
  const widgets = pageWidgets();
  const spot = at || findFreeSpot(widgets, g, def.w, def.h) || findFreeSpot(widgets, g, min.w, min.h);
  if (!spot) {
    notify('Plus de place sur cette page : réduisez ou supprimez un widget.', { kind: 'warn' });
    return;
  }
  const w = Object.assign({ id: newWidgetId(type), type }, spot, { settings: applyDefaults(m.schema, {}) });
  widgets.push(w);
  state.selected = w.id;
  openDrawer(); // le nouveau widget est prêt à être réglé
  scheduleSave();
  renderAll();
}

/** Id unique sur toutes les pages : un même id sur deux pages = le même widget (données partagées sur la TV). */
function newWidgetId(type) {
  const all = allWidgets();
  let n = 1;
  while (all.some((o) => o.id === type + '-' + n)) n++;
  return type + '-' + n;
}

function widgetLabel(w) {
  const info = state.widgets[w.type];
  return info ? info.manifest.icon + ' ' + info.manifest.name : w.type;
}

function removeWidget(id) {
  const page = currentPage();
  const w = findWidget(id);
  if (!w) return;
  page.widgets = page.widgets.filter((o) => o.id !== id);
  closeDrawer();
  scheduleSave();
  renderAll();
  notifyUndoable('Widget « ' + widgetLabel(w) + ' » supprimé');
}

/** Copie du widget (mêmes réglages, nouvel id) à la première place libre de la même taille. */
function duplicateWidget(id) {
  const w = findWidget(id);
  if (!w) return;
  const spot = findFreeSpot(pageWidgets(), grid(), w.w, w.h);
  if (!spot) {
    notify('Pas de place libre de ' + w.w + '×' + w.h + ' pour dupliquer ce widget.', { kind: 'warn' });
    return;
  }
  const copy = Object.assign({ id: newWidgetId(w.type), type: w.type }, spot, { settings: JSON.parse(JSON.stringify(w.settings || {})) });
  pageWidgets().push(copy);
  state.selected = copy.id;
  openDrawer(); // le nouveau widget est prêt à être réglé
  scheduleSave();
  renderAll();
}

/** Déplace (ou redimensionne avec `resize`) le widget sélectionné d'une case, si la place est libre. */
function nudgeSelected(dc, dr, resize) {
  const w = state.selected && findWidget(state.selected);
  if (!w) return;
  const info = state.widgets[w.type];
  const min = (info && info.manifest.size && info.manifest.size.min) || { w: 1, h: 1 };
  const cand = Object.assign({}, w, resize ? { w: w.w + dc, h: w.h + dr } : { col: w.col + dc, row: w.row + dr });
  if (cand.w < min.w || cand.h < min.h || !isFree(cand, w.id)) {
    const box = document.querySelector('#editor .box[data-id="' + CSS.escape(w.id) + '"]');
    if (box) { box.classList.remove('bump'); void box.offsetWidth; box.classList.add('bump'); }
    return;
  }
  Object.assign(w, { col: cand.col, row: cand.row, w: cand.w, h: cand.h });
  scheduleSave('nudge:' + w.id + (resize ? ':size' : ':pos'));
  renderAll();
}

function select(id) {
  if (state.selected === id) return;
  state.selected = id;
  document.querySelectorAll('#editor .box').forEach((b) => b.classList.toggle('selected', b.dataset.id === id));
  if (id && state.mode !== 'layout') setMode('layout');
  if (id) openDrawer();
  renderLibrary();
  renderInspector();
}

function renderLibrary() {
  const lib = $('#library');
  lib.innerHTML = '';
  Object.entries(state.widgets).forEach(([type, { manifest: m }]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'lib-item';
    b.title = (m.description || m.name) + ' — cliquez ou glissez sur l’écran';
    b.innerHTML = '<span class="lib-icon" aria-hidden="true"></span><span class="lib-name"></span>';
    b.querySelector('.lib-icon').textContent = m.icon;
    b.querySelector('.lib-name').textContent = m.name;
    b.onclick = () => addWidget(type);
    b.draggable = true;
    b.ondragstart = (e) => {
      drag.type = type;
      e.dataTransfer.setData('text/plain', type);
      e.dataTransfer.effectAllowed = 'copy';
      $('#editor').classList.add('is-dragging');
    };
    b.ondragend = endLibraryDrag;
    lib.append(b);
  });

  const list = $('#widget-list');
  list.innerHTML = '';
  const problems = errorsByWidget();
  if (!pageWidgets().length) {
    list.innerHTML = '<li class="empty">Aucun widget pour l’instant.</li>';
  }
  pageWidgets().forEach((w) => {
    const m = state.widgets[w.type] ? state.widgets[w.type].manifest : { icon: '❓', name: w.type };
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'widget-item' + (w.id === state.selected ? ' selected' : '');
    b.innerHTML = '<span class="wi-icon" aria-hidden="true"></span><span class="wi-name"></span><span class="wi-flag"></span>';
    b.querySelector('.wi-icon').textContent = m.icon;
    b.querySelector('.wi-name').textContent = m.name;
    if (problems[w.id]) {
      b.querySelector('.wi-flag').textContent = '⚠';
      b.querySelector('.wi-flag').title = 'Réglages à compléter';
    }
    b.title = w.id + ' · ' + w.w + '×' + w.h;
    b.onclick = () => select(w.id);
    li.append(b);
    list.append(li);
  });
}

function widgetApi(type) {
  return {
    call: async (route, opts) => {
      const r = await fetch('/api/widgets/' + type + '/' + route, opts);
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || ('HTTP ' + r.status));
      return data;
    },
    fetchText: async (url, opts) => {
      const r = await fetch('/api/proxy?url=' + encodeURIComponent(url), opts);
      const text = await r.text();
      if (!r.ok) throw new Error(text || ('HTTP ' + r.status));
      return text;
    },
  };
}

function renderInspector() {
  const panel = $('#inspector');
  panel.innerHTML = '';
  const w = state.selected && findWidget(state.selected);

  if (!w) {
    panel.innerHTML = '<div class="insp-head"><div class="insp-icon" aria-hidden="true">⚙</div><div><h2>Réglages généraux</h2><p class="help">S’appliquent à toutes les pages. Cliquez un widget sur l’écran pour régler celui-ci.</p></div></div><div class="form"></div>';
    state.config.global = applyDefaults(GLOBAL_SCHEMA, state.config.global);
    renderForm(panel.querySelector('.form'), GLOBAL_SCHEMA, state.config.global, (key, value) => {
      state.config.global[key] = value;
      scheduleSave('global:' + key);
    });
    return;
  }

  const info = state.widgets[w.type];
  if (!info) {
    panel.innerHTML = '<h2>❓ ' + w.type + '</h2><p class="error">Type de widget inconnu (dossier widgets/' + w.type + ' absent).</p>';
  } else {
    const m = info.manifest;
    panel.innerHTML = '<button type="button" class="ghost back-link">‹ Réglages généraux</button>'
      + '<div class="insp-head"><div class="insp-icon" aria-hidden="true"></div><div><h2></h2><p class="help desc"></p></div></div>'
      + '<dl class="meta"><div><dt>Taille</dt><dd class="m-size"></dd></div><div><dt>Position</dt><dd class="m-pos"></dd></div><div><dt>Identifiant</dt><dd class="m-id"></dd></div></dl>'
      + '<div class="form"></div><div class="ext"></div>';
    panel.querySelector('.back-link').onclick = () => select(null);
    panel.querySelector('.insp-icon').textContent = m.icon;
    panel.querySelector('h2').textContent = m.name;
    panel.querySelector('.desc').textContent = m.description || '';
    panel.querySelector('.m-size').textContent = w.w + ' × ' + w.h + ' cases';
    panel.querySelector('.m-pos').textContent = 'colonne ' + w.col + ', ligne ' + w.row;
    panel.querySelector('.m-id').textContent = w.id;
    w.settings = applyDefaults(m.schema, w.settings);

    const renderExt = () => {
      if (!info.admin || !info.admin.renderEditor) return;
      info.admin.renderEditor(panel.querySelector('.ext'), w.settings, (patch) => {
        Object.assign(w.settings, patch);
        scheduleSave();
        renderInspector();
      }, widgetApi(w.type));
    };
    renderForm(panel.querySelector('.form'), m.schema, w.settings, (key, value) => {
      w.settings[key] = value;
      scheduleSave('field:' + w.id + ':' + key);
      renderExt();
    });
    renderExt();
  }

  const actions = document.createElement('div');
  actions.className = 'inspector-actions';
  const dup = document.createElement('button');
  dup.type = 'button';
  dup.textContent = 'Dupliquer';
  dup.title = 'Ctrl+D';
  dup.onclick = () => duplicateWidget(w.id);
  const del = document.createElement('button');
  del.type = 'button';
  del.className = 'danger';
  del.textContent = 'Supprimer';
  del.title = 'Suppr';
  del.onclick = () => removeWidget(w.id);
  actions.append(dup, del);
  panel.append(actions);
}

function renderErrors() {
  const errors = validateConfig(state.config, manifestsMap());
  const box = $('#errors');
  box.innerHTML = '';
  box.hidden = !errors.length;
  if (errors.length) {
    const head = document.createElement('p');
    head.className = 'errors-head';
    head.textContent = errors.length === 1
      ? 'Un réglage à compléter avant d’envoyer sur la TV'
      : errors.length + ' réglages à compléter avant d’envoyer sur la TV';
    const list = document.createElement('ul');
    errors.forEach((e) => {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = e.message;
      b.onclick = () => {
        if (e.pageId && e.pageId !== currentPage().id) showPage(e.pageId);
        if (e.widgetId) select(e.widgetId);
        if (state.mode !== 'layout') setMode('layout');
      };
      li.append(b);
      list.append(li);
    });
    box.append(head, list);
  }
  $('#btn-deploy').disabled = errors.length > 0;
  $('#btn-wgt').classList.toggle('disabled', errors.length > 0);
  const why = errors.length ? 'Complétez d’abord les réglages signalés sous l’écran' : '';
  $('#btn-deploy').title = why;
  $('#btn-wgt').title = why || 'Paquet à installer avec Apps2Samsung';
  // Les repères ⚠ des cadres et de la liste suivent les corrections.
  const problems = errorsByWidget();
  document.querySelectorAll('#editor .box[data-id]').forEach((el) => {
    if (el.classList.contains('ghost')) return;
    const n = problems[el.dataset.id] || 0;
    el.classList.toggle('has-problem', n > 0);
    const pb = el.querySelector('.box-problem');
    if (pb) {
      pb.hidden = !n;
      pb.textContent = n ? '⚠ ' + n + ' réglage' + (n > 1 ? 's' : '') + ' à compléter' : '';
    }
  });
  document.querySelectorAll('#widget-list .widget-item').forEach((el, i) => {
    const w = pageWidgets()[i];
    const flag = el.querySelector('.wi-flag');
    if (w && flag) flag.textContent = problems[w.id] ? '⚠' : '';
  });
}

function renderAll() {
  renderPages();
  renderLibrary();
  renderEditor();
  renderInspector();
  renderErrors();
}

// ---- Envoi sur la TV ---------------------------------------------------------------

async function sendToTv() {
  const dialog = $('#deploy-dialog');
  const log = $('#deploy-log');
  log.textContent = '';
  $('#deploy-wgt').hidden = true;
  $('#deploy-tizen').hidden = true;
  dialog.showModal();
  const env = await (await fetch('/api/env')).json();
  if (!env.hasTizen) {
    // Sans Tizen Studio, impossible de signer et d'installer d'ici : paquet à installer avec Apps2Samsung.
    clearTimeout(saveTimer);
    await save();
    log.textContent = 'Tizen Studio n’est pas installé sur ce PC : l’envoi direct n’est pas possible.\n'
      + 'La TV doit être en Developer mode avec l’IP de ce PC (Apps → 1 2 3 4 5, voir README.md).\n\n'
      + '── Option A : Apps2Samsung (le plus simple) ──\n'
      + '1. Cliquez sur « ⬇ Télécharger le .wgt » ci-dessous\n'
      + '2. Dans Apps2Samsung, choisissez l’installation d’un WGT personnalisé et sélectionnez TVDashboard.wgt\n'
      + '3. Choisissez la TV détectée et lancez l’installation\n'
      + '→ À refaire après chaque modification.\n\n'
      + '── Option B : installer Tizen Studio (envoi direct en un clic ensuite) ──\n'
      + '1. Cliquez sur « ⬇ Télécharger Tizen Studio » et installez la version « CLI » (ou complète)\n'
      + '2. Ouvrez le Package Manager de Tizen Studio → onglet « Extension SDK » → installez\n'
      + '   « TV Extensions » et « Samsung Certificate Extension »\n'
      + '3. Tools → Certificate Manager → « + » → Samsung → TV : créez le certificat auteur et le\n'
      + '   certificat distributeur (compte Samsung requis), avec le DUID de la TV. Notez le nom du profil.\n'
      + '4. Copiez .env.example en .env.local à la racine du projet et renseignez :\n'
      + '     TV_IP=<IP de la TV>        (Paramètres → Général → Réseau → État du réseau)\n'
      + '     TIZEN_PROFILE=<nom du profil de certificat>\n'
      + '     TIZEN_HOME=<dossier d’installation, ex. ~/tizen-studio ou C:\\tizen-studio>\n'
      + '5. Cliquez à nouveau sur « Envoyer sur la TV » (pas besoin de relancer l’admin).';
    $('#deploy-wgt').hidden = false;
    $('#deploy-tizen').hidden = false;
    return;
  }
  if (!env.configured) {
    log.textContent = 'La TV n’est pas encore configurée.\n\n'
      + '1. Copiez .env.example en .env.local à la racine du projet\n'
      + '2. Renseignez TV_IP et TIZEN_PROFILE (voir README.md, section « Préparer la TV »)\n'
      + '3. Relancez cet envoi.';
    return;
  }
  clearTimeout(saveTimer);
  await save();
  const r = await fetch('/api/deploy', { method: 'POST' });
  const reader = r.body.getReader();
  const decoder = new TextDecoder();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    log.textContent += decoder.decode(value, { stream: true });
    log.scrollTop = log.scrollHeight;
  }
}

// ---- Raccourcis clavier ---------------------------------------------------------------

function isTyping(el) {
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
}

// Mode test : le clavier de l'admin pilote la TV de l'aperçu.
const KEY_TO_REMOTE = {
  ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', Enter: 'enter', ' ': 'enter',
  Backspace: 'back', PageUp: 'chup', PageDown: 'chdown',
  p: 'playpause', n: 'next', b: 'prev', r: 'red', g: 'green', y: 'yellow', u: 'blue',
};

function onKeyDown(e) {
  if (document.querySelector('dialog[open]') || !$('#page-menu').hidden) return;
  const mod = e.ctrlKey || e.metaKey;
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  // Échap dans un champ du panneau de réglages : ferme le panneau.
  if (e.key === 'Escape' && state.drawer && $('#drawer').contains(document.activeElement)) { closeDrawer(); return; }
  // Dans un champ, Ctrl+Z reste l'annulation de la frappe du navigateur.
  if (isTyping(document.activeElement)) return;
  if (mod && key === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
  if (mod && key === 'y') { e.preventDefault(); redo(); return; }

  if (state.mode === 'test') {
    if (e.key === 'Escape') { setMode('layout'); return; }
    const remote = !mod && !e.altKey && KEY_TO_REMOTE[key];
    // Entrée / espace sur un bouton de l'admin gardent leur rôle normal.
    if (remote && !((key === 'Enter' || key === ' ') && document.activeElement && document.activeElement.tagName === 'BUTTON')) {
      e.preventDefault();
      sendRemoteKey(remote);
      const btn = document.querySelector('#remote [data-key="' + remote + '"]');
      if (btn) pressFeedback(btn);
    }
    return;
  }

  if (key === 't' && !mod && !e.altKey) { setMode('test'); return; }
  if (e.key === 'Escape' && state.drawer) { closeDrawer(); return; }
  if (!state.selected) return;
  const dirs = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  if (dirs[e.key] && !mod && !e.altKey) {
    e.preventDefault();
    nudgeSelected(dirs[e.key][0], dirs[e.key][1], e.shiftKey);
  } else if (mod && key === 'd') {
    e.preventDefault();
    duplicateWidget(state.selected);
  } else if ((e.key === 'Delete' || e.key === 'Backspace') && !mod) {
    e.preventDefault();
    removeWidget(state.selected);
  }
}

// ---- Télécommande de l'aperçu ------------------------------------------------------------

function sendRemoteKey(key) {
  const win = $('#preview').contentWindow;
  if (win) win.postMessage({ type: 'tvdash:key', key }, window.location.origin);
}

function initRemote() {
  document.querySelectorAll('#remote [data-key]').forEach((b) => {
    b.onclick = () => {
      sendRemoteKey(b.dataset.key);
      pressFeedback(b);
    };
  });
}

function pressFeedback(b) {
  b.classList.remove('pressed');
  void b.offsetWidth;
  b.classList.add('pressed');
}

// ---- Démarrage -----------------------------------------------------------------------

async function init() {
  const [config, list] = await Promise.all([
    fetch('/api/config').then((r) => r.json()),
    fetch('/api/widgets').then((r) => r.json()),
  ]);
  state.config = normalizeConfig(config); // ancien format (une seule liste de widgets) → pages
  state.page = state.config.pages[0].id;
  for (const w of list) {
    const manifest = (await import('/widgets/' + w.type + '/manifest.js')).default;
    const admin = w.hasAdmin ? await import('/widgets/' + w.type + '/admin.js') : null;
    state.widgets[w.type] = { manifest, admin };
  }

  $('#btn-global').onclick = toggleGlobalSettings;
  $('#drawer-close').onclick = closeDrawer;
  $('#rail-pin').onclick = () => setRailPinned(!document.body.classList.contains('rail-pinned'));
  let pinned = false;
  try { pinned = localStorage.getItem('tvdash-admin-rail') === '1'; } catch (e) { /* stockage indisponible */ }
  setRailPinned(pinned);
  $('#btn-deploy').onclick = sendToTv;
  $('#btn-reload').onclick = reloadPreview;
  $('#deploy-close').onclick = () => $('#deploy-dialog').close();
  $('#btn-history').onclick = openHistory;
  $('#history-close').onclick = () => $('#history-dialog').close();
  $('#backup-now').onclick = backupNow;
  $('#config-export').onclick = exportConfig;
  $('#config-import').onclick = () => $('#config-file').click();
  $('#config-file').onchange = (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (f) importConfig(f);
  };
  initLibraryDrop();
  $('#btn-undo').onclick = undo;
  $('#btn-redo').onclick = redo;
  document.querySelectorAll('.mode-switch [data-mode]').forEach((b) => { b.onclick = () => setMode(b.dataset.mode); });
  // Clic sur une zone vide de l'écran : retour aux réglages généraux.
  $('#editor').addEventListener('pointerdown', (e) => { if (e.target === $('#editor') || e.target.classList.contains('slot')) closeDrawer(); });
  let mode = 'layout';
  try { mode = localStorage.getItem('tvdash-admin-mode') || 'layout'; } catch (e) { /* stockage indisponible */ }
  setMode(mode);
  initPageMenu();
  document.addEventListener('keydown', onKeyDown);
  initRemote();
  new ResizeObserver(fitPreview).observe($('#screen'));

  renderAll();
  // Après le premier rendu : l'inspecteur complète les réglages par défaut, qui ne comptent pas comme une modification.
  hist = createHistory(JSON.stringify(state.config));
  updateHistoryButtons();
  reloadPreview();
  setStatus('Prêt');
}

init().catch((e) => setStatus('Erreur de chargement : ' + e.message, 'error'));
