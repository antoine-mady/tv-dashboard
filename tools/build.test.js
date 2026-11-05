import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { renderIndexHtml } from './build.js';
import { ROOT } from './widgets.js';

const TEMPLATE = fs.readFileSync(path.join(ROOT, 'app', 'index.html'), 'utf8');

function embeddedConfig(html) {
  const m = /<script>(window\.__DASHBOARD_CONFIG__[\s\S]*?)<\/script>/.exec(html);
  assert.ok(m, 'script de config présent');
  const ctx = { window: {} };
  vm.runInNewContext(m[1], ctx);
  return ctx.window.__DASHBOARD_CONFIG__;
}

test('la config embarquée survit aux caractères spéciaux ($&, $\', $`, $$, </script>, U+2028)', () => {
  const config = { widgets: [{ id: 'w', type: 'wifi-qr', settings: { password: "a$&b$'c$`d$$e</script>f g h" } }] };
  const html = renderIndexHtml(TEMPLATE, '<script src="$WEBAPIS/webapis/webapis.js"></script>', config);
  assert.equal(JSON.stringify(embeddedConfig(html)), JSON.stringify(config));
  assert.ok(html.includes('$WEBAPIS/webapis/webapis.js'));
  assert.ok(!html.includes('<!--CONFIG-->') && !html.includes('<!--PLATFORM-->'));
});
