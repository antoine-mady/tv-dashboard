// Point d'entrée de l'app TV : lit la config embarquée, crée les widgets, gère la télécommande.
import './styles.css'; // en premier : les styles des widgets passent après
import registry from '../.generated/tv-registry.js'; // généré par tools/build.js (tous les widgets/*)
import { applyDefaults, DEFAULT_GRID } from './config.js';
import GLOBAL_SCHEMA from './global-schema.js';
import { createStage } from './grid.js';
import { initRemote } from './remote.js';
import { findNeighbor, firstItem } from './focus.js';
import { parseTime, isInRange } from './schedule.js';
import * as platform from './platform.js';
import { h } from './dom.js';

const MEDIA_KEYS = ['playpause', 'play', 'pause', 'stop', 'next', 'prev'];

function safeKey(inst, key) {
  try { return !!inst.onKey(key); } catch (e) { console.error(e); return false; }
}

function start() {
  const config = window.__DASHBOARD_CONFIG__ || { widgets: [] };
  const global = applyDefaults(GLOBAL_SCHEMA, config.global);
  const grid = Object.assign({}, DEFAULT_GRID, config.grid);
  const root = document.getElementById('stage');

  platform.disableScreenSaver();
  const stage = createStage(root, grid, global);
  const instances = [];

  (config.widgets || []).forEach((w) => {
    const entry = registry[w.type];
    const parts = stage.addCell(w, entry && entry.manifest);
    if (!entry) {
      parts.cell.appendChild(h('div', { className: 'cell-error' }, h('div', { className: 'cell-error-msg', text: 'Widget inconnu : ' + w.type })));
      return;
    }
    const inst = new entry.Widget();
    inst._init({
      id: w.id, cell: parts.cell, el: parts.body, size: parts.size, manifest: entry.manifest,
      settings: applyDefaults(entry.manifest.schema, w.settings), platform,
    });
    try {
      const r = inst.mount(inst.el, inst.settings);
      if (r && typeof r.then === 'function') r.catch((e) => inst.showError(e.message || String(e)));
    } catch (e) {
      console.error(e);
      inst.showError(e.message || String(e));
    }
    instances.push({ conf: w, inst, cell: parts.cell, focusable: !!entry.manifest.focusable });
  });

  // ---- Focus & télécommande ---------------------------------------------------
  const focusables = instances.filter((i) => i.focusable);
  const items = focusables.map((i) => ({ id: i.conf.id, col: i.conf.col, row: i.conf.row, w: i.conf.w, h: i.conf.h }));
  let focusedId = null;

  function byId(id) { return focusables.find((i) => i.conf.id === id); }

  function setFocus(id) {
    const prev = byId(focusedId);
    if (prev) { prev.cell.classList.remove('is-focused'); try { prev.inst.onFocus(false); } catch (e) { /* ignore */ } }
    focusedId = id;
    const next = byId(id);
    if (next) { next.cell.classList.add('is-focused'); try { next.inst.onFocus(true); } catch (e) { /* ignore */ } }
  }
  if (items.length) setFocus(firstItem(items));

  initRemote((key) => {
    const cur = byId(focusedId);
    if (cur && safeKey(cur.inst, key)) return;
    if (key === 'left' || key === 'right' || key === 'up' || key === 'down') {
      const next = findNeighbor(items, focusedId, key);
      if (next) setFocus(next);
      return;
    }
    // Les touches média vont au premier widget qui sait les gérer (ex. musique), même sans focus.
    if (MEDIA_KEYS.indexOf(key) !== -1) {
      for (let i = 0; i < instances.length; i++) {
        if (instances[i] !== cur && safeKey(instances[i].inst, key)) return;
      }
    }
  });

  // ---- Anti-marquage : décale tout de quelques px chaque heure ------------------
  if (global.antiBurnIn) {
    setInterval(() => {
      const r = () => Math.round(Math.random() * 16 - 8);
      stage.setShift(r(), r());
    }, 60 * 60 * 1000);
  }

  // ---- Mode nuit ----------------------------------------------------------------
  if (global.nightMode) {
    const overlay = h('div', { id: 'night' });
    document.body.appendChild(overlay);
    const startMin = parseTime(global.nightStart);
    const endMin = parseTime(global.nightEnd);
    const check = () => {
      const now = new Date();
      const on = isInRange(now.getHours() * 60 + now.getMinutes(), startMin, endMin);
      overlay.style.opacity = on ? String(global.nightDim / 100) : '0';
    };
    check();
    setInterval(check, 30 * 1000);
  }

  window.addEventListener('unload', () => instances.forEach((i) => i.inst._destroy()));
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
else start();
