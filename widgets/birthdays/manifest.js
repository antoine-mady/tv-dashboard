export default {
  type: 'birthdays',
  name: 'Anniversaires',
  icon: '🎂',
  description: 'Prochains anniversaires importés de vos contacts Google ou lus dans des agendas iCal, avec l’âge quand l’année est connue.',
  size: { default: { w: 3, h: 3 }, min: { w: 2, h: 2 } },
  focusable: false,
  schema: [
    { key: 'title', label: 'Titre', type: 'text', default: 'Anniversaires' },
    { key: 'source', label: 'Source des anniversaires', type: 'select', default: 'ical', options: [
      { value: 'contacts', label: 'Contacts Google (fichier vCard importé)' },
      { value: 'ical', label: 'Agenda(s) iCal' },
    ], help: 'L’agenda « Anniversaires » de Google (tiré des contacts) n’a pas d’adresse iCal : choisissez « Contacts Google ».' },
    { key: 'contacts', label: 'Anniversaires (une ligne par personne : JJ/MM/AAAA Nom)', type: 'textarea', default: '',
      required: true, when: { source: 'contacts' }, placeholder: '12/05/1990 Marie Dupont\n03/01 Paul',
      help: 'Rempli par le bouton « Importer des contacts » ci-dessous (contacts.google.com → Exporter → vCard), '
        + 'ou à la main. L’année est facultative (sert à l’âge). À réimporter pour ajouter de nouveaux contacts.' },
    { key: 'urls', label: 'Adresses iCal des agendas (une par ligne)', type: 'textarea', default: '',
      required: true, when: { source: 'ical' },
      placeholder: 'https://calendar.google.com/calendar/ical/…/basic.ics',
      help: 'Un agenda Google normal (ex. un agenda « Anniversaires » créé par vous) : Paramètres → l’agenda → '
        + '« Intégrer l’agenda » → « Adresse secrète au format iCal ». Les événements annuels (« Anniversaire de Marie », « Marie (1990) ») sont reconnus.' },
    { key: 'filter', when: { source: 'ical' }, label: 'Ne garder que les événements contenant', type: 'text', default: '',
      placeholder: 'ex. anniv, birthday',
      help: 'Mots séparés par des virgules. Vide = tous les événements des agendas (pour un agenda dédié aux anniversaires).' },
    { key: 'daysAhead', label: 'Afficher les anniversaires des … prochains jours', type: 'number', min: 1, max: 366, default: 60 },
    { key: 'maxItems', label: 'Nombre max. d’anniversaires', type: 'number', min: 1, max: 20, default: 6 },
    { key: 'showAge', label: 'Afficher l’âge (si l’année de naissance est dans le titre)', type: 'bool', default: true },
    { key: 'refreshMinutes', when: { source: 'ical' }, label: 'Rafraîchir toutes les (minutes)', type: 'number', min: 15, max: 1440, default: 180 },
  ],
};
