// Extension serveur (admin uniquement, tourne sur le PC) : découverte des serveurs DLNA du réseau.
// Les routes sont exposées sous /api/widgets/photos/<route>.
import dgram from 'node:dgram';
import { parseDeviceDescription } from './dlna.js';

const SSDP_ADDR = '239.255.255.250';
const SSDP_PORT = 1900;

function mSearch(st) {
  return Buffer.from([
    'M-SEARCH * HTTP/1.1',
    'HOST: ' + SSDP_ADDR + ':' + SSDP_PORT,
    'MAN: "ssdp:discover"',
    'MX: 2',
    'ST: ' + st,
    '', '',
  ].join('\r\n'));
}

async function discover(timeoutMs) {
  const locations = new Set();
  const sock = dgram.createSocket({ type: 'udp4', reuseAddr: true });
  sock.on('message', (msg) => {
    const m = /^location:\s*(.+)$/im.exec(msg.toString());
    if (m) locations.add(m[1].trim());
  });
  await new Promise((resolve, reject) => { sock.once('error', reject); sock.bind(0, resolve); });
  for (const st of ['urn:schemas-upnp-org:device:MediaServer:1', 'urn:schemas-upnp-org:service:ContentDirectory:1']) {
    sock.send(mSearch(st), SSDP_PORT, SSDP_ADDR);
  }
  await new Promise((r) => setTimeout(r, timeoutMs));
  sock.close();

  const found = await Promise.all([...locations].map(async (loc) => {
    try {
      const r = await fetch(loc, { signal: AbortSignal.timeout(3000) });
      return parseDeviceDescription(await r.text(), loc);
    } catch {
      return null;
    }
  }));
  const unique = {};
  found.filter(Boolean).forEach((s) => { unique[s.controlUrl] = s; });
  return Object.values(unique);
}

export default {
  routes: {
    'GET /discover': async () => ({ servers: await discover(3000) }),
  },
};
