import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { backupName, parseBackupName, toPrune, saveBackup, listBackups, readBackup } from './backups.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'tvdash-backups-'));
const cfg = (n) => ({ pages: [{ id: 'p', name: 'Moi', widgets: Array.from({ length: n }, (_, i) => ({ id: 'w' + i })) }] });

test('nom de sauvegarde : aller-retour', () => {
  const d = new Date(2026, 10, 6, 9, 5, 3);
  const name = backupName(d, 'deploy');
  assert.equal(name, 'dashboard-2026-11-06_09-05-03-deploy.json');
  const info = parseBackupName(name);
  assert.equal(info.reason, 'deploy');
  assert.equal(info.date.getTime(), d.getTime());
  assert.equal(backupName(d, 'bizarre'), 'dashboard-2026-11-06_09-05-03-manual.json');
});

test('noms invalides refusés (chemins, autres fichiers)', () => {
  assert.equal(parseBackupName('../dashboard.json'), null);
  assert.equal(parseBackupName('dashboard-2026-11-06_09-05-03-deploy.json/../../x'), null);
  assert.equal(parseBackupName('notes.txt'), null);
});

test('toPrune garde les plus récentes', () => {
  const names = ['dashboard-2026-01-03_00-00-00-deploy.json', 'dashboard-2026-01-01_00-00-00-deploy.json', 'x.txt',
    'dashboard-2026-01-02_00-00-00-manual.json'];
  assert.deepEqual(toPrune(names, 2), ['dashboard-2026-01-01_00-00-00-deploy.json']);
  assert.deepEqual(toPrune(names, 5), []);
});

test('saveBackup : pas de doublon, limite, liste et lecture', () => {
  const dir = tmp();
  const t = (s) => new Date(2026, 0, 1, 10, 0, s);
  assert.ok(saveBackup(dir, cfg(1), 'deploy', { now: t(1) }));
  assert.equal(saveBackup(dir, cfg(1), 'deploy', { now: t(2) }), null); // identique à la dernière
  assert.ok(saveBackup(dir, cfg(2), 'manual', { now: t(3), keep: 2 }));
  assert.ok(saveBackup(dir, cfg(3), 'wgt', { now: t(4), keep: 2 }));
  const list = listBackups(dir);
  assert.equal(list.length, 2);
  assert.equal(list[0].reason, 'wgt');
  assert.equal(list[0].widgets, 3);
  assert.deepEqual(list[0].pageNames, ['Moi']);
  assert.deepEqual(readBackup(dir, list[1].name), cfg(2));
  assert.equal(readBackup(dir, '../x.json'), null);
});

test('deux sauvegardes la même seconde', () => {
  const dir = tmp();
  const now = new Date(2026, 0, 1, 10, 0, 0);
  const a = saveBackup(dir, cfg(1), 'manual', { now });
  const b = saveBackup(dir, cfg(2), 'manual', { now });
  assert.notEqual(a, b);
  assert.equal(listBackups(dir).length, 2);
});

test('dossier absent : liste vide', () => {
  assert.deepEqual(listBackups(path.join(tmp(), 'absent')), []);
});
