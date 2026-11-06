import { test } from 'node:test';
import assert from 'node:assert/strict';
import { insertText, detectEngines, utteranceOf, errorMessage } from './dictation.js';
import { normalizeKey } from './remote.js';

test('insertText : champ vide → texte dicté', () => {
  assert.deepEqual(insertText('', '  daft   punk ', 0, 0), { value: 'daft punk', caret: 9 });
  assert.deepEqual(insertText('   ', 'abba', 1, 1), { value: 'abba', caret: 4 });
  assert.deepEqual(insertText(null, 'abba'), { value: 'abba', caret: 4 });
});

test('insertText : insertion au curseur avec espaces, remplacement de la sélection', () => {
  assert.deepEqual(insertText('daft', 'punk', 4, 4), { value: 'daft punk', caret: 9 });
  assert.deepEqual(insertText('daft', 'punk'), { value: 'daft punk', caret: 9 });
  assert.deepEqual(insertText('one more', 'time', 3, 3), { value: 'one time more', caret: 8 });
  assert.deepEqual(insertText('daft ', 'punk', 5, 5), { value: 'daft punk', caret: 9 });
  assert.deepEqual(insertText('daft punk', 'abba', 0, 9), { value: 'abba', caret: 4 });
});

test('insertText : rien dicté → valeur inchangée', () => {
  assert.deepEqual(insertText('daft', '  ', 2, 2), { value: 'daft', caret: 2 });
});

test('detectEngines : Samsung Voice Interaction et reconnaissance vocale web', () => {
  assert.deepEqual(detectEngines({}), {});
  function SR() {}
  const vi = { setCallback() {}, listen() {} };
  assert.equal(detectEngines({ webkitSpeechRecognition: SR }).Speech, SR);
  assert.equal(detectEngines({ SpeechRecognition: SR }).Speech, SR);
  assert.equal(detectEngines({ webapis: { voiceinteraction: vi } }).samsung, vi);
  assert.deepEqual(detectEngines({ webapis: { voiceinteraction: {} } }), {});
});

test('utteranceOf : texte prononcé', () => {
  const vi = { getDataFromSearchTerm: (t, f) => (f === 'SEARCH_TERM_UTTERANCE' ? t.u : '') };
  assert.equal(utteranceOf(vi, { u: 'stromae' }), 'stromae');
  const broken = { getDataFromSearchTerm() { throw new Error('x'); } };
  assert.equal(utteranceOf(broken, 'angèle'), 'angèle');
  assert.equal(utteranceOf(broken, { utterance: 'zaz' }), 'zaz');
  assert.equal(utteranceOf(broken, null), '');
});

test('errorMessage et touche F2 (dictée dans l’aperçu)', () => {
  assert.equal(errorMessage('not-allowed'), 'Accès au micro refusé');
  assert.match(errorMessage('weird'), /weird/);
  assert.equal(normalizeKey(113), 'mic');
});
