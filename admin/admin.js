// Page d'admin : édition de config/dashboard.json + aperçu + envoi sur la TV.
// Aucun code spécifique à un widget ici : tout vient des manifest.js (et admin.js optionnels).
import { applyDefaults, validateConfig, rectsOverlap, fitsInGrid, findFreeSpot, normalizeConfig, DEFAULT_GRID } from '/app/config.js';
import GLOBAL_SCHEMA from '/app/global-schema.js';
import { renderForm } from '/admin/form.js';

const $ = (sel) => document.querySelector(sel);
const state = {
  config: null,
  widgets: {},       // type → { manifest, admin }
  selected: null,    // id du widget sélectionné, null = réglages généraux
  page: null,        // id de la page en cours d'édition
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
  $('#preview').src = '/preview/?t=' + Date.now() + '&page=' + encodeURIComponent(currentPage().id);
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
  return fitsInGrid(candidate, grid()) && !pageWidgets().some((o) => o.id !== ignoreId && rectsOverlap(candidate, o));
}

function renderEditor() {
  const editor = $('#editor');
  const g = grid();
  editor.innerHTML = '';
  editor.style.setProperty('--cols', g.cols);
  editor.style.setProperty('--rows', g.rows);

  pageWidgets().forEach((w) => {
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

// ---- Pages ---------------------------------------------------------------------------

function showPage(id) {
  if (state.page === id) return;
  state.page = id;
  state.selected = null;
  renderAll();
  reloadPreview();
}

function newPageId() {
  let n = 1;
  while (state.config.pages.some((p) => p.id === 'page-' + n)) n++;
  return 'page-' + n;
}

function addPage() {
  const name = prompt('Nom de la nouvelle page (ex. « Invités ») :', 'Page ' + (state.config.pages.length + 1));
  if (name === null) return;
  const page = { id: newPageId(), name: name.trim() || 'Page ' + (state.config.pages.length + 1), widgets: [] };
  state.config.pages.push(page);
  scheduleSave();
  showPage(page.id);
}

function duplicatePage() {
  const src = currentPage();
  const name = prompt('Nom de la copie :', src.name + ' (copie)');
  if (name === null) return;
  // Les widgets gardent leur id : tant qu'ils ne sont ni déplacés ni modifiés, ils restent affichés
  // (sans redémarrer) quand on change de page sur la TV, et partagent leurs données (ex. connexion YouTube).
  const page = { id: newPageId(), name: name.trim() || src.name, widgets: JSON.parse(JSON.stringify(src.widgets)) };
  state.config.pages.splice(state.config.pages.indexOf(src) + 1, 0, page);
  scheduleSave();
  showPage(page.id);
}

function renamePage() {
  const page = currentPage();
  const name = prompt('Nom de la page :', page.name);
  if (name === null || !name.trim()) return;
  page.name = name.trim();
  scheduleSave();
  renderAll();
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
  if (!confirm('Supprimer la page « ' + page.name + ' » et ses ' + page.widgets.length + ' widget(s) ?')) return;
  const i = pages.indexOf(page);
  pages.splice(i, 1);
  scheduleSave();
  showPage(pages[Math.max(0, i - 1)].id);
}

function renderPages() {
  const bar = $('#pages');
  bar.innerHTML = '';
  const pages = state.config.pages;
  const cur = currentPage();
  pages.forEach((p, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'page-tab' + (p === cur ? ' selected' : '');
    b.textContent = p.name;
    b.title = (i === 0 ? 'Page de démarrage · ' : '') + p.widgets.length + ' widget(s)';
    b.onclick = () => showPage(p.id);
    b.ondblclick = renamePage;
    bar.append(b);
  });
  const tool = (label, title, fn, disabled) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'ghost';
    b.textContent = label;
    b.title = title;
    b.disabled = !!disabled;
    b.onclick = fn;
    bar.append(b);
  };
  const i = pages.indexOf(cur);
  tool('＋ Page', 'Nouvelle page vide', addPage);
  tool('⧉', 'Dupliquer cette page', duplicatePage);
  tool('✎', 'Renommer cette page', renamePage);
  tool('◀', 'Déplacer vers la gauche', () => movePage(-1), i === 0);
  tool('▶', 'Déplacer vers la droite', () => movePage(1), i === pages.length - 1);
  tool('🗑', 'Supprimer cette page', removePage, pages.length < 2);
  $('#pages-hint').textContent = pages.length > 1
    ? 'Sur la TV : CH▲ / CH▼ pour changer de page (Page↑ / Page↓ dans l’aperçu). La 1re page est celle de démarrage.'
    : 'Ajoutez une page pour un 2e dashboard (ex. quand vous avez des invités).';
}

// ---- Bibliothèque, liste, inspecteur ----------------------------------------------

function addWidget(type) {
  const m = state.widgets[type].manifest;
  const g = grid();
  const def = (m.size && m.size.default) || { w: 3, h: 2 };
  const min = (m.size && m.size.min) || { w: 1, h: 1 };
  const widgets = pageWidgets();
  const spot = findFreeSpot(widgets, g, def.w, def.h) || findFreeSpot(widgets, g, min.w, min.h);
  if (!spot) {
    alert('Plus de place sur cette page : réduisez ou supprimez un widget.');
    return;
  }
  // Id unique sur toutes les pages : un même id sur deux pages = le même widget (données partagées sur la TV).
  const all = allWidgets();
  let n = 1;
  while (all.some((o) => o.id === type + '-' + n)) n++;
  const w = Object.assign({ id: type + '-' + n, type }, spot, { settings: applyDefaults(m.schema, {}) });
  widgets.push(w);
  state.selected = w.id;
  scheduleSave();
  renderAll();
}

function removeWidget(id) {
  const page = currentPage();
  page.widgets = page.widgets.filter((w) => w.id !== id);
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
  pageWidgets().forEach((w) => {
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
    p.onclick = () => {
      if (e.pageId && e.pageId !== currentPage().id) showPage(e.pageId);
      if (e.widgetId) select(e.widgetId);
    };
    box.append(p);
  });
  $('#btn-deploy').disabled = errors.length > 0;
  $('#btn-wgt').classList.toggle('disabled', errors.length > 0);
  $('#btn-deploy').title = errors.length ? 'Corrigez les erreurs avant d’envoyer' : '';
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
