export default {
  type: 'birthdays',
  name: 'Anniversaires',
  icon: '🎂',
  description: 'Prochains anniversaires lus dans un ou plusieurs agendas Google (adresse iCal secrète), avec l’âge quand l’année est connue.',
  size: { default: { w: 3, h: 3 }, min: { w: 2, h: 2 } },
  focusable: false,
  schema: [
    { key: 'title', label: 'Titre', type: 'text', default: 'Anniversaires' },
    { key: 'urls', label: 'Adresses iCal des agendas (une par ligne)', type: 'textarea', default: '', required: true,
      placeholder: 'https://calendar.google.com/calendar/ical/…/basic.ics',
      help: 'Google Agenda (sur ordinateur) : Paramètres → l’agenda des anniversaires → « Intégrer l’agenda » → '
        + '« Adresse secrète au format iCal ». Les événements annuels (« Anniversaire de Marie », « Marie (1990) ») sont reconnus.' },
    { key: 'filter', label: 'Ne garder que les événements contenant', type: 'text', default: '',
      placeholder: 'ex. anniv, birthday',
      help: 'Mots séparés par des virgules. Vide = tous les événements des agendas (pour un agenda dédié aux anniversaires).' },
    { key: 'daysAhead', label: 'Afficher les anniversaires des … prochains jours', type: 'number', min: 1, max: 366, default: 60 },
    { key: 'maxItems', label: 'Nombre max. d’anniversaires', type: 'number', min: 1, max: 20, default: 6 },
    { key: 'showAge', label: 'Afficher l’âge (si l’année de naissance est dans le titre)', type: 'bool', default: true },
    { key: 'refreshMinutes', label: 'Rafraîchir toutes les (minutes)', type: 'number', min: 15, max: 1440, default: 180 },
  ],
};
