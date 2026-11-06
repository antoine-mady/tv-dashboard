export default {
  type: 'civis-collecte',
  name: 'Collectes CIVIS',
  icon: '♻️',
  description: 'Prochaines collectes du bac jaune, bac vert, des encombrants et des déchets végétaux. Calendrier réglable par secteur.',
  size: { default: { w: 6, h: 3 }, min: { w: 4, h: 2 } },
  focusable: false,
  schema: [
    { key: 'sector', label: 'Secteur', type: 'text', default: 'A23 · Grand Bois' },
    { key: 'cartonDates', label: 'Cartons / bac jaune — dates (une par ligne)', type: 'textarea', default: '',
      placeholder: 'AAAA-MM-JJ', help: 'Saisissez les dates CIVIS au format AAAA-MM-JJ, une par ligne. Calendrier : calendrier.collecte.civis.re' },
    { key: 'menagerDates', label: 'Ménager / bac vert — dates (une par ligne)', type: 'textarea', default: '',
      placeholder: 'AAAA-MM-JJ', help: 'Saisissez les dates CIVIS au format AAAA-MM-JJ, une par ligne.' },
    { key: 'encombrantsDates', label: 'Encombrants — dates (une par ligne)', type: 'textarea', default: '',
      placeholder: 'AAAA-MM-JJ', help: 'Saisissez les dates CIVIS au format AAAA-MM-JJ, une par ligne.' },
    { key: 'vegetauxDates', label: 'Déchets végétaux — dates (une par ligne)', type: 'textarea', default: '',
      placeholder: 'AAAA-MM-JJ', help: 'Saisissez les dates CIVIS au format AAAA-MM-JJ, une par ligne.' },
  ],
};
