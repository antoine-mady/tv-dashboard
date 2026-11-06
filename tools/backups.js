// Historique des configs : une copie de config/dashboard.json à chaque envoi sur la TV (ou à la demande),
// dans config/history/ (ignoré par git : contient les mots de passe). Tourne sur le PC uniquement.
import fs from 'node:fs';
import path from 'node:path';

export const KEEP = 30;
export const REASONS = { deploy: 'Envoi sur la TV', wgt: 'Téléchargement du .wgt', manual: 'Sauvegarde manuelle' };
const NAME_RE = /^dashboard-(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})(?:-(\d+))?-([a-z]+)\.json$/;

const pad = (n) => String(n).padStart(2, '0');

/** Nom de fichier d'une sauvegarde (heure locale, triable). */
export function backupName(date, reason, seq) {
  const d = date;
  return 'dashboard-' + d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + '_'
    + pad(d.getHours()) + '-' + pad(d.getMinutes()) + '-' + pad(d.getSeconds())
    + (seq ? '-' + seq : '') + '-' + (REASONS[reason] ? reason : 'manual') + '.json';
}

/** { date, reason } d'après le nom, ou null si ce n'est pas une sauvegarde (protège aussi des chemins). */
export function parseBackupName(name) {
  const m = NAME_RE.exec(name || '');
  if (!m) return null;
  const date = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
  return { date, reason: m[8] };
}

/** Sauvegardes à supprimer pour n'en garder que `keep` (les plus récentes). */
export function toPrune(names, keep) {
  const valid = names.filter((n) => parseBackupName(n)).sort();
  return valid.slice(0, Math.max(0, valid.length - keep));
}

function summary(config) {
  const pages = Array.isArray(config.pages) ? config.pages : [{ widgets: config.widgets || [] }];
  return {
    pages: pages.length,
    widgets: pages.reduce((n, p) => n + (Array.isArray(p.widgets) ? p.widgets.length : 0), 0),
    pageNames: pages.map((p) => p.name).filter(Boolean),
  };
}

/** Liste, de la plus récente à la plus ancienne : [{ name, date, reason, label, pages, widgets, pageNames }]. */
export function listBackups(dir) {
  let names = [];
  try { names = fs.readdirSync(dir); } catch { return []; }
  return names.filter((n) => parseBackupName(n)).sort().reverse().map((name) => {
    const info = parseBackupName(name);
    let s = { pages: 0, widgets: 0, pageNames: [] };
    try { s = summary(JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'))); } catch { /* fichier abîmé */ }
    return Object.assign({ name, date: info.date.toISOString(), reason: info.reason, label: REASONS[info.reason] || info.reason }, s);
  });
}

/** Contenu d'une sauvegarde (null si le nom est invalide ou le fichier absent). */
export function readBackup(dir, name) {
  if (!parseBackupName(name)) return null;
  try { return JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')); } catch { return null; }
}

/**
 * Sauvegarde `config` dans `dir`, sauf si elle est identique à la dernière sauvegarde.
 * Retourne le nom du fichier créé, ou null. Ne garde que les `keep` plus récentes.
 */
export function saveBackup(dir, config, reason, opts) {
  const o = opts || {};
  const keep = o.keep || KEEP;
  const text = JSON.stringify(config, null, 2) + '\n';
  fs.mkdirSync(dir, { recursive: true });
  const existing = fs.readdirSync(dir).filter((n) => parseBackupName(n)).sort();
  const last = existing[existing.length - 1];
  if (last && fs.readFileSync(path.join(dir, last), 'utf8') === text) return null;
  const now = o.now || new Date();
  let name = backupName(now, reason);
  for (let seq = 2; existing.includes(name); seq++) name = backupName(now, reason, seq);
  fs.writeFileSync(path.join(dir, name), text);
  toPrune(existing.concat(name), keep).forEach((n) => { try { fs.unlinkSync(path.join(dir, n)); } catch { /* ignore */ } });
  return name;
}
