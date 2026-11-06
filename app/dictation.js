// Dictée vocale dans les champs de saisie (tous les <input> / <textarea> de l'app, widgets compris).
//
// Deux moteurs, selon ce que propose la TV (ou le navigateur de l'aperçu) :
//  - Samsung « Voice Interaction » (webapis.voiceinteraction, TV récentes) : on maintient le bouton micro
//    de la télécommande, la TV transcrit et transmet le texte à l'app (callback onsearch).
//  - Reconnaissance vocale web (webkitSpeechRecognition : Chrome de l'aperçu, certaines TV) : déclenchée
//    par une touche de couleur (ou F2 / clic sur le bandeau dans l'aperçu) quand un champ a le focus.
// Sans aucun moteur, rien n'est affiché (le clavier natif de la TV propose souvent son propre micro).
//
// Le texte dicté est inséré dans le champ, puis deux événements sont émis sur le champ :
// `input` (comme une frappe) et `dictation` (CustomEvent, detail.text) — ex. la musique lance la recherche.
import { h } from './dom.js';
import { isEditable } from './remote.js';

/**
 * Insère `text` dans `value` à la place de la sélection [start, end] (fin du texte si non fournie),
 * en ajoutant des espaces si nécessaire. Renvoie { value, caret }.
 */
export function insertText(value, text, start, end) {
  const v = String(value == null ? '' : value);
  const t = String(text == null ? '' : text).replace(/\s+/g, ' ').trim();
  let s = typeof start === 'number' ? Math.max(0, Math.min(start, v.length)) : v.length;
  let e = typeof end === 'number' ? Math.max(s, Math.min(end, v.length)) : s;
  if (!t) return { value: v, caret: e };
  if (!v.trim()) { s = 0; e = v.length; } // champ vide (ou blanc) : on le remplace
  const before = v.slice(0, s);
  const after = v.slice(e);
  const sepBefore = before && !/\s$/.test(before) ? ' ' : '';
  const sepAfter = after && !/^\s/.test(after) ? ' ' : '';
  const head = before + sepBefore + t;
  return { value: head + sepAfter + after, caret: head.length };
}

/** Moteurs de dictée disponibles dans `win` : { samsung?, Speech? }. */
export function detectEngines(win) {
  const out = {};
  try {
    const vi = win.webapis && win.webapis.voiceinteraction;
    if (vi && typeof vi.setCallback === 'function' && typeof vi.listen === 'function') out.samsung = vi;
  } catch (e) { /* API absente */ }
  try {
    const SR = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (typeof SR === 'function') out.Speech = SR;
  } catch (e) { /* API absente */ }
  return out;
}

/** Texte prononcé dans un « search term » Samsung (Voice Interaction). */
export function utteranceOf(vi, term) {
  try {
    const t = vi.getDataFromSearchTerm(term, 'SEARCH_TERM_UTTERANCE');
    if (t) return String(t);
  } catch (e) { /* format inattendu : on tente ci-dessous */ }
  if (typeof term === 'string') return term;
  return (term && (term.utterance || term.SEARCH_TERM_UTTERANCE)) || '';
}

/** Message lisible pour une erreur de la reconnaissance vocale web. */
export function errorMessage(code) {
  switch (code) {
    case 'no-speech': return 'Rien entendu, réessayez';
    case 'not-allowed':
    case 'service-not-allowed': return 'Accès au micro refusé';
    case 'audio-capture': return 'Aucun micro détecté';
    case 'network': return 'Service de dictée injoignable';
    case 'aborted': return 'Dictée annulée';
    default: return 'Dictée impossible' + (code ? ' (' + code + ')' : '');
  }
}

/** Touches qui lancent la dictée quand un champ de saisie a le focus. */
export const DICTATION_KEYS = ['mic', 'red', 'green', 'yellow', 'blue'];

/**
 * Démarre la gestion de la dictée. `root` : élément où afficher le bandeau d'état.
 * Renvoie { available, start(field) → bool }.
 */
