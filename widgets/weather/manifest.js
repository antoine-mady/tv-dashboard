export default {
  type: 'weather',
  name: 'Météo',
  icon: '⛅',
  description: 'Météo actuelle et prévisions (Open-Meteo, sans clé API).',
  size: { default: { w: 4, h: 2 }, min: { w: 3, h: 2 } },
  focusable: false,
  schema: [
    { key: 'label', label: 'Nom du lieu', type: 'text', default: 'Saint-Denis' },
    { key: 'latitude', label: 'Latitude', type: 'number', step: 0.0001, min: -90, max: 90, default: -20.8823,
      help: 'Clic droit sur Google Maps → les coordonnées s’affichent.' },
    { key: 'longitude', label: 'Longitude', type: 'number', step: 0.0001, min: -180, max: 180, default: 55.4504 },
    { key: 'days', label: 'Jours de prévision affichés', type: 'number', min: 0, max: 6, default: 3 },
    { key: 'refreshMinutes', label: 'Rafraîchir toutes les (minutes)', type: 'number', min: 5, max: 180, default: 15 },
  ],
};
