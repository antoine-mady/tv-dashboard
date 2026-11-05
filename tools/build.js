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

/** JSON sûr dans du code JS : pas de « </script » ni de U+2028/2029 (invalides en JS avant ES2019). */
export function inlineJson(obj) {
  return JSON.stringify(obj)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/**
 * Contenu de dist/config.js. La config est dans un fichier à part (et non inline dans index.html)
 * car la CSP par défaut des apps Tizen bloque les scripts inline : la TV démarrait sans config.
 */
export function renderConfigJs(config, preview) {
  return (preview ? 'window.__PREVIEW__ = true;\n' : '') + 'window.__DASHBOARD_CONFIG__ = ' + inlineJson(config) + ';\n';
}

/** Politique CSP déclarée dans tizen/config.xml (balise <tizen:content-security-policy>), ou '' si absente. */
export function extractCsp(xml) {
  const m = /<tizen:content-security-policy>([\s\S]*?)<\/tizen:content-security-policy>/.exec(xml);
  return m ? m[1].replace(/\s+/g, ' ').trim() : '';
}

export function readCsp() {
  return extractCsp(fs.readFileSync(path.join(ROOT, 'tizen', 'config.xml'), 'utf8'));
}

function escapeAttr(s) {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
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
    define: { __BUILD_TIME__: JSON.stringify(new Date().toISOString()) },
    charset: 'utf8',
    logLevel: 'silent',
  });

  // L'aperçu applique la même CSP que la TV (tizen/config.xml) pour révéler les blocages avant l'installation.
  // Remplacement par fonction : une chaîne contenant « $ » serait interprétée par String.replace.
  const csp = preview ? readCsp() : '';
  const platform = csp
    ? '<meta http-equiv="Content-Security-Policy" content="' + escapeAttr(csp) + '">'
    : (preview ? '' : '<script src="$WEBAPIS/webapis/webapis.js"></script>');
  const html = fs.readFileSync(path.join(ROOT, 'app', 'index.html'), 'utf8').replace('<!--PLATFORM-->', () => platform);
  fs.writeFileSync(path.join(outdir, 'index.html'), html);
  fs.writeFileSync(path.join(outdir, 'config.js'), renderConfigJs(config, preview));
  fs.copyFileSync(path.join(ROOT, 'app', 'boot.js'), path.join(outdir, 'boot.js'));

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
