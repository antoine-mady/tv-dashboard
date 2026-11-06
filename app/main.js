// Point d'entrée de l'app TV : lit la config embarquée, crée les widgets, gère la télécommande.
import './styles.css'; // en premier : les styles des widgets passent après
import registry from '../.generated/tv-registry.js'; // généré par tools/build.js (tous les widgets/*)
import { applyDefaults, getPages, DEFAULT_GRID } from './config.js';
import { stepPage, initialPage, sameWidget } from './pages.js';
import { createStore } from './Widget.js';
import GLOBAL_SCHEMA from './global-schema.js';
import { createStage } from './grid.js';
import { createPanelHost } from './panel.js';
import { initRemote, isEditable } from './remote.js';
import { initDictation, DICTATION_KEYS } from './dictation.js';
import { findNeighbor, firstItem } from './focus.js';
import { shouldSleep, sleepEnabled } from './sleep.js';
import { animMode, animTiming, staggerDelays, enterClass, leaveClass } from './anim.js';
import * as platform from './platform.js';
import { h } from './dom.js';

const MEDIA_KEYS = ['playpause', 'play', 'pause', 'stop', 'next', 'prev'];

function safeKey(inst, key) {
  try { return !!inst.onKey(key); } catch (e) { console.error(e); return false; }
}

function queryParam(name) {
  const m = new RegExp('[?&]' + name + '=([^&#]*)').exec(window.location.search || '');
  return m ? decodeURIComponent(m[1]) : null;
}

