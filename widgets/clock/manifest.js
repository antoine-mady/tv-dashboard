export default {
  type: 'clock',
  name: 'Horloge',
  icon: '🕐',
  description: 'Heure et date.',
  size: { default: { w: 4, h: 2 }, min: { w: 2, h: 1 } },
  focusable: true,
  schema: [
    { key: 'timezone', label: 'Fuseau horaire', type: 'select', default: '', options: [
      { value: '', label: 'Heure de la TV' },
      { value: 'Indian/Reunion', label: 'La Réunion' },
      { value: 'Europe/Paris', label: 'Paris' },
      { value: 'Indian/Mauritius', label: 'Maurice' },
      { value: 'Indian/Mayotte', label: 'Mayotte' },
      { value: 'America/Montreal', label: 'Montréal' },
      { value: 'UTC', label: 'UTC' },
    ] },
    { key: 'label', label: 'Libellé (optionnel)', type: 'text', default: '', placeholder: 'ex. Paris' },
    { key: 'seconds', label: 'Afficher les secondes', type: 'bool', default: false },
    { key: 'showDate', label: 'Afficher la date', type: 'bool', default: true },
  ],
};
