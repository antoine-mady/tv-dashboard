import Widget from '../../app/Widget.js';
import { h } from '../../app/dom.js';
import { qrSvg } from '../../app/qr.js';
import { buildWifiString, passwordOf } from './wifi.js';

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
