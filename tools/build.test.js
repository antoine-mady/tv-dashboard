// Build TV : config hors de index.html, et CSP de tizen/config.xml (ce que l'app peut charger sur la TV).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { buildApp, renderConfigJs, extractCsp, readCsp } from './build.js';

function evalConfig(js) {
  const ctx = { window: {} };
  vm.runInNewContext(js, ctx);
  return ctx.window;
}

test('config.js survit aux caractères spéciaux ($&, $\', $`, $$, </script>, U+2028)', () => {
  const config = { widgets: [{ id: 'w', type: 'wifi-qr', settings: { password: "a$&b$'c$`d$$e</script>f g h" } }] };
  const win = evalConfig(renderConfigJs(config, false));
  assert.equal(JSON.stringify(win.__DASHBOARD_CONFIG__), JSON.stringify(config));
  assert.equal(win.__PREVIEW__, undefined);
  assert.equal(evalConfig(renderConfigJs(config, true)).__PREVIEW__, true);
});

test('build TV : aucun script inline (bloqué par la CSP Tizen), config dans config.js', async () => {
  const outdir = fs.mkdtempSync(path.join(os.tmpdir(), 'tvdash-build-'));
  try {
    const config = { widgets: [{ id: 'clock-1', type: 'clock', col: 1, row: 1, w: 3, h: 2, settings: {} }] };
    await buildApp({ outdir, config, strict: false });
    const html = fs.readFileSync(path.join(outdir, 'index.html'), 'utf8');
    const scripts = html.match(/<script\b[^>]*>/g) || [];
    assert.ok(scripts.length >= 3);
    scripts.forEach((tag) => assert.match(tag, /\ssrc=/, 'script inline interdit : ' + tag));
    assert.match(html, /<script src="\$WEBAPIS\/webapis\/webapis\.js">/);
    for (const f of ['app.js', 'app.css', 'boot.js', 'config.js', 'config.xml']) assert.ok(fs.existsSync(path.join(outdir, f)), f);
    const win = evalConfig(fs.readFileSync(path.join(outdir, 'config.js'), 'utf8'));
    assert.equal(win.__DASHBOARD_CONFIG__.widgets[0].id, 'clock-1');
    assert.match(fs.readFileSync(path.join(outdir, 'config.xml'), 'utf8'), /<tizen:content-security-policy>/);
  } finally {
    fs.rmSync(outdir, { recursive: true, force: true });
  }
});

test('build aperçu : même CSP que la TV, en meta', async () => {
  const outdir = fs.mkdtempSync(path.join(os.tmpdir(), 'tvdash-preview-'));
  try {
    await buildApp({ outdir, preview: true, config: { widgets: [] } });
    const html = fs.readFileSync(path.join(outdir, 'index.html'), 'utf8');
    assert.ok(html.includes('<meta http-equiv="Content-Security-Policy" content="' + readCsp().replace(/&/g, '&amp;').replace(/"/g, '&quot;') + '">'));
    assert.ok(!html.includes('$WEBAPIS'));
  } finally {
    fs.rmSync(outdir, { recursive: true, force: true });
  }
});

function directives(csp) {
  const out = {};
  csp.split(';').map((d) => d.trim()).filter(Boolean).forEach((d) => {
    const [name, ...values] = d.split(/\s+/);
    out[name] = values;
  });
  return out;
}

test('extractCsp lit la balise Tizen', () => {
  assert.equal(extractCsp('<widget><tizen:content-security-policy>a  b;\n c</tizen:content-security-policy></widget>'), 'a b; c');
  assert.equal(extractCsp('<widget></widget>'), '');
});

test('la CSP de l’app autorise ce dont les widgets ont besoin', () => {
  const d = directives(readCsp());
  assert.ok(d['script-src'], 'script-src requis (sinon Tizen bloque tout script externe)');
  assert.ok(!d['script-src'].includes("'unsafe-inline'"), 'aucun script inline : inutile de les autoriser');
  assert.ok(d['script-src'].includes('file:'), '$WEBAPIS/webapis.js');
  assert.ok(d['script-src'].includes('https://www.youtube.com'), 'API du lecteur YouTube');
  assert.ok(d['frame-src'].includes('https://www.youtube.com'), 'iframe du lecteur YouTube');
  assert.ok(d['connect-src'].includes('*'), 'météo, Google, DLNA');
  assert.ok(d['img-src'].includes('*'), 'photos DLNA (http) et pochettes');
});
