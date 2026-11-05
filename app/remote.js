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
  10009: 'back', 8: 'back', 27: 'back',
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
    e.preventDefault(); // en particulier : Retour ne quitte pas l'app
    onKey(key);
  });
}
