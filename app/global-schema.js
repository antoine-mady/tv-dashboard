// Réglages généraux du dashboard (même format que le `schema` des widgets).
export default [
  { key: 'background', label: 'Fond d’écran', type: 'select', default: 'night', options: [
    { value: 'night', label: 'Dégradé nuit' },
    { value: 'ocean', label: 'Dégradé océan' },
    { value: 'slate', label: 'Ardoise' },
    { value: 'black', label: 'Noir' },
  ] },
  { key: 'accent', label: 'Couleur d’accent', type: 'color', default: '#7cc4ff' },
  { key: 'padding', label: 'Marge autour de l’écran (px)', type: 'number', min: 0, max: 160, default: 48,
    help: 'Augmenter si les bords sont coupés par la TV (overscan).' },
  { key: 'gap', label: 'Espace entre les widgets (px)', type: 'number', min: 0, max: 80, default: 24 },
  { key: 'antiBurnIn', label: 'Anti-marquage (décale l’affichage de quelques px chaque heure)', type: 'bool', default: true },
  { key: 'nightMode', label: 'Mode nuit (assombrit l’écran)', type: 'bool', default: false },
  { key: 'nightStart', label: 'Début du mode nuit', type: 'time', default: '23:00', when: { nightMode: true } },
  { key: 'nightEnd', label: 'Fin du mode nuit', type: 'time', default: '07:00', when: { nightMode: true } },
  { key: 'nightDim', label: 'Assombrissement la nuit (%)', type: 'number', min: 0, max: 95, default: 75, when: { nightMode: true } },
  { key: 'pageKey', label: 'Touche couleur pour changer de page', type: 'select', default: 'none', options: [
    { value: 'none', label: 'Aucune (CH▲ / CH▼ seulement)' },
    { value: 'green', label: 'Verte' },
    { value: 'yellow', label: 'Jaune' },
    { value: 'blue', label: 'Bleue' },
    { value: 'red', label: 'Rouge' },
  ], help: 'Avec plusieurs pages, CH▲ / CH▼ passent toujours à la page suivante / précédente. La touche couleur fait défiler les pages (si le widget sélectionné ne s’en sert pas déjà, ex. rouge = app YouTube pour la musique).' },
  { key: 'rememberPage', label: 'Au redémarrage, rouvrir la dernière page affichée', type: 'bool', default: true },
];
