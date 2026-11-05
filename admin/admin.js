// Page d'admin : édition de config/dashboard.json + aperçu + envoi sur la TV.
// Aucun code spécifique à un widget ici : tout vient des manifest.js (et admin.js optionnels).
import { applyDefaults, validateConfig, rectsOverlap, fitsInGrid, findFreeSpot, DEFAULT_GRID } from '/app/config.js';
import GLOBAL_SCHEMA from '/app/global-schema.js';
import { renderForm } from '/admin/form.js';

const $ = (sel) => document.querySelector(sel);
const state = {
  config: null,
  widgets: {},       // type → { manifest, admin }
  selected: null,    // id du widget sélectionné, null = réglages généraux
};

function grid() { return Object.assign({}, DEFAULT_GRID, state.config.grid); }
function manifestsMap() { return Object.fromEntries(Object.entries(state.widgets).map(([t, w]) => [t, w.manifest])); }
function findWidget(id) { return state.config.widgets.find((w) => w.id === id); }

// ---- Sauvegarde + aperçu ---------------------------------------------------------

let saveTimer = null;
let previewTimer = null;

function setStatus(text, cls) {
  const s = $('#status');
  s.textContent = text;
  s.className = 'status ' + (cls || '');
}

function scheduleSave() {
  setStatus('Modifications…');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 400);
  renderErrors();
}

async function save() {
  try {
    const r = await fetch('/api/config', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(state.config) });
    if (!r.ok) throw new Error((await r.json()).error);
    setStatus('Enregistré ✓', 'ok');
    clearTimeout(previewTimer);
    previewTimer = setTimeout(reloadPreview, 300);
  } catch (e) {
    setStatus('Erreur : ' + e.message, 'error');
  }
}

function reloadPreview() {
  $('#preview').src = '/preview/?t=' + Date.now();
}

function fitPreview() {
  const wrap = $('#preview-wrap');
  $('#preview').style.transform = 'scale(' + wrap.clientWidth / 1920 + ')';
}

// ---- Éditeur de disposition ---------------------------------------------------------

function placeBox(box, w) {
  const g = grid();
  box.style.left = ((w.col - 1) / g.cols * 100) + '%';
  box.style.top = ((w.row - 1) / g.rows * 100) + '%';
  box.style.width = (w.w / g.cols * 100) + '%';
  box.style.height = (w.h / g.rows * 100) + '%';
}

function isFree(candidate, ignoreId) {
  return fitsInGrid(candidate, grid()) && !state.config.widgets.some((o) => o.id !== ignoreId && rectsOverlap(candidate, o));
}

function renderEditor() {
  const editor = $('#editor');
  const g = grid();
  editor.innerHTML = '';
  editor.style.setProperty('--cols', g.cols);
  editor.style.setProperty('--rows', g.rows);

  state.config.widgets.forEach((w) => {
    const info = state.widgets[w.type];
    const m = info ? info.manifest : { name: w.type + ' (inconnu)', icon: '❓', size: { min: { w: 1, h: 1 } } };
    const box = document.createElement('div');
    box.className = 'box' + (w.id === state.selected ? ' selected' : '');
    box.dataset.id = w.id;
    box.innerHTML = '<div class="box-icon"></div><div class="box-name"></div><div class="box-size"></div><div class="resize" title="Redimensionner"></div>';
    box.querySelector('.box-icon').textContent = m.icon;
    box.querySelector('.box-name').textContent = m.name;
    box.querySelector('.box-size').textContent = w.w + '×' + w.h;
    placeBox(box, w);
    editor.append(box);

    box.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      select(w.id);
      const resizing = e.target.classList.contains('resize');
      const rect = editor.getBoundingClientRect();
      const cw = rect.width / g.cols;
      const ch = rect.height / g.rows;
      const start = { x: e.clientX, y: e.clientY, col: w.col, row: w.row, w: w.w, h: w.h };
      const min = (m.size && m.size.min) || { w: 1, h: 1 };
      let candidate = null;
      const liveBox = box;
      liveBox.setPointerCapture(e.pointerId);
      liveBox.classList.add('dragging');

      const move = (ev) => {
        const dc = Math.round((ev.clientX - start.x) / cw);
        const dr = Math.round((ev.clientY - start.y) / ch);
        candidate = Object.assign({}, w, resizing
          ? { w: Math.max(min.w, Math.min(g.cols - w.col + 1, start.w + dc)), h: Math.max(min.h, Math.min(g.rows - w.row + 1, start.h + dr)) }
          : { col: Math.max(1, Math.min(g.cols - w.w + 1, start.col + dc)), row: Math.max(1, Math.min(g.rows - w.h + 1, start.row + dr)) });
        placeBox(liveBox, candidate);
        liveBox.querySelector('.box-size').textContent = candidate.w + '×' + candidate.h;
        liveBox.classList.toggle('invalid', !isFree(candidate, w.id));
      };
      const up = () => {
        liveBox.removeEventListener('pointermove', move);
        liveBox.removeEventListener('pointerup', up);
        liveBox.removeEventListener('pointercancel', up);
        if (candidate && isFree(candidate, w.id) &&
            (candidate.col !== w.col || candidate.row !== w.row || candidate.w !== w.w || candidate.h !== w.h)) {
          Object.assign(w, { col: candidate.col, row: candidate.row, w: candidate.w, h: candidate.h });
          scheduleSave();
        }
        renderAll();
      };
      liveBox.addEventListener('pointermove', move);
      liveBox.addEventListener('pointerup', up);
      liveBox.addEventListener('pointercancel', up);
    });
  });
}

