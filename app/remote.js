// Télécommande : enregistre les touches Tizen et les convertit en noms simples.
/* global tizen */

// Touches Tizen à enregistrer (les flèches / Entrée / Retour sont toujours reçues).
const TIZEN_KEYS = {
  MediaPlayPause: 'playpause', MediaPlay: 'play', MediaPause: 'pause', MediaStop: 'stop',
  MediaTrackNext: 'next', MediaTrackPrevious: 'prev', MediaFastForward: 'next', MediaRewind: 'prev',
  ColorF0Red: 'red', ColorF1Green: 'green', ColorF2Yellow: 'yellow', ColorF3Blue: 'blue',
};

// Codes connus (TV Samsung + clavier pour l'aperçu).
const CODES = {
  37: 'left', 38: 'up', 39: 'right', 40: 'down', 13: 'enter', 32: 'enter',
  10009: 'back', 8: 'back', 27: 'back', 65376: 'enter', 65385: 'back',
  10252: 'playpause', 415: 'play', 19: 'pause', 413: 'stop',
  10233: 'next', 10232: 'prev', 417: 'next', 412: 'prev',
  403: 'red', 404: 'green', 405: 'yellow', 406: 'blue',
};

// Raccourcis clavier pour tester dans l'aperçu navigateur.
const KEYBOARD = { p: 'playpause', n: 'next', b: 'prev', r: 'red', g: 'green', y: 'yellow', u: 'blue' };

export function normalizeKey(keyCode, key, extraCodes) {
  if (extraCodes && extraCodes[keyCode]) return extraCodes[keyCode];
  if (CODES[keyCode]) return CODES[keyCode];
  if (key && KEYBOARD[key.toLowerCase()]) return KEYBOARD[key.toLowerCase()];
  return null;
}

// Codes conservés quand un champ de saisie a le focus : Entrée, Retour TV, Échap, haut, bas, Terminé (IME Samsung).
const EDITABLE_KEYS = { 13: true, 10009: true, 27: true, 38: true, 40: true, 65376: true, 65385: true };

function isEditable(el) {
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
}

export function initRemote(onKey) {
  const extra = {};
  if (typeof tizen !== 'undefined' && tizen.tvinputdevice) {
    Object.keys(TIZEN_KEYS).forEach((name) => {
      try {
        tizen.tvinputdevice.registerKey(name);
        const k = tizen.tvinputdevice.getKey(name);
        if (k) extra[k.code] = TIZEN_KEYS[name];
      } catch (e) { /* touche absente sur ce modèle */ }
    });
  }
  document.addEventListener('keydown', (e) => {
    const key = normalizeKey(e.keyCode, e.key, extra);
    if (!key) return;
    // Dans un champ de saisie (clavier de la TV), on laisse passer la frappe :
    // seules Entrée, Retour et haut/bas restent des touches de navigation.
    if (isEditable(e.target) && !EDITABLE_KEYS[e.keyCode]) return;
    e.preventDefault(); // en particulier : Retour ne quitte pas l'app
    onKey(key);
  });
}