function start() {
  window.__APP_STARTED__ = true;
  const config = window.__DASHBOARD_CONFIG__ || { pages: [] };
  const global = applyDefaults(GLOBAL_SCHEMA, config.global);
  const grid = Object.assign({}, DEFAULT_GRID, config.grid);
  const pages = getPages(config);
  const root = document.getElementById('stage');
  const appStore = createStore('tvdash:app:');

  platform.disableScreenSaver();
  const stage = createStage(root, grid, global);
  const mode = animMode(global.animations);
  const timing = animTiming(mode);
  root.classList.add('anim-' + mode);
  const panels = createPanelHost(root, { leaveMs: timing.panel });
  let instances = []; // widgets de la page affichée : { conf, inst, cell, focusable }
  let asleep = false; // mode veille (voir plus bas)
  let lastActivity = Date.now();
  let pageIndex = initialPage(pages, {
    requested: platform.isPreview ? queryParam('page') : null, // l'admin affiche la page en cours d'édition
    saved: appStore.get('page', null),
    remember: global.rememberPage,
  });

  // ---- Animations d'entrée / sortie (app/anim.js, styles.css) -----------------
  const ANIM_CLASSES = ['cell-in', 'cell-in-next', 'cell-in-prev', 'cell-wake', 'focus-pop'];
  function clearAnim(cell) {
    ANIM_CLASSES.forEach((c) => cell.classList.remove(c));
    cell.style.animationDelay = '';
  }
  /** Lance l'animation `cls` sur la cellule (après `delay` ms), puis retire la classe. */
  function animate(cell, cls, delay, duration) {
    if (!duration) return;
    clearAnim(cell);
    void cell.offsetWidth; // relance l'animation si la classe vient d'être retirée
    cell.classList.add(cls);
    if (delay) cell.style.animationDelay = delay + 'ms';
    setTimeout(() => {
      if (!cell.classList.contains(cls)) return;
      cell.classList.remove(cls);
      cell.style.animationDelay = '';
    }, (delay || 0) + duration + 50);
  }

  function mountWidget(w, anim) {
    const entry = registry[w.type];
    const parts = stage.addCell(w, entry && entry.manifest);
    if (anim) animate(parts.cell, anim.cls, anim.delay, timing.enter);
    if (!entry) {
      parts.cell.appendChild(h('div', { className: 'cell-error' }, h('div', { className: 'cell-error-msg', text: 'Widget inconnu : ' + w.type })));
      return { conf: w, inst: null, cell: parts.cell, focusable: false };
    }
    const inst = new entry.Widget();
    inst._init({
      id: w.id, cell: parts.cell, el: parts.body, size: parts.size, manifest: entry.manifest,
      settings: applyDefaults(entry.manifest.schema, w.settings), platform, panels,
    });
    try {
      const r = inst.mount(inst.el, inst.settings);
      if (r && typeof r.then === 'function') r.catch((e) => inst.showError(e.message || String(e)));
    } catch (e) {
      console.error(e);
      inst.showError(e.message || String(e));
    }
    return { conf: w, inst, cell: parts.cell, focusable: !!entry.manifest.focusable };
  }

  /** Arrête le widget. `dir` (changement de page) : la cellule disparaît en glissant avant d'être retirée. */
  function unmount(it, dir) {
    if (it.inst) it.inst._destroy();
    const cell = it.cell;
    const remove = () => { if (cell.parentNode) cell.parentNode.removeChild(cell); };
    if (!dir || !timing.leave) return remove();
    clearAnim(cell);
    cell.classList.remove('is-focused');
    cell.classList.add('cell-leaving', leaveClass(dir));
    setTimeout(remove, timing.leave + 50);
  }

  /**
   * Affiche la page `index`. Les widgets identiques sur les deux pages (même id, place et réglages)
   * sont conservés tels quels (la musique continue) ; les autres sont arrêtés puis recréés.
   */
  function showPage(index, dir) {
    const page = pages[index];
    const kept = [];
    instances.forEach((it) => {
      if (page.widgets.some((w) => sameWidget(w, it.conf))) kept.push(it);
      else unmount(it, dir);
    });
    const isKept = (w) => kept.some((k) => sameWidget(w, k.conf));
    // Les nouveaux widgets apparaissent en cascade (haut à gauche d'abord) ; en changeant de page,
    // ils commencent pendant que les anciens disparaissent.
    const delays = staggerDelays(page.widgets.filter((w) => !isKept(w)), timing.stagger);
    const base = dir ? Math.round(timing.leave / 2) : 0;
    instances = page.widgets.map((w) => {
      for (let i = 0; i < kept.length; i++) if (sameWidget(w, kept[i].conf)) return kept[i];
      return mountWidget(w, { cls: enterClass(dir || 0), delay: base + (delays[w.id] || 0) });
    });
    pageIndex = index;
    updateFocusables();
  }

  // ---- Focus & télécommande ---------------------------------------------------
  let focusables = [];
  let items = [];
  let focusedId = null;

  function byId(id) { return focusables.find((i) => i.conf.id === id); }

  /** `pop` : petit rebond (déplacement du focus à la télécommande), sauf si la cellule est encore en train d'apparaître. */
  function setFocus(id, pop) {
    const prev = byId(focusedId);
    if (prev) { prev.cell.classList.remove('is-focused'); try { prev.inst.onFocus(false); } catch (e) { /* ignore */ } }
    focusedId = id;
    const next = byId(id);
    if (next) {
      next.cell.classList.add('is-focused');
      const entering = ['cell-in', 'cell-in-next', 'cell-in-prev', 'cell-wake'].some((c) => next.cell.classList.contains(c));
      if (pop && mode === 'full' && !entering) animate(next.cell, 'focus-pop', 0, 350);
      try { next.inst.onFocus(true); } catch (e) { /* ignore */ }
    }
  }

  function updateFocusables() {
    const prev = byId(focusedId); // encore présent si le widget a été conservé
    focusables = instances.filter((i) => i.focusable);
    items = focusables.map((i) => ({ id: i.conf.id, col: i.conf.col, row: i.conf.row, w: i.conf.w, h: i.conf.h }));
    const keep = prev && byId(focusedId) === prev;
    if (!keep) {
      if (prev) prev.cell.classList.remove('is-focused');
      focusedId = null;
      if (items.length) setFocus(firstItem(items));
    }
  }

  showPage(pageIndex);

  // ---- Changement de page -------------------------------------------------------
  let toast = null;
  let toastTimer = null;
  function showPageName() {
    if (!toast) {
      toast = h('div', { id: 'page-toast' });
      root.appendChild(toast);
    }
    toast.textContent = pages[pageIndex].name + '  ·  ' + (pageIndex + 1) + ' / ' + pages.length;
    toast.className = 'is-visible';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.className = ''; }, 2500);
  }

  function goToPage(dir) {
    if (pages.length < 2) return;
    showPage(stepPage(pages.length, pageIndex, dir), dir);
    appStore.set('page', pages[pageIndex].id);
    const info = document.getElementById('boot-info'); // diagnostic de démarrage : concerne l'ancienne page
    if (info && info.parentNode) info.parentNode.removeChild(info);
    showPageName();
  }

  // Dictée vocale dans les champs de saisie (bouton micro Samsung, touche de couleur, F2 dans l'aperçu).
  const dictation = initDictation(root, { lang: 'fr-FR', preview: platform.isPreview });

  initRemote((key) => {
    // En veille, une touche réveille le dashboard sans rien faire d'autre (sauf les touches média :
    // « pause » doit marcher du premier coup quand la musique joue).
    lastActivity = Date.now();
    if (asleep) {
      setAsleep(false);
      if (MEDIA_KEYS.indexOf(key) === -1) return;
    }
    if (DICTATION_KEYS.indexOf(key) !== -1 && isEditable(document.activeElement) && dictation.start(document.activeElement)) return;
    // Un panneau plein écran est ouvert : toutes les touches vont à son widget.
    const owner = panels.owner();
    if (owner) {
      if (safeKey(owner, key)) return;
      if (key === 'back') { owner.closePanel(); return; }
      if (MEDIA_KEYS.indexOf(key) === -1) return;
    }
    const cur = byId(focusedId);
    if (cur && safeKey(cur.inst, key)) return;
    if (key === 'chup' || key === 'chdown') { goToPage(key === 'chup' ? 1 : -1); return; }
    if (key === global.pageKey && pages.length > 1) { goToPage(1); return; }
    if (key === 'left' || key === 'right' || key === 'up' || key === 'down') {
      const next = findNeighbor(items, focusedId, key);
      if (next) setFocus(next, true);
      return;
    }
    // Les touches média vont au premier widget qui sait les gérer (ex. musique), même sans focus.
    if (MEDIA_KEYS.indexOf(key) !== -1) {
      for (let i = 0; i < instances.length; i++) {
        if (instances[i] !== cur && instances[i].inst && safeKey(instances[i].inst, key)) return;
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

  // ---- Mode veille ---------------------------------------------------------------
  // Après N minutes sans touche (ou la nuit) : écran assombri, widgets en pause (timers suspendus)
  // et économiseur d'écran de la TV réautorisé, pour qu'elle applique sa protection et son arrêt auto.
  let overlay = null;
  function setAsleep(on) {
    if (on === asleep) return;
    asleep = on;
    if (!overlay) {
      overlay = h('div', { id: 'sleep' });
      document.body.appendChild(overlay);
    }
    // Endormissement lent (3 s, styles.css), réveil rapide.
    overlay.style.transition = on ? '' : 'opacity ' + (timing.enter ? 0.8 : 0) + 's ease';
    overlay.style.opacity = on ? String(global.sleepDim / 100) : '0';
    root.classList.toggle('is-asleep', on); // coupe les animations en boucle pendant la veille
    platform.setScreenSaver(on);
    instances.forEach((it) => { if (it.inst) (on ? it.inst._sleep() : it.inst._wake()); });
    // Au réveil, les widgets se « rallument » l'un après l'autre (animations complètes seulement).
    if (!on && mode === 'full') {
      const delays = staggerDelays(instances.map((it) => it.conf), timing.stagger);
      instances.forEach((it) => animate(it.cell, 'cell-wake', 150 + (delays[it.conf.id] || 0), 700));
    }
  }
  if (sleepEnabled(global)) {
    const check = () => {
      const now = new Date();
      setAsleep(shouldSleep(global, now.getHours() * 60 + now.getMinutes(), Date.now() - lastActivity));
    };
    // Souris (pointeur de la télécommande, aperçu) : compte comme une activité.
    const poke = () => { lastActivity = Date.now(); if (asleep) setAsleep(false); };
    document.addEventListener('mousedown', poke);
    document.addEventListener('mousemove', poke);
    check();
    setInterval(check, 30 * 1000);
  }

  showStartupInfo(pages, pageIndex, instances.filter((i) => i.inst).length);

  window.addEventListener('unload', () => instances.forEach((i) => { if (i.inst) i.inst._destroy(); }));
}

/* global __BUILD_TIME__ */
const BUILD_TIME = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : '?';

/**
 * Bandeau de diagnostic affiché quelques secondes au démarrage (permanent si aucun widget) :
 * date du build (vérifier que la bonne version est installée), widgets, écran, navigateur.
 */
function showStartupInfo(pages, pageIndex, mounted) {
  const count = pages[pageIndex].widgets.length;
  const total = pages.reduce((n, p) => n + p.widgets.length, 0);
  const ua = navigator.userAgent;
  const m = /(Tizen [\d.]+)/.exec(ua);
  const c = /(Chrome\/[\d]+)/.exec(ua);
  const lines = [
    'TV Dashboard · build du ' + BUILD_TIME.replace('T', ' ').slice(0, 16) + ' (UTC)',
    (pages.length > 1 ? 'Page « ' + pages[pageIndex].name + ' » (' + (pageIndex + 1) + '/' + pages.length + ', CH▲/CH▼ pour changer) · ' : '') +
      'Widgets : ' + count + (count !== mounted ? ' (' + mounted + ' affichés)' : '') +
      (window.__DASHBOARD_CONFIG__ ? '' : ' · ⚠ config embarquée absente'),
    'Écran : ' + window.innerWidth + '×' + window.innerHeight + ' · ' + (m ? m[1] + ' · ' : '') + (c ? c[1] : ua),
  ];
  if (!total) lines.push('⚠ Aucun widget : ajoutez-en dans l’admin (npm run dev), puis « Envoyer sur la TV ».');
  const box = h('pre', {
    id: 'boot-info',
    text: lines.join('\n'),
    style: {
      position: 'fixed', left: '40px', bottom: '40px', zIndex: '99998', margin: '0', padding: '20px 28px',
      background: 'rgba(0,0,0,0.8)', color: '#fff', border: '2px solid #7cc4ff', borderRadius: '14px',
      font: '24px/1.45 monospace', whiteSpace: 'pre-wrap',
    },
  });
  document.body.appendChild(box);
  if (total) setTimeout(() => { if (box.parentNode) box.parentNode.removeChild(box); }, 20000);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
else start();
