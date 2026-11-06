import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDeployLog } from './deploy-steps.js';

const states = (r) => r.steps.map((s) => s.state).join(',');

test('début : préparation en cours', () => {
  const r = parseDeployLog('🕘 Config sauvegardée\n▶ Build de l’app…\n', false);
  assert.equal(r.status, 'running');
  assert.equal(states(r), 'active,pending,pending,pending,pending');
});

test('étapes passées et étape courante', () => {
  const r = parseDeployLog('▶ Build de l’app…\n▶ Création du paquet signé (.wgt)…\n  $ tizen package\n▶ Connexion à la TV 192.168.1.20…\n', false);
  assert.equal(states(r), 'done,done,active,pending,pending');
});

test('réussite', () => {
  const log = ['▶ Build', '▶ Création du paquet signé', '▶ Connexion à la TV', '▶ Installation…', '▶ Lancement de x…', '✅ Dashboard envoyé sur la TV'].join('\n');
  const r = parseDeployLog(log, true);
  assert.equal(r.status, 'success');
  assert.equal(states(r), 'done,done,done,done,done');
  assert.equal(r.hint, null);
});

test('échec à la connexion : étape en erreur, message et conseil', () => {
  const r = parseDeployLog('▶ Build\n▶ Création du paquet signé\n▶ Connexion à la TV 1.2.3.4…\n❌ sdb : connexion refusée\n', true);
  assert.equal(r.status, 'error');
  assert.equal(r.failedStep, 'connect');
  assert.equal(r.error, 'sdb : connexion refusée');
  assert.equal(states(r), 'done,done,error,pending,pending');
  assert.match(r.hint, /TV_IP/);
});

test('flux terminé sans résultat : interrompu', () => {
  const r = parseDeployLog('▶ Build\n', true);
  assert.equal(r.status, 'error');
  assert.equal(r.failedStep, 'build');
});

test('échec avant toute étape', () => {
  const r = parseDeployLog('❌ Tizen introuvable\n', true);
  assert.equal(r.failedStep, 'build');
  assert.equal(states(r), 'error,pending,pending,pending,pending');
});
