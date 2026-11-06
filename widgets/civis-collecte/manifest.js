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
      placeholder: '2026-11-15\n2026-11-29', help: 'Saisissez les dates CIVIS au format AAAA-MM-JJ. Calendrier : calendrier.collecte.civis.re' },
    { key: 'menagerDates', label: 'Ménager / bac vert — dates (une par ligne)', type: 'textarea', default: '',
      placeholder: '2026-11-12\n2026-11-19', help: 'Saisissez les dates CIVIS au format AAAA-MM-JJ.' },
    { key: 'encombrantsDates', label: 'Encombrants — dates (une par ligne)', type: 'textarea', default: '',
      placeholder: '2026-11-20', help: 'Saisissez les dates CIVIS au format AAAA-MM-JJ.' },
    { key: 'vegetauxDates', label: 'Déchets végétaux — dates (une par ligne)', type: 'textarea', default: '',
      placeholder: '2026-11-27', help: 'Saisissez les dates CIVIS au format AAAA-MM-JJ.' },
  ],
};
