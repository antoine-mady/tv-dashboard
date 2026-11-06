// Lecture d'une archive ZIP (le GTFS) sans dépendance — Node uniquement (server.js, sur le PC).
import zlib from 'node:zlib';

/** Renvoie { nom: Buffer } pour les fichiers demandés (ou tous) à la racine ou dans un sous-dossier. */
export function readZip(buf, wanted) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Fichier GTFS invalide (ce n’est pas un zip)');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const out = {};
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('Zip GTFS corrompu');
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    p += 46 + nameLen + extraLen + commentLen;

    const base = name.split('/').pop();
    if (!base || (wanted && wanted.indexOf(base) < 0)) continue;
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const data = buf.subarray(start, start + size);
    if (method === 0) out[base] = Buffer.from(data);
    else if (method === 8) out[base] = zlib.inflateRawSync(data);
    else throw new Error('Compression zip non gérée (' + method + ') pour ' + name);
  }
  return out;
}
