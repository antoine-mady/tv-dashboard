// Décodeur GTFS-RT minimal (Protocol Buffers) — PUR, sans dépendance, compatible Chrome 56.
// Ne lit que ce dont le widget a besoin : retards des courses (TripUpdate) et alertes (Alert).
// Référence : https://gtfs.org/realtime/reference/

function Reader(buf, start, end) {
  this.buf = buf;
  this.pos = start || 0;
  this.end = end === undefined ? buf.length : end;
}

/** Varint → { num: valeur (float, exacte jusqu'à 2^53), lo: 32 bits de poids faible (pour les int32) }. */
Reader.prototype.varint = function () {
  let num = 0;
  let lo = 0;
  let mul = 1;
  let shift = 0;
  for (;;) {
    if (this.pos >= this.end) throw new Error('GTFS-RT : flux tronqué');
    const b = this.buf[this.pos++];
    num += (b & 0x7f) * mul;
    if (shift < 32) lo |= (b & 0x7f) << shift;
    mul *= 128;
    shift += 7;
    if (!(b & 0x80)) break;
    if (shift > 70) throw new Error('GTFS-RT : varint invalide');
  }
  return { num, lo };
};

Reader.prototype.skip = function (wire) {
  if (wire === 0) this.varint();
  else if (wire === 1) this.pos += 8;
  else if (wire === 2) { const n = this.varint().num; this.pos += n; } else if (wire === 5) this.pos += 4;
  else throw new Error('GTFS-RT : type de champ non géré (' + wire + ')');
  if (this.pos > this.end) throw new Error('GTFS-RT : flux tronqué');
};

/** Parcourt les champs du message : fn(numéro, typeFil, reader). fn doit lire ou laisser `skip` faire. */
function each(buf, start, end, fn) {
  const r = new Reader(buf, start, end);
  while (r.pos < r.end) {
    const tag = r.varint().num;
    const field = Math.floor(tag / 8);
    const wire = tag % 8;
    const before = r.pos;
    const handled = fn(field, wire, r);
    if (!handled) { r.pos = before; r.skip(wire); }
  }
}

/** Sous-message ou chaîne : [début, fin] dans le tampon. */
function span(r) {
  const n = r.varint().num;
  const s = r.pos;
  r.pos += n;
  if (r.pos > r.end) throw new Error('GTFS-RT : flux tronqué');
  return [s, r.pos];
}

function utf8(buf, s, e) {
  const bytes = buf.subarray(s, e);
  if (typeof TextDecoder !== 'undefined') return new TextDecoder('utf-8').decode(bytes);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  try { return decodeURIComponent(escape(bin)); } catch (err) { return bin; }
}

function str(buf, r) {
  const sp = span(r);
  return utf8(buf, sp[0], sp[1]);
}

function int32(r) { return r.varint().lo | 0; }

function stopTimeEvent(buf, s, e) {
  const ev = { delay: null, time: null };
  each(buf, s, e, (f, w, r) => {
    if (f === 1 && w === 0) { ev.delay = int32(r); return true; }
    if (f === 2 && w === 0) { ev.time = r.varint().num; return true; }
    return false;
  });
  return ev;
}

function stopTimeUpdate(buf, s, e) {
  const u = { seq: null, stopId: '', delay: null, time: null, skipped: false };
  let arr = null;
  let dep = null;
  each(buf, s, e, (f, w, r) => {
    if (f === 1 && w === 0) { u.seq = r.varint().num; return true; }
    if (f === 2 && w === 2) { const sp = span(r); arr = stopTimeEvent(buf, sp[0], sp[1]); return true; }
    if (f === 3 && w === 2) { const sp = span(r); dep = stopTimeEvent(buf, sp[0], sp[1]); return true; }
    if (f === 4 && w === 2) { u.stopId = str(buf, r); return true; }
    if (f === 5 && w === 0) { u.skipped = r.varint().num === 1; return true; } // SKIPPED
    return false;
  });
  // Pour un départ, l'heure de départ prime sur l'heure d'arrivée.
  [arr, dep].forEach((ev) => {
    if (!ev) return;
    if (ev.time) u.time = ev.time;
    if (ev.delay !== null) u.delay = ev.delay;
  });
  return u;
}

