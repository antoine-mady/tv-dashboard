import { test } from 'node:test';
import assert from 'node:assert/strict';
import { errorKind, errorHint } from './errors.js';

test('réglage manquant → config', () => {
  assert.equal(errorKind('Renseignez l’URL DLNA de la box'), 'config');
  assert.equal(errorKind('Renseignez l’ID et le secret client Google dans l’admin'), 'config');
  assert.equal(errorHint('Choisissez un arrêt'), 'À régler dans l’admin, sur le PC');
});

test('réseau, délai, HTTP → network', () => {
  assert.equal(errorKind('Réseau indisponible (Failed to fetch)'), 'network');
  assert.equal(errorKind('Délai dépassé (https://api.open-meteo.com/v1/forecast)'), 'network');
  assert.equal(errorKind('Erreur HTTP 503'), 'network');
  assert.equal(errorHint('Erreur HTTP 500'), 'Nouvel essai automatique');
});

test('autre → pas de conseil', () => {
  assert.equal(errorKind('Format inattendu'), 'other');
  assert.equal(errorHint(''), '');
});
