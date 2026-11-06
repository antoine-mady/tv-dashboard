// Plafond commun de typographie pour l'interface TV.
// Mesure la taille calculée plutôt que de remplacer les tailles définies par chaque widget :
// les petits libellés restent petits, seuls les textes dépassant le plafond sont réduits.
// Compatible avec le navigateur Tizen basé sur Chromium 56 (pas de clamp()/min()).
const MAX_TEXT_SIZE = 32;
const CAP_CLASS = 'global-font-cap';

function capTree(root) {
  if (!root || root.nodeType !== 1) return;
  const nodes = [root];
  const descendants = root.querySelectorAll ? root.querySelectorAll('*') : [];
  for (let i = 0; i < descendants.length; i++) nodes.push(descendants[i]);

  nodes.forEach((el) => {
    // Ne pas toucher aux éléments graphiques : leurs dimensions ne sont pas de la typographie.
    if (/^(SVG|PATH|G|RECT|CIRCLE|LINE|POLYLINE|POLYGON|CANVAS|IMG)$/i.test(el.tagName)) return;
    el.classList.remove(CAP_CLASS);
    const size = parseFloat(window.getComputedStyle(el).fontSize);
    if (size > MAX_TEXT_SIZE) el.classList.add(CAP_CLASS);
  });
}

/** Applique le même plafond à tous les widgets et panneaux, y compris ceux créés plus tard. */
export function limitTextSizes(root) {
  if (!root) return;
  capTree(root);
  // Les widgets et panneaux construisent leur contenu dynamiquement : on plafonne chaque
  // nouveau sous-arbre au moment où il est ajouté, sans surveiller les animations/style.
  if (typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver((records) => {
      records.forEach((record) => {
        for (let i = 0; i < record.addedNodes.length; i++) {
          const node = record.addedNodes[i];
          if (node.nodeType === 1) capTree(node);
        }
      });
    });
    observer.observe(root, { childList: true, subtree: true });
  }
}