// ---- Bibliothèque, liste, inspecteur ----------------------------------------------

function addWidget(type) {
  const m = state.widgets[type].manifest;
  const g = grid();
  const def = (m.size && m.size.default) || { w: 3, h: 2 };
  const min = (m.size && m.size.min) || { w: 1, h: 1 };
  const spot = findFreeSpot(state.config.widgets, g, def.w, def.h) || findFreeSpot(state.config.widgets, g, min.w, min.h);
  if (!spot) {
    alert('Plus de place sur l’écran : réduisez ou supprimez un widget.');
    return;
  }
  let n = 1;
  while (findWidget(type + '-' + n)) n++;
  const w = Object.assign({ id: type + '-' + n, type }, spot, { settings: applyDefaults(m.schema, {}) });
  state.config.widgets.push(w);
  state.selected = w.id;
  scheduleSave();
  renderAll();
}

function removeWidget(id) {
  state.config.widgets = state.config.widgets.filter((w) => w.id !== id);
  state.selected = null;
  scheduleSave();
  renderAll();
}

function select(id) {
  if (state.selected === id) return;
  state.selected = id;
  document.querySelectorAll('#editor .box').forEach((b) => b.classList.toggle('selected', b.dataset.id === id));
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
    b.title = m.description || '';
    b.innerHTML = '<span class="lib-icon"></span><span class="lib-name"></span><span class="lib-add">＋</span>';
    b.querySelector('.lib-icon').textContent = m.icon;
    b.querySelector('.lib-name').textContent = m.name;
    b.onclick = () => addWidget(type);
    lib.append(b);
  });

  const list = $('#widget-list');
  list.innerHTML = '';
  state.config.widgets.forEach((w) => {
    const m = state.widgets[w.type] ? state.widgets[w.type].manifest : { icon: '❓', name: w.type };
    const li = document.createElement('li');
    li.className = w.id === state.selected ? 'selected' : '';
    li.textContent = m.icon + '  ' + m.name;
    const small = document.createElement('small');
    small.textContent = w.id;
    li.append(small);
    li.onclick = () => select(w.id);
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
    panel.innerHTML = '<h2>Réglages généraux</h2><p class="help">Apparence et comportement de tout le dashboard.</p><div class="form"></div>';
    state.config.global = applyDefaults(GLOBAL_SCHEMA, state.config.global);
    renderForm(panel.querySelector('.form'), GLOBAL_SCHEMA, state.config.global, (key, value) => {
      state.config.global[key] = value;
      scheduleSave();
    });
    return;
  }

  const info = state.widgets[w.type];
  if (!info) {
    panel.innerHTML = '<h2>❓ ' + w.type + '</h2><p class="error">Type de widget inconnu (dossier widgets/' + w.type + ' absent).</p>';
  } else {
    const m = info.manifest;
    panel.innerHTML = '<h2></h2><p class="help desc"></p><p class="meta"></p><div class="form"></div><div class="ext"></div>';
    panel.querySelector('h2').textContent = m.icon + ' ' + m.name;
    panel.querySelector('.desc').textContent = m.description || '';
    panel.querySelector('.meta').textContent = 'id : ' + w.id + ' · colonne ' + w.col + ', ligne ' + w.row + ' · ' + w.w + '×' + w.h;
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
      scheduleSave();
      renderExt();
    });
    renderExt();
  }

  const del = document.createElement('button');
  del.type = 'button';
  del.className = 'danger';
  del.textContent = '🗑 Supprimer ce widget';
  del.onclick = () => { if (confirm('Supprimer ce widget ?')) removeWidget(w.id); };
  panel.append(del);
}

function renderErrors() {
  const errors = validateConfig(state.config, manifestsMap());
  const box = $('#errors');
  box.innerHTML = '';
  errors.forEach((e) => {
    const p = document.createElement('div');
    p.textContent = '⚠ ' + e.message;
    p.onclick = () => e.widgetId && select(e.widgetId);
    box.append(p);
  });
  $('#btn-deploy').disabled = errors.length > 0;
  $('#btn-wgt').classList.toggle('disabled', errors.length > 0);
  $('#btn-deploy').title = errors.length ? 'Corrigez les erreurs avant d’envoyer' : '';
}

function renderAll() {
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
  dialog.showModal();
  const env = await (await fetch('/api/env')).json();
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

// ---- Démarrage -----------------------------------------------------------------------

async function init() {
  const [config, list] = await Promise.all([
    fetch('/api/config').then((r) => r.json()),
    fetch('/api/widgets').then((r) => r.json()),
  ]);
  state.config = config;
  state.config.widgets = state.config.widgets || [];
  for (const w of list) {
    const manifest = (await import('/widgets/' + w.type + '/manifest.js')).default;
    const admin = w.hasAdmin ? await import('/widgets/' + w.type + '/admin.js') : null;
    state.widgets[w.type] = { manifest, admin };
  }

  $('#btn-global').onclick = () => select(null);
  $('#btn-deploy').onclick = sendToTv;
  $('#btn-reload').onclick = reloadPreview;
  $('#deploy-close').onclick = () => $('#deploy-dialog').close();
  new ResizeObserver(fitPreview).observe($('#preview-wrap'));

  renderAll();
  reloadPreview();
  setStatus('Prêt');
}

init().catch((e) => setStatus('Erreur de chargement : ' + e.message, 'error'));