function tripUpdate(buf, s, e) {
  const t = { tripId: '', routeId: '', startDate: '', canceled: false, delay: null, stops: [] };
  each(buf, s, e, (f, w, r) => {
    if (f === 1 && w === 2) { // TripDescriptor
      const sp = span(r);
      each(buf, sp[0], sp[1], (g, w2, r2) => {
        if (g === 1 && w2 === 2) { t.tripId = str(buf, r2); return true; }
        if (g === 3 && w2 === 2) { t.startDate = str(buf, r2); return true; }
        if (g === 4 && w2 === 0) { const v = r2.varint().num; t.canceled = v === 3 || v === 7; return true; } // CANCELED, DELETED
        if (g === 5 && w2 === 2) { t.routeId = str(buf, r2); return true; }
        return false;
      });
      return true;
    }
    if (f === 2 && w === 2) { const sp = span(r); t.stops.push(stopTimeUpdate(buf, sp[0], sp[1])); return true; }
    if (f === 5 && w === 0) { t.delay = int32(r); return true; }
    return false;
  });
  return t;
}

/** TranslatedString → texte en français si présent, sinon le premier. */
function translated(buf, s, e) {
  const list = [];
  each(buf, s, e, (f, w, r) => {
    if (f !== 1 || w !== 2) return false;
    const sp = span(r);
    const tr = { text: '', lang: '' };
    each(buf, sp[0], sp[1], (g, w2, r2) => {
      if (g === 1 && w2 === 2) { tr.text = str(buf, r2); return true; }
      if (g === 2 && w2 === 2) { tr.lang = str(buf, r2); return true; }
      return false;
    });
    list.push(tr);
    return true;
  });
  const fr = list.filter((t) => /^fr/i.test(t.lang))[0];
  return (fr || list[0] || { text: '' }).text.trim();
}

function alert(buf, s, e) {
  const a = { periods: [], routes: [], stops: [], header: '', description: '' };
  each(buf, s, e, (f, w, r) => {
    if (f === 1 && w === 2) { // TimeRange
      const sp = span(r);
      const p = { start: 0, end: 0 };
      each(buf, sp[0], sp[1], (g, w2, r2) => {
        if (g === 1 && w2 === 0) { p.start = r2.varint().num; return true; }
        if (g === 2 && w2 === 0) { p.end = r2.varint().num; return true; }
        return false;
      });
      a.periods.push(p);
      return true;
    }
    if (f === 5 && w === 2) { // EntitySelector
      const sp = span(r);
      each(buf, sp[0], sp[1], (g, w2, r2) => {
        if (g === 2 && w2 === 2) { a.routes.push(str(buf, r2)); return true; }
        if (g === 5 && w2 === 2) { a.stops.push(str(buf, r2)); return true; }
        return false;
      });
      return true;
    }
    if (f === 10 && w === 2) { const sp = span(r); a.header = translated(buf, sp[0], sp[1]); return true; }
    if (f === 11 && w === 2) { const sp = span(r); a.description = translated(buf, sp[0], sp[1]); return true; }
    return false;
  });
  return a;
}

/**
 * FeedMessage → { timestamp (s), trips: { trip_id: TripUpdate }, alerts: [Alert] }.
 * `bytes` : Uint8Array (ou ArrayBuffer).
 */
export function decodeFeed(bytes) {
  const buf = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const feed = { timestamp: 0, trips: {}, alerts: [] };
  each(buf, 0, buf.length, (f, w, r) => {
    if (f === 1 && w === 2) { // FeedHeader
      const sp = span(r);
      each(buf, sp[0], sp[1], (g, w2, r2) => {
        if (g === 3 && w2 === 0) { feed.timestamp = r2.varint().num; return true; }
        return false;
      });
      return true;
    }
    if (f === 2 && w === 2) { // FeedEntity
      const sp = span(r);
      let deleted = false;
      let tu = null;
      let al = null;
      each(buf, sp[0], sp[1], (g, w2, r2) => {
        if (g === 2 && w2 === 0) { deleted = r2.varint().num === 1; return true; }
        if (g === 3 && w2 === 2) { const s2 = span(r2); tu = tripUpdate(buf, s2[0], s2[1]); return true; }
        if (g === 5 && w2 === 2) { const s2 = span(r2); al = alert(buf, s2[0], s2[1]); return true; }
        return false; // positions des véhicules : ignorées
      });
      if (!deleted && tu && tu.tripId) feed.trips[tu.tripId] = tu;
      if (!deleted && al) feed.alerts.push(al);
      return true;
    }
    return false;
  });
  return feed;
}
