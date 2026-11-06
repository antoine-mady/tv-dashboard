# TV Dashboard — guide du projet

Application web **Tizen** pour TV Samsung : un dashboard plein écran (1920×1080) composé de widgets
configurables (horloge, météo, QR Wi-Fi, musique YouTube, photos de la box…).

- **TV** : vanilla JS, bundlé par esbuild en un seul fichier (`target: chrome56`). Aucun serveur au quotidien.
- **Config** : page d'admin sur le PC (`npm run dev`) → `config/dashboard.json` → **embarquée dans le build**
  et poussée sur la TV par « Envoyer sur la TV » (`npm run deploy`). La TV ne contacte jamais le PC.
- **Pages** : `config.pages = [{ id, name, widgets: [...] }]` (ex. « Moi » / « Invités »), CH▲ / CH▼ pour en changer
  (`app/pages.js`). Un widget identique (même id, place et réglages) sur deux pages reste affiché sans être recréé ;
  les autres sont détruits (`destroy()`) puis recréés. L'ancien format `config.widgets` = une seule page (`getPages`).
- **Veille** (`app/sleep.js`, réglages généraux `idleMinutes`, `nightMode`…) : après N minutes sans touche ou la nuit,
  écran assombri, timers des widgets suspendus et économiseur d'écran de la TV réautorisé ; une touche réveille.
- Rien n'est en ligne : tout reste sur le réseau local (seules les API des widgets sortent, ex. météo, YouTube).

## Commandes

| Commande | Rôle |
|---|---|
| `npm run dev` | Page d'admin + aperçu live sur http://localhost:5173 |
| `npm test` | Tests (`node --test`, tous les `*.test.js`) |
| `npm run build` | Build de production dans `dist/` (échoue si la config est invalide) |
| `npm run wgt` | Build + `TVDashboard.wgt` non signé (installation via Apps2Samsung) |
| `npm run deploy` | Build + paquet `.wgt` signé + installation + lancement sur la TV (`.env.local` requis) |
| `npm run new-widget <type> "Nom"` | Crée `widgets/<type>/` depuis `widgets/_template/` |

## Arborescence

```
widgets/<type>/   ★ UN DOSSIER = UN WIDGET (TV + admin + serveur + tests + assets)
app/              cœur de l'app TV (grille, télécommande, classe Widget…) — aucun code de widget
admin/            cœur de la page d'admin (serveur, éditeur de grille, formulaires) — aucun code de widget
tools/            build, deploy, découverte des widgets, générateur de widget
tizen/            config.xml (manifeste Tizen, privilèges, CSP) + icon.png
player/           page lecteur YouTube publiée sur GitHub Pages (ES5) : YouTube refuse de lire en file://
config/           dashboard.example.json (versionné) ; dashboard.json (perso, ignoré par git)
```

Les widgets sont **découverts automatiquement** (`tools/widgets.js` scanne `widgets/*/manifest.js`,
en ignorant les dossiers qui commencent par `_` ou `.`). Il n'y a **aucun registre à modifier** :
`tools/build.js` génère `.generated/tv-registry.js`, l'admin charge les manifests via `/api/widgets`.

## Créer un widget

