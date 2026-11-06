// Aide de la télécommande (touche Info, ou « i » dans l'aperçu) : lignes affichées selon la page (logique pure, testée).

const COLOR_NAMES = { red: 'Rouge', green: 'Verte', yellow: 'Jaune', blue: 'Bleue' };

/**
 * opts : { pageCount, pageKey ('none' | couleur), hasFocusables, widgetHelp: [[touches, texte], …] }
 * `widgetHelp` vient du champ facultatif `remoteHelp` des manifests des widgets de la page.
 * Retourne [{ keys, text }] sans doublon de touches.
 */
export function helpLines(opts) {
  const o = opts || {};
  const lines = [];
  const add = (keys, text) => { if (!lines.some((l) => l.keys === keys)) lines.push({ keys, text }); };
  if (o.hasFocusables) {
    add('◀ ▶ ▲ ▼', 'Choisir un widget');
    add('OK', 'Utiliser le widget choisi');
  }
  if (o.pageCount > 1) {
    add('CH ▲ / CH ▼', 'Page suivante / précédente (' + o.pageCount + ' pages)');
    if (COLOR_NAMES[o.pageKey]) add(COLOR_NAMES[o.pageKey], 'Page suivante');
  }
  (o.widgetHelp || []).forEach((h) => { if (h && h[0] && h[1]) add(String(h[0]), String(h[1])); });
  add('Retour', 'Fermer un panneau ouvert');
  add('Info', 'Afficher / masquer cette aide');
  return lines;
}
