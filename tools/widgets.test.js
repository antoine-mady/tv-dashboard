// Garde-fou : chaque widget respecte le contrat décrit dans CLAUDE.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { listWidgets, loadManifests } from './widgets.js';

const TYPES = ['text', 'password', 'number', 'bool', 'select', 'color', 'time', 'textarea'];

test('tous les widgets respectent le contrat', async () => {
  const manifests = await loadManifests();
  const widgets = listWidgets();
  assert.ok(widgets.length > 0);
  for (const w of widgets) {
    const m = manifests[w.type];
    const where = 'widgets/' + w.type + ' : ';
    assert.equal(m.type, w.type, where + 'manifest.type doit être égal au nom du dossier');
    assert.ok(m.name && m.icon, where + 'name et icon requis');
    assert.ok(w.hasTv, where + 'tv.js manquant');
    assert.ok(m.size && m.size.default && m.size.min, where + 'size.default et size.min requis');
    assert.ok(m.size.default.w >= m.size.min.w && m.size.default.h >= m.size.min.h, where + 'size.default < size.min');
    const keys = new Set();
    for (const f of m.schema || []) {
      assert.ok(f.key && f.label, where + 'champ sans key/label');
      assert.ok(!keys.has(f.key), where + 'clé en double : ' + f.key);
      keys.add(f.key);
      assert.ok(TYPES.includes(f.type), where + 'type de champ inconnu : ' + f.type);
      if (f.type === 'select') assert.ok(Array.isArray(f.options) && f.options.length, where + f.key + ' : options requises');
      if (f.when) Object.keys(f.when).forEach((k) => assert.ok((m.schema || []).some((x) => x.key === k), where + f.key + ' : when référence une clé inconnue ' + k));
    }
    if (w.hasCss) {
      const css = fs.readFileSync(path.join(w.dir, 'tv.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
      const selectors = css.split('}').map((b) => b.split('{')[0].trim()).filter(Boolean);
      for (const sel of selectors) {
        sel.split(',').forEach((s) => assert.ok(s.trim().startsWith('.w-' + w.type), where + 'sélecteur CSS non préfixé par .w-' + w.type + ' : ' + s.trim()));
      }
    }
  }
});
