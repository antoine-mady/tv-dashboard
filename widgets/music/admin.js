// Page admin : guide de création des identifiants Google + test de connexion (même code que la TV).
import { createAuth, createLibrary } from './auth.js';

function el(tag, props, ...children) {
  const e = document.createElement(tag);
  Object.assign(e, props || {});
  children.forEach((c) => e.append(c));
  return e;
}

function link(href, text) {
  return el('a', { href, textContent: text, target: '_blank', rel: 'noopener' });
}

function memoryStore() {
  const m = {};
  return { get: (k, d) => (k in m ? m[k] : d), set: (k, v) => { m[k] = v; }, remove: (k) => { delete m[k]; } };
}

export function renderEditor(container, settings, onChange, api) {
  container.innerHTML = '';

  const guide = el('details', { open: !settings.clientId });
  guide.append(el('summary', { innerHTML: api.iconLabel('book', 'Créer les identifiants Google (une seule fois, ~15 min)') }));
  const steps = el('ol', { className: 'guide' });
  const step = (...parts) => steps.append(el('li', {}, ...parts));
  step('Ouvrez la ', link('https://console.cloud.google.com/projectcreate', 'Google Cloud Console'), ' et créez un projet (ex. « TV Dashboard »).');
  step('Activez l’', link('https://console.cloud.google.com/apis/library/youtube.googleapis.com', 'API YouTube Data v3'), ' pour ce projet.');
  step('Configurez l’', link('https://console.cloud.google.com/auth/overview', 'écran de consentement OAuth'), ' : type « Externe », votre e-mail comme contact.');
  step('Dans « Audience », cliquez sur « Publier l’application » (statut « En production »). Sinon la connexion expire au bout de 7 jours. Google affichera un avertissement « application non validée » : c’est normal pour un usage personnel, cliquez sur « Paramètres avancés » puis « Continuer ».');
  step('Dans ', link('https://console.cloud.google.com/apis/credentials', 'Identifiants'), ', créez un « ID client OAuth » de type « TV et appareils à saisie limitée ».');
  step('Copiez l’ID client et le secret client dans les champs ci-dessus, puis testez ci-dessous.');
  guide.append(steps);
  container.append(guide);

  const out = el('div', { className: 'ext-out' });
  const btn = el('button', { type: 'button', innerHTML: api.iconLabel('test', 'Tester les identifiants'), disabled: !settings.clientId || !settings.clientSecret });
  container.append(el('div', { className: 'ext-actions' }, btn), out);
  const message = (text, cls) => { out.innerHTML = ''; out.append(el('p', { className: cls || 'help', textContent: text })); };

  let cancelled = false;
  btn.onclick = async () => {
    cancelled = false;
    btn.disabled = true;
    const auth = createAuth({
      fetch: (url, opts) => fetch('/api/proxy?url=' + encodeURIComponent(url), opts),
      store: memoryStore(),
      clientId: settings.clientId.trim(),
      clientSecret: settings.clientSecret.trim(),
    });
    try {
      const dev = await auth.startDeviceFlow();
      out.innerHTML = '';
      out.append(el('p', {}, 'Ouvrez ', link(dev.verificationUrl, dev.verificationUrl), ' et saisissez le code :'));
      out.append(el('p', { className: 'code', textContent: dev.userCode }));
      const wait = el('p', { className: 'help', textContent: 'En attente de validation…' });
      const stop = el('button', { type: 'button', textContent: 'Annuler', onclick: () => { cancelled = true; } });
      out.append(wait, stop);
      let interval = dev.interval;
      for (;;) {
        await new Promise((r) => setTimeout(r, interval));
        if (cancelled) { message('Test annulé.'); return; }
        const r = await auth.poll(dev);
        if (r === 'connected') break;
        if (r === 'slow_down') interval += 5000;
      }
      const playlists = await createLibrary(auth).playlists();
      message('✓ Identifiants valides : ' + playlists.length + ' playlist(s) trouvée(s). La TV vous demandera de vous connecter une fois (QR code).', 'ok');
    } catch (e) {
      message('⚠ ' + e.message, 'error');
    } finally {
      btn.disabled = false;
    }
  };
}
