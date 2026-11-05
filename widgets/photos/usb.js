// Lecture des photos d'un disque/clé USB branché sur la TV (API tizen.filesystem).
/* global tizen */

const IMAGE_RE = /\.(jpe?g|png|gif|bmp|webp)$/i;

function listFiles(dir) {
  return new Promise((resolve, reject) => dir.listFiles(resolve, reject));
}

function resolveDir(path) {
  return new Promise((resolve, reject) => tizen.filesystem.resolve(path, resolve, reject, 'r'));
}

function listStorages() {
  return new Promise((resolve, reject) => tizen.filesystem.listStorages(resolve, reject));
}

export async function listUsbImages(subfolder, max) {
  if (typeof tizen === 'undefined' || !tizen.filesystem) {
    throw new Error('La source USB ne fonctionne que sur la TV');
  }
  const storages = (await listStorages()).filter((s) => s.type === 'EXTERNAL' && s.state === 'MOUNTED');
  if (!storages.length) throw new Error('Aucun disque USB détecté sur la TV');

  const photos = [];
  async function walk(dir, depth) {
    if (photos.length >= max || depth > 12) return;
    const files = await listFiles(dir);
    for (const f of files) {
      if (photos.length >= max) return;
      if (f.name.charAt(0) === '.') continue;
      if (f.isDirectory) await walk(f, depth + 1);
      else if (IMAGE_RE.test(f.name)) photos.push({ id: f.fullPath, title: f.name, date: '', url: f.toURI() });
    }
  }

  for (const s of storages) {
    const path = s.label + (subfolder ? '/' + subfolder.replace(/^\/+|\/+$/g, '') : '');
    try {
      await walk(await resolveDir(path), 0);
    } catch (e) {
      console.warn('USB', path, e);
    }
  }
  return photos;
}
