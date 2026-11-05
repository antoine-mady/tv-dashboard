import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBrowseResponse, pickResource, browseEnvelope, crawl, parseDeviceDescription, shuffle } from './dlna.js';

const didl = '<DIDL-Lite xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/">'
  + '<container id="64$1" parentID="64" restricted="1" childCount="2"><dc:title>Vacances &amp; amis</dc:title><upnp:class>object.container.storageFolder</upnp:class></container>'
  + '<item id="64$2" parentID="64" restricted="1"><dc:title>IMG_001.jpg</dc:title><dc:date>2024-07-14</dc:date><upnp:class>object.item.imageItem.photo</upnp:class>'
  + '<res protocolInfo="http-get:*:image/jpeg:DLNA.ORG_PN=JPEG_TN" resolution="160x120">http://192.168.1.1:8200/Thumbnails/2.jpg</res>'
  + '<res protocolInfo="http-get:*:image/jpeg:*" resolution="4000x3000">http://192.168.1.1:8200/MediaItems/2.jpg?a=1&amp;b=2</res>'
  + '</item>'
  + '<item id="64$3" parentID="64"><dc:title>clip.mp4</dc:title><upnp:class>object.item.videoItem</upnp:class><res protocolInfo="http-get:*:video/mp4:*">http://x/v.mp4</res></item>'
  + '</DIDL-Lite>';

function soap(didlXml, returned, total) {
  const escaped = didlXml.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return '<?xml version="1.0"?><s:Envelope><s:Body><u:BrowseResponse><Result>' + escaped + '</Result>'
    + '<NumberReturned>' + returned + '</NumberReturned><TotalMatches>' + total + '</TotalMatches></u:BrowseResponse></s:Body></s:Envelope>';
}

test('parse une réponse Browse (dossiers + images, ignore les vidéos)', () => {
  const r = parseBrowseResponse(soap(didl, 3, 3));
  assert.deepEqual(r.containers, [{ id: '64$1', title: 'Vacances & amis' }]);
  assert.equal(r.items.length, 1);
  assert.deepEqual(r.items[0], { id: '64$2', title: 'IMG_001.jpg', date: '2024-07-14', url: 'http://192.168.1.1:8200/MediaItems/2.jpg?a=1&b=2' });
  assert.equal(r.total, 3);
});

test('choix de la ressource image', () => {
  const res = [
    { protocolInfo: 'http-get:*:image/jpeg:*', resolution: '160x120', url: 'thumb' },
    { protocolInfo: 'http-get:*:image/jpeg:*', resolution: '1920x1440', url: 'large' },
    { protocolInfo: 'http-get:*:image/jpeg:*', resolution: '6000x4000', url: 'orig' },
  ];
  assert.equal(pickResource(res), 'large');
  assert.equal(pickResource(res.slice(0, 1)), 'thumb');
  assert.equal(pickResource([{ protocolInfo: 'http-get:*:image/png:*', resolution: '', url: 'u' }]), 'u');
  assert.equal(pickResource([{ protocolInfo: 'http-get:*:video/mp4:*', url: 'v' }]), null);
});

test('enveloppe SOAP', () => {
  const env = browseEnvelope('64$1&x', 200, 100);
  assert.match(env, /<ObjectID>64\$1&amp;x<\/ObjectID>/);
  assert.match(env, /<StartingIndex>200<\/StartingIndex>/);
});

test('crawl récursif avec pagination', async () => {
  const tree = {
    0: { containers: ['A', 'B'], items: ['r1'] },
    A: { containers: [], items: ['a1', 'a2', 'a3'] },
    B: { containers: ['C'], items: [] },
    C: { containers: [], items: ['c1'] },
  };
  const fetchText = async (url, opts) => {
    const id = /<ObjectID>(.*?)<\/ObjectID>/.exec(opts.body)[1];
    const start = Number(/<StartingIndex>(\d+)/.exec(opts.body)[1]);
    const node = tree[id];
    const all = node.containers.map((c) => '<container id="' + c + '"><dc:title>' + c + '</dc:title></container>')
      .concat(node.items.map((i) => '<item id="' + i + '"><dc:title>' + i + '</dc:title><upnp:class>object.item.imageItem</upnp:class><res protocolInfo="http-get:*:image/jpeg:*">http://h/' + i + '.jpg</res></item>'));
    const count = Number(/<RequestedCount>(\d+)/.exec(opts.body)[1]);
    const page = all.slice(start, start + count);
    return soap('<DIDL-Lite>' + page.join('') + '</DIDL-Lite>', page.length, all.length);
  };
  const photos = await crawl(fetchText, 'http://h/ctl', '0', { pageSize: 2 }); // pages de 2 → pagination testée
  assert.deepEqual(photos.map((p) => p.id).sort(), ['a1', 'a2', 'a3', 'c1', 'r1']);
  const limited = await crawl(fetchText, 'http://h/ctl', '0', { pageSize: 2, max: 2 });
  assert.equal(limited.length, 2);
});

test('description d’appareil UPnP', () => {
  const xml = '<root><URLBase>http://192.168.1.1:8200/</URLBase><device><friendlyName>Zeop Box</friendlyName><serviceList>'
    + '<service><serviceType>urn:schemas-upnp-org:service:ConnectionManager:1</serviceType><controlURL>/ctl/CM</controlURL></service>'
    + '<service><serviceType>urn:schemas-upnp-org:service:ContentDirectory:1</serviceType><controlURL>/ctl/ContentDir</controlURL></service>'
    + '</serviceList></device></root>';
  assert.deepEqual(parseDeviceDescription(xml, 'http://192.168.1.1:8200/rootDesc.xml'),
    { name: 'Zeop Box', controlUrl: 'http://192.168.1.1:8200/ctl/ContentDir', location: 'http://192.168.1.1:8200/rootDesc.xml' });
});

test('shuffle conserve les éléments', () => {
  assert.deepEqual(shuffle([1, 2, 3, 4, 5]).sort(), [1, 2, 3, 4, 5]);
});
