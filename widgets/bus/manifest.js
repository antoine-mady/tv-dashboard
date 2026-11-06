export default {
  type: 'bus',
  name: 'Horaires de bus',
  icon: '🚌',
  description: 'Prochains départs à votre arrêt (Alternéo, Car Jaune, Citalis, Kar’Ouest), avec les retards en temps réel quand le réseau les publie. OK sur la télécommande : tous les horaires jusqu’à demain soir.',
  size: { default: { w: 4, h: 2 }, min: { w: 3, h: 2 } },
  focusable: true, // OK : panneau plein écran avec tous les horaires
  schema: [
    // Valeurs internes, réglées par l'assistant d'arrêt.
    { key: 'network', label: 'Réseau de recherche', type: 'text', default: 'alterneo', when: { network: '__jamais__' } },
    { key: 'stopName', label: 'Arrêt(s)', type: 'text', default: '', when: { network: '__jamais__' } },
    { key: 'title', label: 'Titre affiché', type: 'text', default: '', placeholder: 'Nom de l’arrêt par défaut' },
    { key: 'routes', label: 'Lignes à afficher', type: 'text', default: '', placeholder: 'ex. 11, Lit2',
      help: 'Séparées par des virgules. Vide = toutes les lignes de l’arrêt.' },
    { key: 'count', label: 'Nombre de départs affichés', type: 'number', min: 1, max: 8, default: 4, slider: true },
    { key: 'walkMinutes', label: 'Temps de marche jusqu’à l’arrêt (min)', type: 'number', min: 0, max: 30, default: 0,
      help: 'Les bus qu’on ne peut plus attraper ne sont pas affichés.' },
    { key: 'realtime', label: 'Retards en temps réel', type: 'bool', default: true },
    { key: 'showAlerts', label: 'Afficher les perturbations du réseau', type: 'bool', default: true },
    { key: 'refreshSeconds', label: 'Temps réel : rafraîchir toutes les (secondes)', type: 'number', min: 20, max: 300, default: 45 },
    { key: 'realtimeUrl', label: 'Adresse GTFS-RT (avancé)', type: 'text', default: '',
      help: 'Adresse personnalisée pour le réseau par défaut ci-dessus. Les autres réseaux utilisent leur adresse connue.' },
    { key: 'gtfsUrl', label: 'Adresse GTFS (avancé)', type: 'text', default: '',
      help: 'Seulement si le réseau change d’adresse. Vide = adresse connue du réseau.' },
    // Remplis par l'assistant de l'admin (admin.js) ; jamais affichés.
    { key: 'stopIds', label: 'Identifiants GTFS de l’arrêt', type: 'text', default: '', when: { network: '__jamais__' } },
    { key: 'timetable', label: 'Table des horaires', type: 'textarea', default: '', when: { network: '__jamais__' } },
    { key: 'stops', label: 'Arrêts et horaires', type: 'textarea', default: '', when: { network: '__jamais__' } },
  ],
};
