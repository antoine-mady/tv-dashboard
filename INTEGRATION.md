# Intégration du widget « Sport à voir »

## Contenu

Le widget est autonome dans `widgets/sport-a-voir/` et détecté automatiquement par `tools/widgets.js`.

- `tv.js` / `tv.css` : interface TV, calendrier unifié et filtre multi-ligues.
- `sports/catalog.js` : catalogue commun des sports et ligues.
- `sports/league-of-legends/` : adaptateur CitoAPI pour les matchs LoL (LEC, Worlds).
- `sports/espn/api.js` : adaptateur des calendriers football et rugby via l'API publique ESPN.

## Sports et compétitions inclus

| Sport | Compétitions |
|---|---|
| Esport — League of Legends | LEC, Worlds |
| Football | Premier League, Ligue 1, Liga, Bundesliga, Serie A, Ligue des champions |
| Rugby à XV | Tournoi des Six Nations, Coupe du monde |

Les calendriers football et rugby utilisent les endpoints ESPN Site API v2. Cette API est publique et ne demande pas de clé, mais elle est non documentée officiellement et peut évoluer. Pour LoL, le widget combine `GET /api/v1/lol/live` et `GET /api/v1/lol/schedule/upcoming` sur `https://api.citoapi.com`, avec la clé CitoAPI dans l'en-tête `x-api-key`.

## Calendrier unifié et filtres

Au premier démarrage, toutes les ligues du catalogue sont activées. Le widget agrège les événements de toutes les ligues sélectionnées dans une seule liste, triée chronologiquement avec les rencontres en direct en premier. Le filtre ouvert avec **OK** permet d'activer plusieurs ligues à la fois, individuellement, ou d'utiliser **Tout sélectionner / Tout désélectionner**. La sélection est conservée localement sur la TV. Il n'y a pas de compétition active à choisir au démarrage.

Le widget affiche jusqu'à **10 événements**.

## Configuration

La clé CitoAPI est facultative dans l'administration et nécessaire uniquement pour afficher les compétitions LoL. Remplacez toute ancienne clé Riot par une clé CitoAPI dans les réglages du widget. Le football et le rugby continuent de fonctionner sans clé. Une clé CitoAPI peut être créée depuis [citoapi.com](https://citoapi.com/).

La configuration locale est embarquée dans le paquet de l'application TV, donc la clé est accessible à toute personne qui peut inspecter ce paquet ou la configuration. CitoAPI recommande de garder les clés côté serveur ; ce widget TV appelle l'API directement et ne fournit pas de proxy serveur.

## Installation

1. Copier le dossier `widgets/sport-a-voir/` à la racine du dépôt.
2. Lancer `npm install` si nécessaire.
3. Lancer `npm run dev`, ouvrir l'admin, puis ajouter **Sport à voir**.
4. Renseigner une clé CitoAPI uniquement si les événements League of Legends sont souhaités.
5. Vérifier dans l'aperçu, puis exécuter `npm run build` ou utiliser **Envoyer sur la TV**.

## Ajouter une ligue

Ajouter une entrée au catalogue dans `sports/catalog.js`. Pour une nouvelle compétition ESPN, renseigner `provider: 'espn'`, le sport ESPN et le slug de ligue. Pour un autre fournisseur, ajouter un adaptateur puis router sa requête dans `tv.js`.

## Tests

Les tests LoL existants sont dans `sports/league-of-legends/api.test.js` et les tests ESPN dans `sports/espn/api.test.js`. Le build complet, les tests et la compatibilité Tizen doivent être vérifiés sur la machine du projet.
