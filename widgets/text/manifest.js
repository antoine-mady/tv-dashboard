export default {
  type: 'text',
  name: 'Texte',
  icon: '✍️',
  description: 'Affiche un texte saisi directement avec la télécommande ou dicté à la voix.',
  size: { default: { w: 6, h: 3 }, min: { w: 3, h: 2 } },
  focusable: true,
  remoteHelp: [['OK', 'Modifier le texte'], ['🎤', 'Dicter dans le champ']],
  schema: [
    { key: 'align', label: 'Alignement', type: 'select', default: 'center', options: [
      { value: 'left', label: 'À gauche' },
      { value: 'center', label: 'Centré' },
      { value: 'right', label: 'À droite' },
    ] },
    { key: 'fontSize', label: 'Taille du texte', type: 'number', default: 28, min: 14, max: 32, step: 1, slider: true, unit: 'px' },
    { key: 'color', label: 'Couleur du texte', type: 'color', default: '#ffffff', presets: ['#ffffff', '#ffd166', '#7bdff2', '#ff8fab', '#b8f2a1'] },
  ],
};
