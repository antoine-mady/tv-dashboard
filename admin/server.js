// Serveur de la page d'admin (tourne sur le PC, uniquement pendant la configuration) :
//   npm run dev  →  http://localhost:5173
// Aucune dépendance : module http natif de Node.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, listWidgets, readConfig, writeConfig, readEnv } from '../tools/widgets.js';
import { buildApp } from '../tools/build.js';
import { deploy, resolveTools } from '../tools/deploy.js';
import { buildWgt } from '../tools/wgt.js';

const PORT = Number(process.env.PORT) || 5173;
const HOST = process.env.HOST || '127.0.0.1';
const PREVIEW_DIR = path.join(ROOT, '.cache', 'preview');

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2',
};

function send(res, status, body, type) {
  res.writeHead(status, { 'Content-Type': type || 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}

function sendJson(res, status, data) {
  send(res, status, JSON.stringify(data), TYPES['.json']);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/** Sert un fichier de `baseDir` sans permettre de sortir du dossier. */
function serveStatic(res, baseDir, relPath, allowedExt) {
  const file = path.normalize(path.join(baseDir, decodeURIComponent(relPath)));
  if (!file.startsWith(baseDir + path.sep) && file !== baseDir) return send(res, 403, 'Interdit');
  const ext = path.extname(file);
  if (allowedExt && !allowedExt.includes(ext)) return send(res, 403, 'Interdit');
  fs.readFile(file, (err, data) => {
    if (err) return send(res, 404, 'Introuvable');
    send(res, 200, data, TYPES[ext] || 'application/octet-stream');
  });
}

// ---- Routes API ----------------------------------------------------------------

async function apiProxy(req, res, url) {
  // Utilisé uniquement par l'aperçu et l'admin pour joindre la box (pas de CORS côté box).
  const target = url.searchParams.get('url') || '';
  if (!/^https?:\/\//i.test(target)) return send(res, 400, 'URL invalide');
  const headers = {};
  for (const h of ['content-type', 'soapaction', 'accept', 'authorization']) if (req.headers[h]) headers[h] = req.headers[h];
  const body = ['GET', 'HEAD'].includes(req.method) ? undefined : await readBody(req);
  try {
    const r = await fetch(target, { method: req.method, headers, body, signal: AbortSignal.timeout(30000) });
    res.writeHead(r.status, { 'Content-Type': r.headers.get('content-type') || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(Buffer.from(await r.arrayBuffer()));
  } catch (e) {
    send(res, 502, 'Proxy : ' + (e.cause && e.cause.message ? e.cause.message : e.message));
  }
}

async function apiDeploy(req, res) {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  const log = (line) => res.write(line + '\n');
  try {
    await deploy({ log });
  } catch (e) {
    log('❌ ' + e.message);
  }
  res.end();
}

async function apiWidgetRoute(req, res, type, route) {
  const w = listWidgets().find((x) => x.type === type);
  if (!w || !w.hasServer) return sendJson(res, 404, { error: 'Pas d’extension serveur pour ' + type });
  const mod = (await import(pathToFileURL(path.join(w.dir, 'server.js')).href)).default;
  const handler = mod.routes && mod.routes[req.method + ' /' + route];
  if (!handler) return sendJson(res, 404, { error: 'Route inconnue' });
  const raw = await readBody(req);
  const body = raw.length ? JSON.parse(raw.toString()) : undefined;
  sendJson(res, 200, await handler({ body, query: Object.fromEntries(new URL(req.url, 'http://x').searchParams) }));
}

async function handle(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const p = url.pathname;

  if (p === '/') { res.writeHead(302, { Location: '/admin/' }); return res.end(); }
  if (p === '/admin/') return serveStatic(res, path.join(ROOT, 'admin'), 'index.html');
  if (p.startsWith('/admin/')) return serveStatic(res, path.join(ROOT, 'admin'), p.slice(7), ['.html', '.js', '.css', '.svg', '.png']);
  // Code partagé chargé directement par la page admin (manifest.js, admin.js, app/config.js…)
  if (p.startsWith('/app/')) return serveStatic(res, path.join(ROOT, 'app'), p.slice(5), ['.js']);
  if (p.startsWith('/widgets/')) return serveStatic(res, path.join(ROOT, 'widgets'), p.slice(9), ['.js', '.css', '.svg', '.png', '.jpg']);

  // Aperçu : l'app TV reconstruite à chaque chargement (config + code toujours à jour).
  if (p === '/preview/' || p === '/preview/index.html') {
    try {
      await buildApp({ outdir: PREVIEW_DIR, preview: true, config: readConfig() });
    } catch (e) {
      return send(res, 500, '<pre style="color:#f88;background:#111;padding:20px">Erreur de build :\n' + String(e.message).replace(/</g, '&lt;') + '</pre>', TYPES['.html']);
    }
    return serveStatic(res, PREVIEW_DIR, 'index.html');
  }
  if (p.startsWith('/preview/')) return serveStatic(res, PREVIEW_DIR, p.slice(9));

  if (p === '/api/config' && req.method === 'GET') return sendJson(res, 200, readConfig());
  if (p === '/api/config' && req.method === 'PUT') {
    let config;
    try { config = JSON.parse((await readBody(req)).toString()); } catch { return sendJson(res, 400, { error: 'JSON invalide' }); }
    if (!config || !Array.isArray(config.widgets)) return sendJson(res, 400, { error: 'Config invalide' });
    writeConfig(config);
    return sendJson(res, 200, { ok: true });
  }
  if (p === '/api/widgets') return sendJson(res, 200, listWidgets().map(({ dir, ...w }) => w));
  if (p === '/api/env') {
    const t = resolveTools();
    const env = readEnv();
    return sendJson(res, 200, { tvIp: t.tvIp, profile: t.profile, configured: !!(t.tvIp && t.profile), hasEnvFile: Object.keys(env).length > 0 });
  }
  if (p === '/api/deploy' && req.method === 'POST') return apiDeploy(req, res);
  if (p === '/api/wgt') {
    // Paquet non signé pour Apps2Samsung (qui le signe lui-même).
    try {
      const file = await buildWgt();
      res.writeHead(200, { 'Content-Type': 'application/widget', 'Content-Disposition': 'attachment; filename="TVDashboard.wgt"', 'Cache-Control': 'no-store' });
      return res.end(fs.readFileSync(file));
    } catch (e) {
      return send(res, 400, e.message);
    }
  }
  if (p === '/api/proxy') return apiProxy(req, res, url);
  const m = /^\/api\/widgets\/([a-z0-9-]+)\/(.+)$/.exec(p);
  if (m) return apiWidgetRoute(req, res, m[1], m[2]);

  send(res, 404, 'Introuvable');
}

http.createServer((req, res) => {
  handle(req, res).catch((e) => {
    console.error(e);
    if (!res.headersSent) sendJson(res, 500, { error: e.message });
    else res.end();
  });
}).listen(PORT, HOST, () => {
  console.log('🖥  Admin du dashboard : http://localhost:' + PORT);
});
