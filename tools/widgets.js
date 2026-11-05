// Découverte automatique des widgets : chaque dossier widgets/<type>/ contenant un manifest.js.
// Les dossiers commençant par "_" ou "." (ex. _template) sont ignorés.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const WIDGETS_DIR = path.join(ROOT, 'widgets');

export function listWidgets() {
  return fs.readdirSync(WIDGETS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !/^[_.]/.test(d.name))
    .filter((d) => fs.existsSync(path.join(WIDGETS_DIR, d.name, 'manifest.js')))
    .map((d) => {
      const dir = path.join(WIDGETS_DIR, d.name);
      const has = (f) => fs.existsSync(path.join(dir, f));
      return {
        type: d.name,
        dir,
        hasTv: has('tv.js'),
        hasCss: has('tv.css'),
        hasAdmin: has('admin.js'),
        hasServer: has('server.js'),
      };
    })
    .sort((a, b) => a.type.localeCompare(b.type));
}

/** Importe tous les manifest.js → { [type]: manifest }. `fresh` contourne le cache des modules. */
export async function loadManifests(fresh) {
  const out = {};
  for (const w of listWidgets()) {
    const url = pathToFileURL(path.join(w.dir, 'manifest.js')).href + (fresh ? '?t=' + Date.now() : '');
    out[w.type] = (await import(url)).default;
  }
  return out;
}

export const CONFIG_PATH = path.join(ROOT, 'config', 'dashboard.json');
export const CONFIG_EXAMPLE_PATH = path.join(ROOT, 'config', 'dashboard.example.json');

/** Lit config/dashboard.json (créé depuis l'exemple s'il n'existe pas encore). */
export function readConfig() {
  if (!fs.existsSync(CONFIG_PATH)) fs.copyFileSync(CONFIG_EXAMPLE_PATH, CONFIG_PATH);
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
}

export function writeConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n');
}

/** Lit .env.local (format KEY=VALUE). */
export function readEnv() {
  const file = path.join(ROOT, '.env.local');
  const env = {};
  if (fs.existsSync(file)) {
    fs.readFileSync(file, 'utf8').split(/\r?\n/).forEach((line) => {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
      if (m && !line.trim().startsWith('#')) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    });
  }
  return env;
}
