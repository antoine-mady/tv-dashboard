// Build + paquet .wgt NON signé, à installer avec Apps2Samsung (qui le signe avec son propre certificat).
//   npm run wgt   →  TVDashboard.wgt à la racine du projet
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT } from './widgets.js';
import { buildApp, DIST } from './build.js';
import { zipDirectory } from './zip.js';

export const WGT_PATH = path.join(ROOT, 'TVDashboard.wgt');

export async function buildWgt() {
  await buildApp({ outdir: DIST });
  zipDirectory(DIST, WGT_PATH);
  return WGT_PATH;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  buildWgt().then((file) => {
    console.log('✅ Paquet créé : ' + file);
    console.log('   → Apps2Samsung : choisir « Custom WGT », sélectionner ce fichier, puis installer.');
  }, (e) => {
    console.error('❌ ' + e.message);
    process.exit(1);
  });
}
