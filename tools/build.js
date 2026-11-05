// Build de l'app TV : génère le registre des widgets puis bundle tout avec esbuild.
//   node tools/build.js            → dist/ (prêt à être packagé en .wgt)
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import * as esbuild from 'esbuild';
import { ROOT, listWidgets, loadManifests, readConfig } from './widgets.js';
import { validateConfig } from '../app/config.js';

export const DIST = path.join(ROOT, 'dist');
const GENERATED = path.join(ROOT, '.generated');

/** Écrit .generated/tv-registry.js qui importe chaque widget (manifest + tv.js + tv.css). */
export function generateRegistry() {
  fs.mkdirSync(GENERATED, { recursive: true });
  const lines = ['// FICHIER GÉNÉRÉ par tools/build.js — ne pas modifier.'];
  const entries = [];
  listWidgets().filter((w) => w.hasTv).forEach((w, i) => {
    const rel = (f) => JSON.stringify('../widgets/' + w.type + '/' + f);
    lines.push('import m' + i + ' from ' + rel('manifest.js') + ';');
    lines.push('import W' + i + ' from ' + rel('tv.js') + ';');
    if (w.hasCss) lines.push('import ' + rel('tv.css') + ';');
    entries.push('  ' + JSON.stringify(w.type) + ': { manifest: m' + i + ', Widget: W' + i + ' },');
  });
  lines.push('export default {', ...entries, '};', '');
  fs.writeFileSync(path.join(GENERATED, 'tv-registry.js'), lines.join('\n'));
}

function inlineJson(obj) {
  return JSON.stringify(obj).replace(/</g, '\\u003c');
}

/**
 * Construit l'app dans `outdir`.
 * preview=true : version pour l'aperçu navigateur (pas de fichiers Tizen, sourcemaps, proxy activé).
 */
export async function buildApp({ outdir = DIST, preview = false, config = readConfig(), strict = !preview } = {}) {
  const manifests = await loadManifests(preview);
  const errors = validateConfig(config, manifests);
  if (errors.length && strict) {
    throw new Error('Config invalide :\n  - ' + errors.map((e) => e.message).join('\n  - '));
  }

  generateRegistry();
  fs.rmSync(outdir, { recursive: true, force: true });
  fs.mkdirSync(outdir, { recursive: true });

  await esbuild.build({
    entryPoints: { app: path.join(ROOT, 'app', 'main.js') },
    bundle: true,
    outdir,
    format: 'iife',
    target: ['chrome56'],
    minify: !preview,
    sourcemap: preview ? 'inline' : false,
    loader: { '.svg': 'text', '.png': 'dataurl', '.jpg': 'dataurl', '.woff2': 'dataurl' },
    legalComments: 'none',
    charset: 'utf8',
    logLevel: 'silent',
  });

  const platform = preview
    ? '<script>window.__PREVIEW__ = true;</script>'
    : '<script src="$WEBAPIS/webapis/webapis.js"></script>';
  const html = fs.readFileSync(path.join(ROOT, 'app', 'index.html'), 'utf8')
    .replace('<!--PLATFORM-->', platform)
    .replace('<!--CONFIG-->', '<script>window.__DASHBOARD_CONFIG__ = ' + inlineJson(config) + ';</script>');
  fs.writeFileSync(path.join(outdir, 'index.html'), html);

  if (!preview) {
    for (const f of ['config.xml', 'icon.png']) fs.copyFileSync(path.join(ROOT, 'tizen', f), path.join(outdir, f));
  }
  return { errors };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  buildApp().then(() => {
    console.log('✅ Build terminé → dist/');
  }, (e) => {
    console.error('❌ ' + e.message);
    process.exit(1);
  });
}
