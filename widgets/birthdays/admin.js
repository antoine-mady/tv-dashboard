// Éditeur complémentaire (page admin) : importer les anniversaires depuis un export de contacts (vCard).
// L’agenda « Anniversaires » de Google n’a pas d’adresse iCal : on lit donc le fichier .vcf exporté
// depuis contacts.google.com et on n’en garde que « JJ/MM/AAAA Nom » (rien d’autre ne quitte le PC).
import { parseVcard, formatContacts, parseContacts } from './birthdays.js';

function el(tag, props, ...children) {
  const e = document.createElement(tag);
  Object.assign(e, props || {});
  children.forEach((c) => e.append(c));
  return e;
}

export function renderEditor(container, settings, onChange) {
  container.innerHTML = '';
  if (settings.source !== 'contacts') return;

  const out = el('div', { className: 'ext-out' });
  const input = el('input', { type: 'file', accept: '.vcf,text/vcard,text/x-vcard', hidden: true });
  const btn = el('button', { type: 'button', className: 'primary', textContent: '📇 Importer des contacts (.vcf)' });
  btn.onclick = () => input.click();
  container.append(
    el('p', { className: 'help', textContent: 'Sur contacts.google.com : « Exporter » → « vCard (pour les contacts iOS) », '
      + 'puis choisissez le fichier ici. Seuls le nom et la date de naissance sont gardés.' }),
    el('div', { className: 'ext-actions' }, btn, input), out);

  const message = (text, cls) => { out.innerHTML = ''; out.append(el('p', { className: cls || 'help', textContent: text })); };

  const current = parseContacts(settings.contacts);
  if (current.errors.length) message('Lignes non reconnues : ' + current.errors.join(' ; '), 'error');
  else if (current.list.length) message(current.list.length + ' anniversaire(s) enregistré(s).', 'ok');

  input.onchange = () => {
    const file = input.files && input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const found = parseVcard(String(reader.result));
      input.value = '';
      if (!found.length) {
        message('Aucune date de naissance trouvée dans ce fichier. Renseignez-les dans Google Contacts (champ « Anniversaire »).', 'error');
        return;
      }
      // Les lignes ajoutées à la main (absentes des contacts) sont conservées.
      const imported = {};
      found.forEach((c) => { imported[c.name.toLowerCase()] = true; });
      const manual = current.list.filter((c) => !imported[c.name.toLowerCase()]);
      onChange({ contacts: formatContacts(found.concat(manual)) });
    };
    reader.onerror = () => message('Lecture du fichier impossible.', 'error');
    reader.readAsText(file);
  };
}