export function initDictation(root, opts) {
  const o = opts || {};
  const engines = detectEngines(window);
  const lang = o.lang || 'fr-FR';
  let bar = null;
  let hideTimer = null;
  let rec = null;
  let lastField = null;
  let micButton = null;

  function show(text, cls, ms) {
    if (!bar) {
      bar = h('div', { id: 'dictation' });
      // Clic (aperçu) : sans voler le focus du champ.
      bar.addEventListener('mousedown', (e) => e.preventDefault());
      bar.addEventListener('click', () => { if (lastField && engines.Speech) start(lastField); });
      root.appendChild(bar);
    }
    bar.textContent = text;
    bar.className = 'is-visible' + (cls ? ' ' + cls : '');
    clearTimeout(hideTimer);
    if (ms) hideTimer = setTimeout(hide, ms);
  }
  function hide() {
    clearTimeout(hideTimer);
    if (bar) bar.className = '';
  }

  function visible(el) { return !!el && el.offsetParent !== null && !el.disabled && !el.readOnly; }

  /** Bouton micro au bord du champ ciblé, ajouté hors de la grille TV pour rester cliquable. */
  function positionMicButton(field) {
    if (!available || !field || !visible(field)) {
      if (micButton) micButton.style.display = 'none';
      return;
    }
    if (!micButton) {
      micButton = document.createElement('button');
      micButton.type = 'button';
      micButton.id = 'dictation-input-action';
      micButton.setAttribute('aria-label', 'Démarrer la dictée vocale');
      micButton.title = 'Démarrer la dictée vocale';
      micButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3"></rect><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8"></path></svg>';
      // Garde le focus du champ : la dictée doit toujours écrire dedans.
      micButton.addEventListener('mousedown', (e) => e.preventDefault());
      micButton.addEventListener('click', () => { if (lastField) start(lastField); });
      document.body.appendChild(micButton);
    }
    const rect = field.getBoundingClientRect();
    micButton.style.left = Math.max(0, rect.right - 58) + 'px';
    micButton.style.top = Math.max(0, rect.top + (rect.height - 48) / 2) + 'px';
    micButton.style.display = 'block';
  }

  /** Champ cible : celui qui a le focus, sinon le champ visible du panneau plein écran ouvert. */
  function currentField() {
    const a = document.activeElement;
    if (isEditable(a) && visible(a)) return a;
    const layer = root.querySelector('.panel-layer:not(.panel-out)');
    if (!layer) return null;
    const fields = layer.querySelectorAll('input, textarea');
    for (let i = 0; i < fields.length; i++) {
      const f = fields[i];
      const type = (f.getAttribute('type') || 'text').toLowerCase();
      if ((f.tagName === 'TEXTAREA' || type === 'text' || type === 'search') && visible(f)) return f;
    }
    return null;
  }

  function fill(field, text) {
    let start = null;
    let end = null;
    try { start = field.selectionStart; end = field.selectionEnd; } catch (e) { /* pas de sélection */ }
    const r = insertText(field.value, text, start, end);
    field.value = r.value;
    try { field.setSelectionRange(r.caret, r.caret); } catch (e) { /* ignore */ }
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new CustomEvent('dictation', { bubbles: true, detail: { text: String(text).trim() } }));
    show('🎤 « ' + String(text).trim() + ' »', 'is-done', 2500);
  }

  // ---- Samsung Voice Interaction : bouton micro de la télécommande -----------------
  if (engines.samsung) {
    try {
      engines.samsung.setCallback({
        onupdatestate: () => 'List',
        onsearch: (term) => {
          const field = currentField();
          const text = utteranceOf(engines.samsung, term);
          if (!field || !text) return false; // la TV traite la commande normalement
          fill(field, text);
          return true;
        },
      });
      engines.samsung.listen();
    } catch (e) {
      console.warn('[dictée] Voice Interaction indisponible', e);
      delete engines.samsung;
    }
  }

  // ---- Reconnaissance vocale web : touche de couleur / F2 / clic ------------------
  function start(field) {
    if (!field) return false;
    if (!engines.Speech) {
      // Tizen démarre l'écoute Samsung à la demande, depuis l'icône ou la touche micro.
      if (!engines.samsung) return false;
      try {
        engines.samsung.listen();
        show('🎤 Parlez maintenant…', 'is-listening');
      } catch (e) {
        show('⚠ ' + errorMessage(e && e.name), 'is-error', 3000);
      }
      return true;
    }
    if (rec) { try { rec.abort(); } catch (e) { /* ignore */ } return true; } // 2e appui : annule
    let finalText = '';
    let error = null;
    try {
      rec = new engines.Speech();
      rec.lang = lang;
      rec.interimResults = true;
      rec.continuous = false;
      rec.maxAlternatives = 1;
      rec.onresult = (e) => {
        let interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) finalText += r[0].transcript;
          else interim += r[0].transcript;
        }
        show('🎤 ' + ((finalText + interim).trim() || 'Je vous écoute…'), 'is-listening');
      };
      rec.onerror = (e) => { error = e && e.error; };
      rec.onend = () => {
        rec = null;
        if (finalText.trim()) fill(field, finalText);
        else show('⚠ ' + errorMessage(error || 'no-speech'), 'is-error', 3000);
      };
      rec.start();
      show('🎤 Je vous écoute…', 'is-listening');
    } catch (e) {
      rec = null;
      show('⚠ ' + errorMessage(e && e.name), 'is-error', 3000);
    }
    return true;
  }

  function hintText() {
    const parts = [];
    if (engines.samsung) parts.push('icône micro ou bouton micro');
    if (engines.Speech) parts.push(o.preview ? 'F2 ou clic ici' : 'touche de couleur');
    return '🎤 Dicter : ' + parts.join(' ou ');
  }

  const available = !!(engines.samsung || engines.Speech);
  if (available) {
    // Icône SVG discrète dans les champs texte : indique que le bouton micro est prêt.
    const style = document.createElement('style');
    style.id = 'dictation-input-hint-style';
    style.textContent = [
      'html.has-dictation input:not([type]), html.has-dictation input[type="text"],',
      'html.has-dictation input[type="search"], html.has-dictation textarea {',
      'background-image: url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%23bac7d8%27 stroke-width=%272%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27%3E%3Crect x=%279%27 y=%272%27 width=%276%27 height=%2712%27 rx=%273%27/%3E%3Cpath d=%27M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8%27/%3E%3C/svg%3E") !important;',
      'background-repeat: no-repeat !important;',
      'background-position: right 18px center !important;',
      'background-size: 30px 30px !important;',
      'padding-right: 64px !important;',
      '}',
      '#dictation-input-action { position: fixed; z-index: 99999; width: 48px; height: 48px; padding: 8px; border: 0; border-radius: 50%; background: rgba(0,0,0,.72); color: #bac7d8; display: none; cursor: pointer; box-sizing: border-box; }',
      '#dictation-input-action svg { display: block; width: 32px; height: 32px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }',
      '#dictation-input-action:focus { outline: 3px solid #7cc4ff; }'
    ].join('\n');
    document.head.appendChild(style);
    document.documentElement.classList.add('has-dictation');

    document.addEventListener('focusin', (e) => {
      if (!isEditable(e.target)) return;
      lastField = e.target;
      positionMicButton(lastField);
      if (!rec) show(hintText());
    });
    document.addEventListener('focusout', (e) => {
      if (!isEditable(e.target)) return;
      setTimeout(() => {
        if (!rec && !isEditable(document.activeElement) && bar && bar.className.indexOf('is-done') === -1 &&
          bar.className.indexOf('is-error') === -1) hide();
        if (!isEditable(document.activeElement)) positionMicButton(null);
      }, 0);
    });
    window.addEventListener('resize', () => positionMicButton(lastField));
    window.addEventListener('scroll', () => positionMicButton(lastField), true);
  }

  return { available, start: (field) => start(field || currentField()) };
}

