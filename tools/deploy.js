// Build + package .wgt signé + installation et lancement sur la TV (Developer Mode).
//   npm run deploy
// Prérequis : Tizen Studio (CLI `tizen` et `sdb`), un profil de certificat Samsung, .env.local rempli.
// Sans Tizen Studio : produit le .wgt non signé à installer avec Apps2Samsung (voir README).
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { ROOT, readEnv } from './widgets.js';
import { buildApp, DIST } from './build.js';
import { buildWgt } from './wgt.js';

const SDB_PORT = 26101;

function expandHome(p) {
  return p && p.startsWith('~') ? path.join(os.homedir(), p.slice(1)) : p;
}

/**
 * Chemin réel d'un exécutable : `cmd` tel quel s'il contient un dossier, sinon recherché dans le PATH
 * (avec les extensions de PATHEXT sous Windows). `null` s'il est introuvable.
 */
export function findExecutable(cmd, { env = process.env, platform = process.platform, exists = fs.existsSync } = {}) {
  if (!cmd) return null;
  const win = platform === 'win32';
  const exts = win ? [''].concat((env.PATHEXT || '.EXE;.CMD;.BAT').split(';').filter(Boolean)) : [''];
  const isFile = (p) => exts.map((e) => p + e).find((c) => { try { return exists(c); } catch { return false; } }) || null;
  if (/[\\/]/.test(cmd)) return isFile(cmd);
  const dirs = (env.PATH || env.Path || '').split(win ? ';' : ':').filter(Boolean);
  for (const d of dirs) {
    const found = isFile(path.join(d, cmd));
    if (found) return found;
  }
  return null;
}

/** Instructions affichées quand Tizen Studio n'est pas installé. */
export function apps2SamsungSteps(file) {
  return [
    'Tizen Studio n’est pas installé : installez le paquet avec Apps2Samsung (aucun autre outil nécessaire).',
    '  1. Ouvrez Apps2Samsung sur ce PC (la TV doit être en Developer mode avec l’IP de ce PC).',
    '  2. Choisissez l’installation d’un WGT personnalisé (« Custom WGT ») et sélectionnez :',
    '     ' + file,
    '  3. Choisissez la TV détectée et lancez l’installation.',
    'À refaire après chaque modification de la config.',
  ];
}

/** Chemins des outils Tizen + réglages lus dans .env.local. */
export function resolveTools() {
  const env = readEnv();
  const home = expandHome(env.TIZEN_HOME || process.env.TIZEN_HOME || '');
  const win = process.platform === 'win32';
  const pick = (rel, name) => {
    const candidates = win ? [rel + '.bat', rel + '.exe', rel] : [rel];
    for (const c of candidates) {
      const p = home ? path.join(home, c) : '';
      if (p && fs.existsSync(p)) return p;
    }
    return name; // sinon on compte sur le PATH
  };
  const tizen = pick(path.join('tools', 'ide', 'bin', 'tizen'), 'tizen');
  const sdb = pick(path.join('tools', 'sdb'), 'sdb');
  return {
    tvIp: env.TV_IP || '',
    profile: env.TIZEN_PROFILE || '',
    tizen,
    sdb,
    hasTizen: !!(findExecutable(tizen) && findExecutable(sdb)),
  };
}

/** Lit l'id de l'app dans tizen/config.xml (ex. TVDashBrd0.TVDashboard). */
export function readAppId() {
  const xml = fs.readFileSync(path.join(ROOT, 'tizen', 'config.xml'), 'utf8');
  const m = /<tizen:application[^>]*\bid="([^"]+)"/.exec(xml);
  if (!m) throw new Error('id introuvable dans tizen/config.xml');
  return m[1];
}

function run(cmd, args, log) {
  return new Promise((resolve, reject) => {
    log('$ ' + [cmd].concat(args).join(' '));
    const child = spawn(cmd, args, { cwd: ROOT, shell: process.platform === 'win32' });
    let out = '';
    const onData = (d) => { const s = d.toString(); out += s; s.split(/\r?\n/).filter(Boolean).forEach((l) => log('  ' + l)); };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('error', (e) => reject(new Error(e.code === 'ENOENT' ? cmd + ' introuvable : installez Tizen Studio ou renseignez TIZEN_HOME dans .env.local' : e.message)));
    child.on('close', (code) => {
      if (code !== 0) reject(new Error(path.basename(cmd) + ' a échoué (code ' + code + ')'));
      else resolve(out);
    });
  });
}

export async function deploy({ log = console.log, tools = resolveTools() } = {}) {
  const t = tools;
  if (!t.hasTizen) {
    // Pas de Tizen Studio : on ne peut ni signer ni installer d'ici → paquet pour Apps2Samsung.
    log('▶ Création du paquet .wgt (non signé)…');
    const file = await buildWgt();
    log('✅ Paquet créé : ' + file);
    log('');
    apps2SamsungSteps(file).forEach((l) => log(l));
    return { mode: 'apps2samsung', file };
  }
  if (!t.tvIp) throw new Error('TV_IP manquant dans .env.local (copiez .env.example)');
  if (!t.profile) throw new Error('TIZEN_PROFILE manquant dans .env.local');
  const appId = readAppId();
  const serial = t.tvIp + ':' + SDB_PORT;

  log('▶ Build de l’app…');
  await buildApp({ outdir: DIST });

  log('▶ Création du paquet signé (.wgt)…');
  await run(t.tizen, ['package', '-t', 'wgt', '-s', t.profile, '--', DIST], log);
  const wgt = fs.readdirSync(DIST).find((f) => f.endsWith('.wgt'));
  if (!wgt) throw new Error('Aucun .wgt produit (vérifiez le profil de certificat « ' + t.profile + ' »)');

  log('▶ Connexion à la TV ' + t.tvIp + '…');
  const conn = await run(t.sdb, ['connect', t.tvIp], log);
  if (/fail|unable|refused/i.test(conn)) throw new Error('Connexion impossible : la TV est-elle allumée, en Developer Mode, avec l’IP de ce PC ?');

  log('▶ Installation…');
  const inst = await run(t.tizen, ['install', '-n', wgt, '-s', serial, '--', DIST], log);
  if (/fail|error/i.test(inst) && !/success|completed/i.test(inst)) throw new Error('Installation échouée (voir logs ci-dessus)');

  log('▶ Lancement de ' + appId + '…');
  await run(t.tizen, ['run', '-p', appId, '-s', serial], log);
  log('✅ Dashboard envoyé sur la TV');
  return { mode: 'tizen' };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  deploy().then(() => {}, (e) => {
    console.error('❌ ' + e.message);
    process.exit(1);
  });
}
