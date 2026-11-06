// Historique Annuler / Rétablir de la page d'admin (logique pure, testée).
// On garde des instantanés JSON de la config. Les modifications rapprochées d'un même élément
// (frappe dans un champ, flèches au clavier) sont fusionnées en une seule étape.

export function createHistory(initial, opts) {
  const o = opts || {};
  const limit = o.limit || 100;
  const mergeMs = o.mergeMs || 1500;
  const now = o.now || (() => Date.now());
  let stack = [initial];
  let index = 0;
  let lastKey = null;
  let lastAt = 0;

  return {
    /**
     * Enregistre l'état `snap` (texte JSON). `key` : identifiant de l'élément modifié ; deux commits
     * successifs avec la même clé à moins de `mergeMs` ms remplacent la même étape.
     * Retourne true si l'historique a changé.
     */
    commit(snap, key) {
      if (snap === stack[index]) return false;
      const t = now();
      const merge = key && key === lastKey && t - lastAt < mergeMs && index > 0;
      stack = stack.slice(0, index + 1);
      if (merge) {
        stack[index] = snap;
      } else {
        stack.push(snap);
        index++;
        if (stack.length > limit) { stack.shift(); index--; }
      }
      lastKey = key || null;
      lastAt = t;
      return true;
    },
    /** Revient à l'étape précédente ; retourne l'instantané, ou null s'il n'y en a pas. */
    undo() {
      if (index === 0) return null;
      index--;
      lastKey = null;
      return stack[index];
    },
    /** Refait l'étape annulée ; retourne l'instantané, ou null. */
    redo() {
      if (index >= stack.length - 1) return null;
      index++;
      lastKey = null;
      return stack[index];
    },
    canUndo() { return index > 0; },
    canRedo() { return index < stack.length - 1; },
    /** Position courante (sert à vérifier qu'une étape est toujours la dernière). */
    get index() { return index; },
  };
}
