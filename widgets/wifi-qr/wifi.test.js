import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildWifiString, escapeWifi } from './wifi.js';

test('échappement des caractères spéciaux', () => {
  assert.equal(escapeWifi('a;b,c:d"e\\f'), 'a\\;b\\,c\\:d\\"e\\\\f');
});

test('WPA', () => {
  assert.equal(buildWifiString({ ssid: 'Maison', security: 'WPA', password: 'p@ss;1', hidden: false }),
    'WIFI:T:WPA;S:Maison;P:p@ss\\;1;;');
});

test('WEP masqué', () => {
  assert.equal(buildWifiString({ ssid: 'Old', security: 'WEP', passwordWep: 'abc', hidden: true }),
    'WIFI:T:WEP;S:Old;P:abc;H:true;;');
});

test('réseau ouvert sans mot de passe', () => {
  assert.equal(buildWifiString({ ssid: 'Invités', security: 'nopass', password: 'ignored' }), 'WIFI:T:nopass;S:Invités;;');
});
