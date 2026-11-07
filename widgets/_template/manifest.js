// Métadonnées du widget, partagées par l'app TV et la page admin.
// ⚠ Fichier PUR : aucun import, aucun accès au DOM (il est aussi chargé par Node).
export default {
  type: '__TYPE__',            // = nom du dossier
  name: '__NAME__',            // nom affiché dans l'admin
  icon: '🧩',                  // emoji affiché dans l'admin
  description: 'Décrivez ici ce que fait le widget.',
  size: { default: { w: 3, h: 2 }, min: { w: 2, h: 1 } }, // en cases d'une grille 12×6
  focusable: true,            // true si le widget réagit à la télécommande (onKey)
  frameless: false,            // true pour supprimer le cadre et le padding (photos plein cadre…)
  // Réglages : la page admin génère le formulaire à partir de cette liste.
  // Types : text, password, number (min/max/step), bool, select (options), color, time (HH:MM), textarea
  // Options de champ : required, help, placeholder, when: { autreClé: valeur } (affiché seulement si…)
  schema: [
    { key: 'text', label: 'Texte', type: 'text', default: 'Bonjour 👋', required: true },
  ],
};
