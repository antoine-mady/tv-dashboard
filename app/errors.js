// Messages d'erreur des widgets sur la TV (logique pure, testée) : que faire, selon le type d'erreur.

/**
 * Catégorie d'un message d'erreur : 'config' (réglage manquant ou invalide, à corriger dans l'admin),
 * 'network' (réseau, délai, service indisponible : nouvel essai automatique) ou 'other'.
 */
export function errorKind(message) {
  const m = String(message || '');
  if (/^(Renseignez|Choisissez|Indiquez|Configurez|Ajoutez|Sélectionnez)\b/i.test(m) || /dans l[’']admin/i.test(m)) return 'config';
  if (/R[ée]seau|D[ée]lai d[ée]pass[ée]|Erreur HTTP|timeout|fetch|indisponible|hors ligne/i.test(m)) return 'network';
  return 'other';
}

/** Conseil affiché sous le message (vide si rien d'utile à dire). */
export function errorHint(message) {
  switch (errorKind(message)) {
    case 'config': return 'À régler dans l’admin, sur le PC';
    case 'network': return 'Nouvel essai automatique';
    default: return '';
  }
}
