import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { findExecutable, apps2SamsungSteps } from './deploy.js';

test('findExecutable : cherche dans le PATH', () => {
  const bin = path.join('/opt', 'tizen', 'bin');
  const files = new Set([path.join(bin, 'tizen')]);
  const opts = { env: { PATH: '/usr/bin:' + bin }, platform: 'linux', exists: (p) => files.has(p) };
  assert.equal(findExecutable('tizen', opts), path.join(bin, 'tizen'));
  assert.equal(findExecutable('sdb', opts), null);
  assert.equal(findExecutable('', opts), null);
});

test('findExecutable : chemin explicite', () => {
  const p = path.join('/home', 'me', 'tizen-studio', 'tools', 'sdb');
  assert.equal(findExecutable(p, { env: {}, platform: 'linux', exists: (x) => x === p }), p);
  assert.equal(findExecutable(p, { env: {}, platform: 'linux', exists: () => false }), null);
});

test('findExecutable : extensions Windows (PATHEXT)', () => {
  const dir = 'C:\\tizen\\tools';
  const want = path.join(dir, 'sdb') + '.EXE';
  const opts = { env: { Path: dir, PATHEXT: '.EXE;.BAT' }, platform: 'win32', exists: (p) => p === want };
  assert.equal(findExecutable('sdb', opts), want);
});

test('apps2SamsungSteps : mentionne le fichier', () => {
  assert.ok(apps2SamsungSteps('/x/TVDashboard.wgt').some((l) => l.includes('/x/TVDashboard.wgt')));
});
