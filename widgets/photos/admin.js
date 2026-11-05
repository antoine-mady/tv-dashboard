// Éditeur complémentaire dans la page admin : trouver la box, choisir le dossier, tester.
// Contrat : renderEditor(container, settings, onChange, api)
//   api.call(route)             → JSON de /api/widgets/photos/<route> (cf. server.js)
//   api.fetchText(url, options) → requête via le proxy du serveur d'admin
import { browseAll, crawl } from './dlna.js';

function el(tag, props, ...children) {
  const e = document.createElement(tag);
  Object.assign(e, props || {});
  children.forEach((c) => e.append(c));
  return e;
}

export function renderEditor(container, settings, onChange, api) {
  container.innerHTML = '';
  if (settings.source !== 'dlna') {
    container.append(el('p', { className: 'help', textContent: 'Branchez le disque ou la clé USB directement sur la TV. Les photos seront cherchées dans tous les dossiers (ou dans le sous-dossier indiqué). Non testable dans l’aperçu.' }));
    return;
  }

  const out = el('div', { className: 'ext-out' });
  const btnDiscover = el('button', { type: 'button', textContent: '🔍 Rechercher la box' });
  const btnBrowse = el('button', { type: 'button', textContent: '📂 Parcourir les dossiers', disabled: !settings.dlnaUrl });
  const btnTest = el('button', { type: 'button', textContent: '🧪 Tester', disabled: !settings.dlnaUrl });
  container.append(el('div', { className: 'ext-actions' }, btnDiscover, btnBrowse, btnTest), out);

  const message = (text, cls) => { out.innerHTML = ''; out.append(el('p', { className: cls || 'help', textContent: text })); };

  btnDiscover.onclick = async () => {
    message('Recherche des serveurs DLNA sur le réseau (3 s)…');
    try {
      const { servers } = await api.call('discover');
      out.innerHTML = '';
      if (!servers.length) {
        message('Aucun serveur DLNA trouvé. Vérifiez que le partage multimédia (DLNA/UPnP) est activé sur la box Zeop.', 'error');
        return;
      }
      servers.forEach((s) => out.append(el('div', { className: 'ext-row' },
        el('span', { textContent: s.name + ' — ' + s.controlUrl }),
        el('button', { type: 'button', textContent: 'Utiliser', onclick: () => onChange({ dlnaUrl: s.controlUrl, rootId: '0' }) }))));
    } catch (e) {
      message('Erreur : ' + e.message, 'error');
    }
  };

  const path = [{ id: '0', title: 'Racine' }];
  async function showFolder() {
    const current = path[path.length - 1];
    message('Lecture de « ' + current.title + ' »…');
    try {
      const res = await browseAll(api.fetchText, settings.dlnaUrl, current.id);
      out.innerHTML = '';
      out.append(el('div', { className: 'ext-path', textContent: path.map((p) => p.title).join(' / ') + ' (' + res.items.length + ' photos ici)' }));
      const actions = el('div', { className: 'ext-actions' },
        el('button', { type: 'button', className: 'primary', textContent: '✓ Utiliser ce dossier', onclick: () => onChange({ rootId: current.id }) }));
      if (path.length > 1) actions.append(el('button', { type: 'button', textContent: '↑ Dossier parent', onclick: () => { path.pop(); showFolder(); } }));
      out.append(actions);
      res.containers.forEach((c) => out.append(el('div', { className: 'ext-row' },
        el('span', { textContent: '📁 ' + c.title }),
        el('button', { type: 'button', textContent: 'Ouvrir', onclick: () => { path.push(c); showFolder(); } }))));
    } catch (e) {
      message('Erreur : ' + e.message, 'error');
    }
  }
  btnBrowse.onclick = () => { path.length = 1; showFolder(); };

  btnTest.onclick = async () => {
    message('Indexation (max 300 photos pour le test)…');
    try {
      const photos = await crawl(api.fetchText, settings.dlnaUrl, settings.rootId, { max: 300 });
      out.innerHTML = '';
      out.append(el('p', { className: photos.length ? 'ok' : 'error', textContent: photos.length + ' photo(s) trouvée(s)' + (photos.length >= 300 ? ' (ou plus)' : '') }));
      const thumbs = el('div', { className: 'ext-thumbs' });
      photos.slice(0, 8).forEach((p) => thumbs.append(el('img', { src: p.url, title: p.title, loading: 'lazy' })));
      out.append(thumbs);
    } catch (e) {
      message('Erreur : ' + e.message, 'error');
    }
  };
}
