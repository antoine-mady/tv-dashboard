// Vigilance Météo-France via le service de l'application mobile (NON documenté, peut changer sans préavis).
// Format attendu (celui de la bibliothèque open source « meteofrance-api ») :
//   { update_time, end_validity_time, domain_id,
//     phenomenons_max_colors: [{ phenomenon_id: '1', phenomenon_max_color_id: 3 }, …] }
// Pur, testé.

export const VIGILANCE_BASE = 'https://webservice.meteofrance.com/v3/warning/currentphenomenons';

const PHENOMENA = {
  1: 'Vent', 2: 'Pluie', 3: 'Orages', 4: 'Crues', 5: 'Neige', 6: 'Canicule',
  7: 'Grand froid', 8: 'Avalanches', 9: 'Vagues', 10: 'Cyclone',
};
const COLORS = { 1: 'verte', 2: 'jaune', 3: 'orange', 4: 'rouge', 5: 'violette' };

export function buildVigilanceUrl(s) {
  return VIGILANCE_BASE + '?domain=' + encodeURIComponent(String(s.vigilanceDomain || '974').trim())
    + '&depth=0&with_coastal_bulletin=true&token=' + encodeURIComponent(String(s.vigilanceToken || '').trim());
}

/**
 * → { level, color, phenomena: [{ id, name, level }] } (phénomènes jaunes ou plus, du plus grave au moins grave),
 *   ou null si la réponse n'a pas le format attendu (l'API a changé).
 */
export function parseVigilance(json) {
  const list = json && json.phenomenons_max_colors;
  if (!Array.isArray(list)) return null;
  let level = 1;
  const phenomena = [];
  list.forEach((p) => {
    const lvl = Number(p && p.phenomenon_max_color_id);
    if (!(lvl >= 1)) return;
    if (lvl > level) level = lvl;
    if (lvl >= 2) {
      const id = String(p.phenomenon_id);
      phenomena.push({ id, name: PHENOMENA[id] || 'Phénomène ' + id, level: lvl });
    }
  });
  phenomena.sort((a, b) => b.level - a.level);
  return { level, color: COLORS[level] || 'inconnue', phenomena };
}

/** Texte court pour le widget : « Vigilance orange · Vent, Pluie ». */
export function vigilanceText(v) {
  if (!v) return 'Vigilance : —';
  if (v.level <= 1) return 'Pas de vigilance';
  return 'Vigilance ' + v.color + ' · ' + v.phenomena.map((p) => p.name).join(', ');
}
