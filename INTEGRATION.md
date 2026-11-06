# Intégration du widget « Sport à voir »

## Contenu

Le widget est autonome dans `widgets/sport-a-voir/` :

- `manifest.js` : déclaration et réglages du widget ;
- `tv.js` / `tv.css` : interface TV et navigation à la télécommande ;
- `sports/league-of-legends/` : adaptateur LoL Esports ;
- `sports/league-of-legends/leagues/` : une fiche par compétition (LEC, Worlds).

La découverte est automatique : `tools/widgets.js` détecte les dossiers contenant un `manifest.js`. Aucun registre, fichier de configuration du dashboard, ni code de `app/` ou `admin/` à modifier.

## Source des données

Le widget utilise l'API persistante LoL Esports :

`GET https://esports-api.lolesports.com/persisted/gw/getSchedule?hl=fr-FR&leagueId=…`

Authentification par en-tête `x-api-key`. Les identifiants de ligue utilisés sont :

| Compétition | Identifiant |
|---|---|
| LEC | `98767991302996019` |
| Worlds | `98767975604431411` |

La clé se configure dans les réglages du widget, jamais dans le code source. Attention : la configuration du dashboard est embarquée dans l'application TV ; une personne ayant accès au paquet ou à la TV peut donc extraire cette clé. Utilisez une clé dédiée et révoquez-la si elle est exposée. Les clés Riot de développement peuvent avoir une durée de validité limitée selon leur type.

Documentation / accès développeur : https://developer.riotgames.com/

## Installation

1. Copier le dossier `widgets/sport-a-voir/` à la racine du dépôt.
2. Lancer `npm install` si les dépendances ne sont pas encore installées.
3. Lancer `npm run dev`, ouvrir l'admin, puis ajouter **Sport à voir**.
4. Renseigner la clé API dans les réglages du widget, choisir la compétition par défaut et enregistrer.
5. Vérifier dans l'aperçu, puis exécuter `npm run build` ou utiliser **Envoyer sur la TV**.

Le widget actualise les calendriers toutes les 15 minutes par défaut. L'intervalle et le nombre de matchs affichés sont configurables.

## Télécommande

- Gauche / droite : basculer entre LEC et Worlds.
- OK : ouvrir le calendrier plein écran.
- Dans le calendrier : gauche / droite pour changer de compétition ; haut / bas pour parcourir ; Retour pour fermer.

## Ajouter un autre sport ou une autre ligue

La structure sépare le moteur TV de l'adaptateur du sport. Pour ajouter une ligue LoL, créer un fichier dans `sports/league-of-legends/leagues/`, puis l'ajouter à `sports/league-of-legends/index.js`. Pour un autre jeu/sport, créer un dossier dédié sous `sports/` avec son propre adaptateur API et ses fiches de ligues, puis relier ce catalogue au widget.

## Tests

Les tests unitaires de l'adaptateur sont dans `sports/league-of-legends/api.test.js` et sont exécutés par :

```bash
npm test
```

Le build complet du dashboard reste à valider sur la machine qui possède le dépôt et les dépendances.
