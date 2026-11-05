// Client DLNA / UPnP minimal (ContentDirectory:Browse) — PUR : utilisé par la TV, l'admin et les tests.
// Parsing par expressions régulières (pas de DOMParser) pour fonctionner aussi sous Node.

export const SOAP_ACTION = '"urn:schemas-upnp-org:service:ContentDirectory:1#Browse"';

export function decodeEntities(str) {
  return String(str)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&amp;/g, '&');
}

function escapeXml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function browseEnvelope(objectId, start, count) {
  return '<?xml version="1.0" encoding="utf-8"?>'
    + '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">'
    + '<s:Body><u:Browse xmlns:u="urn:schemas-upnp-org:service:ContentDirectory:1">'
    + '<ObjectID>' + escapeXml(objectId) + '</ObjectID>'
    + '<BrowseFlag>BrowseDirectChildren</BrowseFlag>'
    + '<Filter>*</Filter>'
    + '<StartingIndex>' + start + '</StartingIndex>'
    + '<RequestedCount>' + count + '</RequestedCount>'
    + '<SortCriteria></SortCriteria>'
    + '</u:Browse></s:Body></s:Envelope>';
}

function tagText(xml, tag) {
  const m = new RegExp('<' + tag + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + tag + '>', 'i').exec(xml);
  return m ? m[1].trim() : '';
}

function attr(attrs, name) {
  const m = new RegExp('(?:^|\\s)' + name + '="([^"]*)"', 'i').exec(attrs);
  return m ? decodeEntities(m[1]) : '';
}

/** Parmi les <res>, choisit l'image la plus légère qui couvre encore un écran 1080p, sinon la plus grande. */
export function pickResource(resList) {
  const images = resList.filter((r) => /image\//i.test(r.protocolInfo) || !r.protocolInfo);
  if (!images.length) return null;
  const withRes = images.map((r) => {
    const m = /(\d+)x(\d+)/.exec(r.resolution || '');
    return { url: r.url, w: m ? Number(m[1]) : 0, h: m ? Number(m[2]) : 0 };
  });
  const known = withRes.filter((r) => r.w > 0);
  if (!known.length) return images[0].url;
  const bigEnough = known.filter((r) => Math.max(r.w, r.h) >= 1920 || Math.min(r.w, r.h) >= 1080)
    .sort((a, b) => a.w * a.h - b.w * b.h);
  if (bigEnough.length) return bigEnough[0].url;
  return known.sort((a, b) => b.w * b.h - a.w * a.h)[0].url;
}

/** Réponse SOAP Browse → { containers: [{id,title}], items: [{id,title,url,date}], returned, total }. */
export function parseBrowseResponse(soapXml) {
  let didl = tagText(soapXml, 'Result');
  if (/^<!\[CDATA\[/.test(didl)) didl = didl.replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '');
  else didl = decodeEntities(didl);

  const containers = [];
  const items = [];
  const containerRe = /<container\b([^>]*)>([\s\S]*?)<\/container>/gi;
  const itemRe = /<item\b([^>]*)>([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = containerRe.exec(didl))) {
    containers.push({ id: attr(m[1], 'id'), title: decodeEntities(tagText(m[2], 'dc:title')) });
  }
  while ((m = itemRe.exec(didl))) {
    const body = m[2];
    const cls = tagText(body, 'upnp:class');
    const res = [];
    const resRe = /<res\b([^>]*)>([\s\S]*?)<\/res>/gi;
    let r;
    while ((r = resRe.exec(body))) {
      res.push({ protocolInfo: attr(r[1], 'protocolInfo'), resolution: attr(r[1], 'resolution'), url: decodeEntities(r[2].trim()) });
    }
    const isImage = /imageItem/i.test(cls) || res.some((x) => /image\//i.test(x.protocolInfo));
    if (!isImage) continue;
    const url = pickResource(res);
    if (!url) continue;
    items.push({
      id: attr(m[1], 'id'),
      title: decodeEntities(tagText(body, 'dc:title')),
      date: tagText(body, 'dc:date'),
      url,
    });
  }
  return {
    containers,
    items,
    returned: Number(tagText(soapXml, 'NumberReturned')) || containers.length + items.length,
    total: Number(tagText(soapXml, 'TotalMatches')) || 0,
  };
}

/**
 * Liste un dossier complet (avec pagination).
 * fetchText(url, { method, headers, body }) → Promise<string>
 */
export async function browseAll(fetchText, controlUrl, objectId, pageSize) {
  const size = pageSize || 200;
  const out = { containers: [], items: [] };
  for (let start = 0; ; start += size) {
    const xml = await fetchText(controlUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml; charset="utf-8"', SOAPACTION: SOAP_ACTION },
      body: browseEnvelope(objectId, start, size),
    });
    const page = parseBrowseResponse(xml);
    out.containers = out.containers.concat(page.containers);
    out.items = out.items.concat(page.items);
    if (!page.returned || start + page.returned >= page.total || page.returned < size) break;
  }
  return out;
}

/** Parcourt récursivement les dossiers à partir de rootId et renvoie toutes les images (max `max`). */
export async function crawl(fetchText, controlUrl, rootId, opts) {
  const o = opts || {};
  const max = o.max || 5000;
  const queue = [rootId || '0'];
  const seen = {};
  let photos = [];
  while (queue.length && photos.length < max) {
    const id = queue.shift();
    if (seen[id]) continue;
    seen[id] = true;
    const res = await browseAll(fetchText, controlUrl, id, o.pageSize);
    photos = photos.concat(res.items);
    res.containers.forEach((c) => queue.push(c.id));
    if (o.onProgress) o.onProgress(photos.length);
  }
  return photos.slice(0, max);
}

/** Description d'appareil UPnP (XML) → { name, controlUrl } du service ContentDirectory, ou null. */
export function parseDeviceDescription(xml, location) {
  const name = decodeEntities(tagText(xml, 'friendlyName')) || 'Serveur DLNA';
  const services = xml.match(/<service>[\s\S]*?<\/service>/gi) || [];
  const cd = services.find((s) => /ContentDirectory/i.test(tagText(s, 'serviceType')));
  if (!cd) return null;
  const base = tagText(xml, 'URLBase') || location;
  return { name, controlUrl: new URL(tagText(cd, 'controlURL'), base).href, location };
}

/** Mélange de Fisher-Yates (copie). */
export function shuffle(list, random) {
  const rnd = random || Math.random;
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}
