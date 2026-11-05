// Crée un nouveau widget à partir de widgets/_template :  npm run new-widget mon-widget "Mon widget"
import fs from 'node:fs';
import path from 'node:path';
import { WIDGETS_DIR } from './widgets.js';

const type = process.argv[2];
const name = process.argv[3] || (type ? type.charAt(0).toUpperCase() + type.slice(1).replace(/-/g, ' ') : '');

if (!type || !/^[a-z][a-z0-9-]*$/.test(type)) {
  console.error('Usage : npm run new-widget <type> ["Nom affiché"]\n  <type> en minuscules, chiffres et tirets (ex. agenda, bus-times)');
  process.exit(1);
}
const dest = path.join(WIDGETS_DIR, type);
if (fs.existsSync(dest)) {
  console.error('❌ widgets/' + type + ' existe déjà');
  process.exit(1);
}

const src = path.join(WIDGETS_DIR, '_template');
const className = type.replace(/(^|-)([a-z0-9])/g, (_, __, c) => c.toUpperCase()) + 'Widget';
fs.mkdirSync(dest);
for (const file of fs.readdirSync(src)) {
  const content = fs.readFileSync(path.join(src, file), 'utf8')
    .replace(/__TYPE__/g, type)
    .replace(/__NAME__/g, name)
    .replace(/__CLASS__/g, className);
  fs.writeFileSync(path.join(dest, file), content);
}
console.log('✅ Widget créé : widgets/' + type + '/');
console.log('   Il apparaît déjà dans la page admin (npm run dev). Voir CLAUDE.md > « Créer un widget ».');
