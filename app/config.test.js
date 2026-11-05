import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyDefaults, validateConfig, findFreeSpot, rectsOverlap } from './config.js';

const schema = [
  { key: 'name', label: 'Nom', type: 'text', default: 'x', required: true },
  { key: 'n', label: 'N', type: 'number', min: 1, max: 10, default: 5 },
  { key: 'on', label: 'On', type: 'bool', default: true },
  { key: 'mode', label: 'Mode', type: 'select', default: 'a' },
  { key: 'secret', label: 'Secret', type: 'password', default: '', required: true, when: { mode: 'b' } },
];

test('applyDefaults complète et type les valeurs', () => {
  assert.deepEqual(applyDefaults(schema, {}), { name: 'x', n: 5, on: true, mode: 'a', secret: '' });
  assert.deepEqual(applyDefaults(schema, { n: '42', on: 'false', extra: 1 }), { name: 'x', n: 10, on: false, mode: 'a', secret: '' });
  assert.equal(applyDefaults(schema, { n: 'abc' }).n, 5);
  assert.equal(applyDefaults(schema, { name: '' }).name, '', 'un texte vidé volontairement reste vide');
});

const manifests = { t: { name: 'T', size: { min: { w: 2, h: 2 } }, schema } };
const base = { grid: { cols: 12, rows: 6 } };

test('config valide', () => {
  const cfg = Object.assign({}, base, { widgets: [{ id: 'a', type: 't', col: 1, row: 1, w: 2, h: 2, settings: {} }] });
  assert.deepEqual(validateConfig(cfg, manifests), []);
});

test('erreurs détectées', () => {
  const cfg = Object.assign({}, base, { widgets: [
    { id: 'a', type: 't', col: 1, row: 1, w: 3, h: 2, settings: { name: '' } },
    { id: 'b', type: 't', col: 2, row: 2, w: 2, h: 2, settings: { mode: 'b' } },
    { id: 'b', type: 'inconnu', col: 1, row: 5, w: 1, h: 1 },
    { id: 'c', type: 't', col: 12, row: 1, w: 2, h: 1 },
  ] });
  const msgs = validateConfig(cfg, manifests).map((e) => e.message).join('\n');
  assert.match(msgs, /champ requis « Nom »/);
  assert.match(msgs, /champ requis « Secret »/);
  assert.match(msgs, /Id en double/);
  assert.match(msgs, /inconnu/);
  assert.match(msgs, /dépasse/);
  assert.match(msgs, /plus petit/);
  assert.match(msgs, /a et b se chevauchent/);
});

test('findFreeSpot et chevauchement', () => {
  const widgets = [{ col: 1, row: 1, w: 12, h: 2 }, { col: 1, row: 3, w: 6, h: 4 }];
  assert.deepEqual(findFreeSpot(widgets, { cols: 12, rows: 6 }, 4, 2), { col: 7, row: 3, w: 4, h: 2 });
  assert.equal(findFreeSpot(widgets, { cols: 12, rows: 6 }, 7, 1), null);
  assert.equal(rectsOverlap({ col: 1, row: 1, w: 2, h: 2 }, { col: 3, row: 1, w: 1, h: 1 }), false);
});

test('la config d’exemple n’a pas d’erreur de disposition', async () => {
  const fs = await import('node:fs');
  const { loadManifests } = await import('../tools/widgets.js');
  const cfg = JSON.parse(fs.readFileSync(new URL('../config/dashboard.example.json', import.meta.url), 'utf8'));
  const layoutErrors = validateConfig(cfg, await loadManifests()).filter((e) => !/champ requis/.test(e.message));
  assert.deepEqual(layoutErrors, []);
});
