// Chaîne standard des QR codes Wi-Fi (reconnue par iOS et Android). Pur, testé.

/** Échappe \ ; , : " comme l'exige le format WIFI:. */
export function escapeWifi(value) {
  return String(value).replace(/([\\;,:"])/g, '\\$1');
}

export function passwordOf(s) {
  if (s.security === 'nopass') return '';
  return s.security === 'WEP' ? s.passwordWep : s.password;
}

export function buildWifiString(s) {
  let out = 'WIFI:T:' + (s.security || 'WPA') + ';S:' + escapeWifi(s.ssid) + ';';
  if (s.security !== 'nopass') out += 'P:' + escapeWifi(passwordOf(s)) + ';';
  if (s.hidden) out += 'H:true;';
  return out + ';';
}
