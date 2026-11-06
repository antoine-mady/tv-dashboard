// Réseaux de bus de La Réunion dont les données sont ouvertes (transport.data.gouv.fr, Licence Ouverte 2.0).
// Fichier PUR : utilisé par la TV (adresses temps réel) et par le serveur d'admin (adresses GTFS).
// Les adresses peuvent être remplacées dans les réglages du widget si un producteur en change.

export const NETWORKS = {
  alterneo: {
    name: 'Alternéo (CIVIS : Saint-Pierre, Saint-Louis, Petite-Île…)',
    gtfs: 'https://transport.data.gouv.fr/resources/80676/download',
    tripUpdates: 'https://proxy.transport.data.gouv.fr/resource/alterneo-civis-gtfs-rt-trip-update',
    alerts: 'https://proxy.transport.data.gouv.fr/resource/alterneo-civis-gtfs-rt-service-alert',
  },
  'car-jaune': {
    name: 'Car Jaune (interurbain)',
    gtfs: 'https://pysae.com/api/v2/groups/car-jaune/gtfs/pub',
    // Un seul flux contient retards, positions et alertes.
    tripUpdates: 'https://pysae.com/api/v2/groups/car-jaune/gtfs-rt',
    alerts: '',
  },
  citalis: {
    name: 'Citalis (CINOR : Saint-Denis…)',
    gtfs: 'https://www.data.gouv.fr/api/1/datasets/r/fc065c47-8644-4941-a8ca-4d8322a45749',
    tripUpdates: '',
    alerts: '',
  },
  karouest: {
    name: 'Kar’Ouest (TCO : Saint-Paul, Trois-Bassins…)',
    gtfs: 'https://www.data.gouv.fr/api/1/datasets/r/c9c2f609-d0cd-4233-ad1b-cf86b9bf2dc8',
    tripUpdates: '',
    alerts: '',
  },
};

/** Adresses effectives d'un réseau, en tenant compte des adresses saisies dans les réglages. */
export function feedsFor(settings) {
  const n = NETWORKS[settings.network] || {};
  const custom = (settings.realtimeUrl || '').trim();
  return {
    gtfs: (settings.gtfsUrl || '').trim() || n.gtfs || '',
    tripUpdates: custom || n.tripUpdates || '',
    // Avec une adresse personnalisée, on suppose un flux unique (retards + alertes).
    alerts: custom ? '' : (n.alerts || ''),
  };
}
