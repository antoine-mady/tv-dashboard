// Étapes de l'envoi sur la TV, déduites du journal de tools/deploy.js (logique pure, testée).
// Le journal marque chaque étape par une ligne « ▶ … », la réussite par « ✅ Dashboard envoyé »
// et l'échec par « ❌ … » (ajoutée par le serveur de l'admin).

export const DEPLOY_STEPS = [
  { key: 'build', label: 'Préparation de l’app', match: /^▶ Build/ },
  { key: 'package', label: 'Création du paquet signé', match: /^▶ Création du paquet/ },
  { key: 'connect', label: 'Connexion à la TV', match: /^▶ Connexion/ },
  { key: 'install', label: 'Installation', match: /^▶ Installation/ },
  { key: 'launch', label: 'Lancement', match: /^▶ Lancement/ },
];

const HINTS = {
  build: 'Corrigez la config (réglages à compléter) puis réessayez.',
  package: 'Vérifiez le profil de certificat (TIZEN_PROFILE dans .env.local) dans le Certificate Manager de Tizen Studio.',
  connect: 'Vérifiez que la TV est allumée, sur le même réseau, en mode développeur avec l’IP de ce PC, et que TV_IP (.env.local) est correct.',
  install: 'Si une version installée avec un autre certificat est sur la TV, désinstallez-la puis réessayez.',
  launch: 'L’app est installée : lancez « TVDashboard » depuis la liste des apps de la TV.',
};

/**
 * `text` : journal reçu jusqu'ici ; `finished` : le flux est terminé.
 * Retourne { steps: [{ key, label, state }], status, error, failedStep, hint }
 * avec state = 'pending' | 'active' | 'done' | 'error' et status = 'running' | 'success' | 'error'.
 */
export function parseDeployLog(text, finished) {
  let current = -1;
  let success = false;
  let error = null;
  String(text || '').split(/\r?\n/).forEach((raw) => {
    const line = raw.trim();
    DEPLOY_STEPS.forEach((s, i) => { if (s.match.test(line) && i > current) current = i; });
    if (/^✅ Dashboard envoyé/.test(line)) success = true;
    if (/^❌/.test(line) && !error) error = line.replace(/^❌\s*/, '');
  });
  if (finished && !success && !error) error = 'L’envoi s’est interrompu.';
  const status = success && !error ? 'success' : error ? 'error' : 'running';
  const failedIndex = status === 'error' ? Math.max(0, current) : -1;
  const steps = DEPLOY_STEPS.map((s, i) => {
    let state = 'pending';
    if (status === 'success') state = 'done';
    else if (i < current) state = 'done';
    else if (i === failedIndex) state = 'error';
    else if (i === current) state = 'active';
    return { key: s.key, label: s.label, state };
  });
  const failedStep = failedIndex >= 0 ? DEPLOY_STEPS[failedIndex].key : null;
  return { steps, status, error, failedStep, hint: failedStep ? HINTS[failedStep] : null };
}
