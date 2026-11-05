# TV Dashboard — guide du projet

Application web **Tizen** pour TV Samsung : un dashboard plein écran (1920×1080) composé de widgets
configurables (horloge, météo, QR Wi-Fi, musique YouTube, photos de la box…).

- **TV** : vanilla JS, bundlé par esbuild en un seul fichier (`target: chrome56`). Aucun serveur au quotidien.
- **Config** : page d'admin sur le PC (`npm run dev`) → `config/dashboard.json` → **embarquée dans le build**
  et poussée sur la TV par « Envoyer sur la TV » (`npm run deploy`). La TV ne contacte jamais le PC.
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
tizen/            config.xml (manifeste Tizen, privilèges) + icon.png
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
     red green yellow blue`. Les flèches non gérées déplacent le focus ; les touches média non gérées par le
     widget focalisé sont proposées aux autres widgets.
   - `onFocus(focused)`, `destroy()` (optionnels).
   - Utilitaires : `this.every(ms, fn)` (timer auto-nettoyé ; une erreur/promesse rejetée affiche l'état
     d'erreur, effacé au succès suivant), `this.after(ms, fn)`, `this.listen(target, type, fn)`,
     `this.fetchJson/fetchText(url, opts)` (timeout, erreurs HTTP, proxy automatique dans l'aperçu),
     `this.showError(msg)` / `this.clearError()`, `this.size` (`{ width, height }` en px),
     `this.platform` (`isTizen`, `isPreview`, `launchApp(appId)`). Helper DOM : `h()` de `app/dom.js`.
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
   (clavier : flèches, Entrée, P/N/B, R/G/Y/U pour les touches de couleur). Puis « Envoyer sur la TV ».

Référence la plus simple : **`widgets/clock/`**. Exemple complet (admin + serveur + tests) : **`widgets/photos/`**.

## Règles

- Un widget ne modifie jamais `app/` ni `admin/` (il peut **importer** `app/Widget.js` et `app/dom.js`)
  et n'écrit jamais dans le DOM hors de son `el`.
- Aucun secret en dur : tout passe par les `settings` (config locale, ignorée par git).
- Tout ce qui est démarré doit être arrêté : préférer `this.every/after/listen` ; sinon nettoyer dans `destroy()`.
- **Compatibilité TV (Chrome 56)** : esbuild convertit la syntaxe moderne, mais **pas les API** — éviter
  `AbortController`, `IntersectionObserver`, `ResizeObserver`, `Intl…formatToParts`, `Array.prototype.flat`,
  `Object.fromEntries`… En CSS : pas de `inset`, `gap` en flexbox, `aspect-ratio`, `:is()`, container queries.
- Pas de CDN ni de police distante : tout est embarqué dans le `.wgt` (exception : les API des services eux-mêmes).
- Navigation 100 % télécommande, lisible à 3 m : textes grands, contrastes forts.
- Les requêtes cross-origin marchent sur la TV grâce à `<access origin="*">` (tizen/config.xml) ; dans l'aperçu
  elles passent par `/api/proxy` (automatique avec `this.fetch*`).
