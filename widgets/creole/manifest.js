export default {
  type: 'creole',
  name: 'Mot créole du jour',
  icon: '🌺',
  description: 'Un mot ou un proverbe de créole réunionnais chaque jour, avec sa traduction et le rappel de la veille.',
  size: { default: { w: 4, h: 2 }, min: { w: 3, h: 2 } },
  focusable: true,
  schema: [
    { key: 'title', label: 'Titre', type: 'text', default: 'Mot kréol du jour' },
    { key: 'mode', label: 'Contenu', type: 'select', default: 'both', options: [
      { value: 'both', label: 'Mots et proverbes' },
      { value: 'words', label: 'Mots seulement' },
      { value: 'proverbs', label: 'Proverbes seulement' },
    ] },
    { key: 'showExample', label: 'Afficher l’exemple (ou le sens du proverbe)', type: 'bool', default: true },
    { key: 'showYesterday', label: 'Rappeler le mot d’hier', type: 'bool', default: true },
    { key: 'customWords', label: 'Mots personnels (un par ligne)', type: 'textarea', default: '',
      placeholder: 'Zanbrokal = Riz aux pois et légumes = Mi manz in zanbrokal',
      help: '« mot = traduction = exemple » (l’exemple est facultatif). Un mot déjà présent est remplacé par le vôtre : '
        + 'pratique pour corriger une orthographe ou une traduction.' },
    { key: 'onlyCustom', label: 'Utiliser seulement mes mots', type: 'bool', default: false },
  ],
};
