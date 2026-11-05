import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { buildApp, renderConfigJs } from './build.js';

function evalConfig(js) {
  const ctx = { window: {} };
  vm.runInNewContext(js, ctx);
  return ctx.window;
}

test('config.js survit aux caractères spéciaux ($&, $\', $`, $$, </script>, U+2028)', () => {
  const config = { widgets: [{ id: 'w', type: 'wifi-qr', settings: { password: "a$&b$'c$`d$$e</script>f g h" } }] };
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
  } finally {
    fs.rmSync(outdir, { recursive: true, force: true });
  }
});
