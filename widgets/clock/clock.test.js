import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatTime, formatDate } from './format.js';

const d = new Date(Date.UTC(2026, 10, 5, 6, 7, 9)); // jeudi 5 novembre 2026, 06:07:09 UTC

test('heure 24h avec fuseau', () => {
  assert.equal(formatTime(d, { timeZone: 'Indian/Reunion' }), '10:07');
  assert.equal(formatTime(d, { timeZone: 'UTC', seconds: true }), '06:07:09');
});

test('date en français avec majuscule', () => {
  assert.equal(formatDate(d, { timeZone: 'Indian/Reunion' }), 'Jeudi 5 novembre');
});