1. `npm run new-widget mon-widget "Mon widget"` → crée `widgets/mon-widget/` (manifest.js, tv.js, tv.css).
2. **`manifest.js`** — fichier PUR (aucun import, aucun DOM : il est aussi chargé par Node et par l'admin) :
   ```js
   export default {
     type: 'mon-widget',          // = nom du dossier (vérifié par les tests)
     name: 'Mon widget', icon: '🧩', description: '…',
     size: { default: { w: 3, h: 2 }, min: { w: 2, h: 1 } },   // grille 12×6
     focusable: false,            // true si onKey() est utilisé (télécommande)
     frameless: false,            // true = pas de cadre ni de padding
     schema: [ { key: 'city', label: 'Ville', type: 'text', default: 'Saint-Denis', required: true } ],
   };
   ```
   Types de champ : `text`, `password`, `number` (`min`/`max`/`step`), `bool`, `select` (`options`:
   `[{ value, label }]`), `color`, `time` (`HH:MM`), `textarea`. Options : `required`, `help`, `placeholder`,
   `when: { autreClé: valeur }` (champ affiché/validé seulement dans ce cas).
   L'admin génère le formulaire tout seul ; les valeurs par défaut sont appliquées partout (`app/config.js`).
3. **`tv.js`** — `export default class extends Widget` (`app/Widget.js`) :
   - `mount(el, settings)` : construire le rendu **dans `el` uniquement** (peut être `async`). Lever une erreur
     affiche un message propre dans le widget (ex. `throw new Error('Renseignez la ville')`).
   - `onKey(key)` → `true` si gérée. Touches : `left right up down enter back playpause play pause stop next prev
     red green yellow blue chup chdown` (CH▲ / CH▼ changent de page si le widget ne les gère pas). Les flèches non gérées déplacent le focus ; les touches média non gérées par le
     widget focalisé sont proposées aux autres widgets.
   - `onFocus(focused)`, `destroy()` (optionnels). `onSleep(asleep)` : veille / réveil du dashboard — les timers de
     `this.every` sont déjà suspendus puis rattrapés au réveil ; ne surcharger que pour un `setInterval` maison, une
     vidéo… (`this.asleep` indique l'état).
   - Utilitaires : `this.every(ms, fn, opts)` (timer auto-nettoyé ; une erreur/promesse rejetée affiche l'état
     d'erreur, effacé au succès suivant ; suspendu pendant la veille sauf `{ whileAsleep: true }`, réservé à un rendu
     local très léger comme l'horloge ; `{ immediate: false }` pour ne pas l'exécuter tout de suite), `this.after(ms, fn)`, `this.listen(target, type, fn)`,
     `this.fetchJson/fetchText(url, opts)` (timeout, erreurs HTTP, proxy automatique dans l'aperçu),
     `this.fetchRaw(url, opts)` (idem mais renvoie la réponse quel que soit le statut, ex. pour OAuth),
     `this.showError(msg)` / `this.clearError()`, `this.size` (`{ width, height }` en px),
     `this.platform` (`isTizen`, `isPreview`, `launchApp(appId)`). Helper DOM : `h()` de `app/dom.js`.
   - `this.store.get(key, défaut)` / `set(key, valeur)` / `remove(key)` : stockage persistant **sur la TV**
     (localStorage, JSON, propre au widget, ne lève jamais d'erreur). Pour ce qui est appris sur la TV
     (ex. jeton de connexion) — jamais pour la config, qui vient de l'admin.
   - `this.openPanel()` → élément **plein écran** (1920×1080) à remplir ; ajoutez-y une classe `.w-<type>-panel`
     pour le styler. Tant qu'il est ouvert, **toutes** les touches vont à `onKey()` ; si « back » n'est pas
     gérée, l'app ferme le panneau. `this.closePanel()`, `this.panelOpen`, hook `onPanelClose()`.
     Exemple : la bibliothèque de `widgets/music/` (`browser.js`).
   - **Panneau liste « tout voir »** : `ListPanel` de `app/list-panel.js` gère un panneau plein écran avec liste
     défilante (titres de groupe), onglets ◀ ▶, recherche (clavier TV / dictée) et volet de détail ; le widget ne
     fournit que `rows(ctx)` → `[{ header }, { key, el, detail }]`. Mettre `focusable: true`, ouvrir sur OK
     (`this.list = new ListPanel(this, {…})`), déléguer `onKey` à `this.list.onKey`, `onPanelClose` → `this.list = null`,
     et `this.list.refresh()` quand les données changent. `focusHint()` = badge « OK : tout voir » visible au focus.
     Exemples : `widgets/agenda/`, `birthdays/` (recherche), `bus/`, `weather/` (chargement à l'ouverture).
   - QR code : `qrSvg(texte)` de `app/qr.js` (SVG à insérer en `innerHTML`).
   - Champs de saisie : quand un `<input>` a le focus, la télécommande ne transmet que Entrée, Retour, haut et
     bas (`app/remote.js`) ; le clavier natif de la TV gère le reste.
   - Dictée vocale (`app/dictation.js`, automatique pour tout champ texte) : bouton micro de la télécommande
     (Samsung Voice Interaction, TV récentes) ou touche de couleur / F2 dans l'aperçu (reconnaissance vocale
     web, si disponible). Le texte est inséré dans le champ, puis `input` et `dictation` (`e.detail.text`) sont
     émis sur le champ — ex. la musique lance la recherche sur `dictation`.
4. **`tv.css`** — chaque sélecteur **commence par `.w-<type>`** (vérifié par les tests). Les variables
   `var(--w)` / `var(--h)` donnent la taille du widget : `font-size: calc(var(--h) * 0.2)`. `var(--accent)` = couleur d'accent.
5. **Logique pure** dans un fichier à part (ex. `codes.js`, `dlna.js`) + **test** `<nom>.test.js` à côté.
6. Optionnel :
   - `admin.js` : `export function renderEditor(container, settings, onChange, api)` — complète le formulaire
     auto (boutons, assistants). `onChange(patch)` fusionne des réglages ; `api.call(route)` appelle le
     `server.js` du widget ; `api.fetchText(url, opts)` passe par le proxy de l'admin.
   - `server.js` : `export default { routes: { 'GET /route': async ({ body, query }) => data } }`, exposé sous
     `/api/widgets/<type>/route`. **Tourne sur le PC, uniquement dans l'admin** (jamais sur la TV).
   - `assets/` : `import icon from './assets/x.svg'` → texte SVG ; `.png/.jpg` → data URL.
7. Vérifier : `npm test`, puis `npm run dev` → ajouter le widget, régler, tester dans l'aperçu
   (clavier : flèches, Entrée, P/N/B, R/G/Y/U pour les touches de couleur, Page↑/Page↓ pour CH▲/CH▼). Puis « Envoyer sur la TV ».

Référence la plus simple : **`widgets/clock/`**. Exemple complet (admin + serveur + tests) : **`widgets/photos/`**.

## Règles

- Un widget ne modifie jamais `app/` ni `admin/` (il peut **importer** `app/Widget.js`, `app/dom.js`, `app/qr.js`, `app/list-panel.js`)
  et n'écrit jamais dans le DOM hors de son `el`.
- Aucun secret en dur : tout passe par les `settings` (config locale, ignorée par git).
- Tout ce qui est démarré doit être arrêté : préférer `this.every/after/listen` ; sinon nettoyer dans `destroy()`.
- **Compatibilité TV (Chrome 56)** : esbuild convertit la syntaxe moderne, mais **pas les API** — éviter
  `AbortController`, `IntersectionObserver`, `ResizeObserver`, `Intl…formatToParts`, `Array.prototype.flat`,
  `Object.fromEntries`… En CSS : pas de `inset`, `gap` en flexbox, `aspect-ratio`, `:is()`, container queries.
- **Aucun `<script>` inline** dans `app/index.html` : la CSP par défaut des apps Tizen les bloque (la config est
  écrite dans `dist/config.js`, le diagnostic de démarrage est `app/boot.js`, en ES5). Vérifié par `tools/build.test.js`.
- Pas de CDN ni de police distante : tout est embarqué dans le `.wgt` (exception : les API des services eux-mêmes).
- Navigation 100 % télécommande, lisible à 3 m : textes grands, contrastes forts.
- Les requêtes cross-origin marchent sur la TV grâce à `<access origin="*">` (tizen/config.xml) ; dans l'aperçu
  elles passent par `/api/proxy` (automatique avec `this.fetch*`).
- **CSP** : `tizen/config.xml` déclare une `<tizen:content-security-policy>` (sans elle, Tizen bloque tout script
  externe). Un widget qui charge un **script, une iframe ou un média externe** doit ajouter l'hôte à la bonne
  directive (`script-src`, `frame-src`, `media-src`…). L'aperçu applique la même CSP : une violation y apparaît
  dans la console du navigateur, comme elle se produirait sur la TV. `tools/build.test.js` vérifie l'essentiel.
