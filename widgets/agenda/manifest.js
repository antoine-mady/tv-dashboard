export default {
  type: 'agenda',
  name: 'Agenda',
  icon: '📅',
  description: 'Prochains événements de vos agendas Google, iCloud ou Outlook, via leur adresse iCal (sans compte ni clé API).',
  size: { default: { w: 4, h: 4 }, min: { w: 3, h: 2 } },
  focusable: false,
  schema: [
    { key: 'title', label: 'Titre', type: 'text', default: 'Agenda', placeholder: 'ex. Famille' },
    { key: 'urls', label: 'Adresses iCal (une par ligne)', type: 'textarea', default: '', required: true,
      placeholder: 'https://calendar.google.com/calendar/ical/…/basic.ics',
      help: 'Google Agenda : Paramètres → votre agenda → « Adresse secrète au format iCal ». '
        + 'iCloud : partager l’agenda → « Calendrier public ». Outlook : Paramètres → Calendriers partagés → Publier (lien ICS). '
        + 'Chaque agenda a sa couleur, dans l’ordre des lignes.' },
    { key: 'days', label: 'Jours affichés', type: 'number', min: 1, max: 60, default: 7 },
    { key: 'maxEvents', label: 'Nombre max. d’événements', type: 'number', min: 1, max: 30, default: 8 },
    { key: 'showLocation', label: 'Afficher le lieu', type: 'bool', default: true },
    { key: 'refreshMinutes', label: 'Rafraîchir toutes les (minutes)', type: 'number', min: 5, max: 720, default: 30 },
  ],
};
