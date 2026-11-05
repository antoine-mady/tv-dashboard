import qrcode from 'qrcode-generator';
import Widget from '../../app/Widget.js';
import { h } from '../../app/dom.js';
import { buildWifiString, passwordOf } from './wifi.js';

/** QR code → SVG (un seul <path>, net à toutes les tailles). */
function qrSvg(text) {
  const qr = qrcode(0, 'M');
  qr.addData(unescape(encodeURIComponent(text))); // UTF-8 (SSID avec accents)
  qr.make();
  const n = qr.getModuleCount();
  const margin = 2;
  let d = '';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.isDark(r, c)) d += 'M' + (c + margin) + ' ' + (r + margin) + 'h1v1h-1z';
    }
  }
  const size = n + margin * 2;
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + size + ' ' + size + '" shape-rendering="crispEdges">'
    + '<rect width="100%" height="100%" fill="#fff"/><path d="' + d + '" fill="#000"/></svg>';
}

export default class WifiQrWidget extends Widget {
  mount(el, s) {
    if (!s.ssid) throw new Error('Renseignez le nom du réseau Wi-Fi');
    const pwd = passwordOf(s);
    el.appendChild(h('div', { className: 'wq-title', text: s.title }));
    el.appendChild(h('div', { className: 'wq-code', html: qrSvg(buildWifiString(s)) }));
    el.appendChild(h('div', { className: 'wq-info' },
      h('div', { className: 'wq-ssid ellipsis', text: s.ssid }),
      s.showPassword && pwd ? h('div', { className: 'wq-pass muted ellipsis', text: pwd }) : null));
  }
}
