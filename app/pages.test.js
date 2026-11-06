import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stepPage, initialPage, sameWidget } from './pages.js';
import { getPages, normalizeConfig, validateConfig } from './config.js';
import { normalizeKey } from './remote.js';

test('stepPage boucle dans les deux sens', () => {
  assert.equal(stepPage(3, 0, 1), 1);
  assert.equal(stepPage(3, 2, 1), 0);
  assert.equal(stepPage(3, 0, -1), 2);
  assert.equal(stepPage(1, 0, 1), 0);
  assert.equal(stepPage(0, 0, 1), 0);
});

test('initialPage : demandée > mémorisée > première', () => {
  const pages = [{ id: 'moi' }, { id: 'invites' }];
  assert.equal(initialPage(pages, {}), 0);
  assert.equal(initialPage(pages, { saved: 'invites', remember: true }), 1);
  assert.equal(initialPage(pages, { saved: 'invites', remember: false }), 0);
  assert.equal(initialPage(pages, { saved: 'supprimee', remember: true }), 0);
  assert.equal(initialPage(pages, { requested: 'invites' }), 1);
  assert.equal(initialPage(pages, { requested: 'moi', saved: 'invites', remember: true }), 0);
});

test('sameWidget : même id, type, place et réglages', () => {
  const a = { id: 'music-1', type: 'music', col: 1, row: 1, w: 3, h: 2, settings: { volume: 60 } };
  assert.ok(sameWidget(a, JSON.parse(JSON.stringify(a))));
  assert.ok(!sameWidget(a, Object.assign({}, a, { col: 2 })));
  assert.ok(!sameWidget(a, Object.assign({}, a, { settings: { volume: 50 } })));
  assert.ok(!sameWidget(a, Object.assign({}, a, { id: 'music-2' })));
  assert.ok(!sameWidget(a, null));
});

test('getPages / normalizeConfig : migration de l’ancien format', () => {
  const old = { grid: { cols: 12, rows: 6 }, widgets: [{ id: 'a' }] };
  assert.deepEqual(getPages(old), [{ id: 'page-1', name: 'Principal', widgets: [{ id: 'a' }] }]);
  const n = normalizeConfig(old);
  assert.equal(n.widgets, undefined);
  assert.equal(n.pages[0].widgets[0].id, 'a');
  assert.deepEqual(n.grid, old.grid);
  assert.deepEqual(getPages({}), [{ id: 'page-1', name: 'Principal', widgets: [] }]);
  assert.equal(getPages({ pages: [{ name: 'X' }] })[0].id, 'page-1');
});

test('validateConfig : chaque page est validée séparément', () => {
  const manifests = { t: { name: 'T', size: { min: { w: 1, h: 1 } }, schema: [] } };
  const w = { id: 'a', type: 't', col: 1, row: 1, w: 2, h: 2 };
  // Même widget (même id, même place) sur deux pages : autorisé.
  const ok = { pages: [{ id: 'p1', name: 'Moi', widgets: [w] }, { id: 'p2', name: 'Invités', widgets: [w] }] };
  assert.deepEqual(validateConfig(ok, manifests), []);
  const bad = { pages: [
    { id: 'p1', name: 'Moi', widgets: [w] },
    { id: 'p2', name: 'Invités', widgets: [w, Object.assign({}, w, { id: 'b' })] },
  ] };
  const errors = validateConfig(bad, manifests);
  assert.equal(errors.length, 1);
  assert.equal(errors[0].pageId, 'p2');
  assert.match(errors[0].message, /^Invités · a et b se chevauchent/);
});

test('touches de chaîne : CH▲ / CH▼ (et Page↑ / Page↓ au clavier)', () => {
  assert.equal(normalizeKey(427), 'chup');
  assert.equal(normalizeKey(428), 'chdown');
  assert.equal(normalizeKey(33), 'chup');
  assert.equal(normalizeKey(34), 'chdown');
});
