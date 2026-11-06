import { test } from 'node:test';
import assert from 'node:assert/strict';
import { helpLines } from './help.js';

const keys = (lines) => lines.map((l) => l.keys);

test('page simple sans widget à piloter', () => {
  assert.deepEqual(keys(helpLines({ pageCount: 1 })), ['Retour', 'Info']);
});

test('plusieurs pages, touche couleur, widgets focusables', () => {
  const lines = helpLines({ pageCount: 3, pageKey: 'green', hasFocusables: true });
  assert.deepEqual(keys(lines), ['◀ ▶ ▲ ▼', 'OK', 'CH ▲ / CH ▼', 'Verte', 'Retour', 'Info']);
  assert.match(lines[2].text, /3 pages/);
});

test('aide des widgets ajoutée, sans doublon', () => {
  const lines = helpLines({ pageCount: 1, widgetHelp: [['⏯', 'Lecture / pause'], ['⏯', 'autre'], ['Rouge', 'App YouTube'], [null, 'x']] });
  assert.deepEqual(keys(lines), ['⏯', 'Rouge', 'Retour', 'Info']);
  assert.equal(lines[0].text, 'Lecture / pause');
});
