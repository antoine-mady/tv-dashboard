# 📺 TV Dashboard

Dashboard à widgets pour TV Samsung (Tizen) : horloge, météo, agenda (iCal), anniversaires, mot créole du jour,
horaires de bus, QR code Wi-Fi, musique YouTube, diaporama des photos du disque branché sur la box.
Configuration depuis le PC, puis envoi sur la TV.

## Démarrage rapide (sur le PC)

Prérequis : [Node.js](https://nodejs.org) 20 ou plus.

```bash
npm install
```

```bash
npm run dev
```

Ouvrez http://localhost:5173 : ajoutez et disposez les widgets, réglez-les, vérifiez le résultat dans l'aperçu.
La config est enregistrée dans `config/dashboard.json` (fichier personnel, non versionné).

## Plusieurs pages (ex. « Moi » et « Invités »)

Dans l'admin, la barre **Pages** au-dessus de la disposition permet d'ajouter, dupliquer (⧉), renommer (✎ ou
double-clic), réordonner (◀ ▶) et supprimer des pages. Chaque page a ses propres widgets ; les réglages généraux
(fond, couleur, mode nuit…) sont communs.

Sur la TV, **CH▲ / CH▼** passent à la page suivante / précédente (le nom de la page s'affiche quelques secondes).
Une touche de couleur peut aussi faire défiler les pages (*Réglages généraux → Touche couleur pour changer de
page*). La TV rouvre la dernière page affichée au redémarrage (désactivable) ; sinon, c'est la première page.

Astuce : un widget **dupliqué** et laissé à la même place avec les mêmes réglages sur deux pages n'est pas recréé
quand on change de page (la musique continue, par exemple). Les autres widgets sont arrêtés et relancés.

## Installer sur la TV avec Apps2Samsung (le plus simple)

[Apps2Samsung](https://github.com/Apps2Samsung/Apps2Samsung) gère lui-même le certificat Samsung et
l'installation : Tizen Studio n'est pas nécessaire.

1. **Mode développeur de la TV** : ouvrez *Apps*, tapez `1 2 3 4 5` avec la télécommande, activez
   *Developer mode*, saisissez l'**IP du PC** qui lance Apps2Samsung, puis redémarrez complètement la TV
   (débranchez-la 30 secondes). La TV et le PC doivent être sur le même réseau.
2. **Créer le paquet** : dans l'admin, **Envoyer sur la TV** propose **Télécharger le .wgt** quand Tizen Studio
   n'est pas installé ; ou en ligne de commande :
   ```bash
   npm run wgt
   ```
   Cela produit `TVDashboard.wgt` (non signé : Apps2Samsung le signe lui-même).
3. **Installer** : dans Apps2Samsung, choisissez l'installation d'un **WGT personnalisé**, sélectionnez
   `TVDashboard.wgt`, choisissez la TV détectée et lancez l'installation (connexion au compte Samsung demandée
   la première fois pour le certificat).
4. **Démarrage automatique** : *Paramètres → Général → Fonctions Smart → Exécution auto. dernière app* = ON,
   puis lancez une fois « TVDashboard » depuis la liste des apps.

Après chaque changement de config : nouveau `.wgt` et réinstallation par Apps2Samsung.
⚠ Laissez le **mode développeur activé** : les apps installées ainsi peuvent disparaître s'il est désactivé.

## Préparer la TV avec Tizen Studio (alternative : bouton « Envoyer sur la TV »)

1. **Tizen Studio** : installez [Tizen Studio](https://developer.tizen.org/development/tizen-studio/download)
   (la version « CLI » suffit), puis, dans le *Package Manager*, les extensions **Samsung TV** (« TV Extensions »
   et « Samsung Certificate Extension »).
2. **Mode développeur de la TV** : sur la TV, ouvrez *Apps*, tapez `1 2 3 4 5` avec la télécommande, activez
   *Developer mode* et saisissez l'**IP de votre PC**, puis redémarrez la TV (débranchez-la 30 secondes).
3. **Certificat Samsung** : dans Tizen Studio, ouvrez *Tools → Certificate Manager*, cliquez sur **+**, choisissez
   *Samsung*, puis *TV*. Créez le certificat auteur et le certificat distributeur (compte Samsung requis), en
   ajoutant le **DUID** de la TV (il est détecté automatiquement si la TV est connectée via le *Device Manager*).
   Notez le nom du profil.
4. **Configuration locale** : copiez `.env.example` en `.env.local` et renseignez `TV_IP`, `TIZEN_PROFILE`, et
   `TIZEN_HOME` si `tizen` et `sdb` ne sont pas dans le PATH.
5. **Démarrage automatique** : dans *Paramètres → Général → Fonctions Smart*, activez
   **Exécution auto. dernière app** (*Autorun Last App*). Le dashboard se relancera à chaque allumage.

## Envoyer sur la TV

Cliquez sur **📺 Envoyer sur la TV** dans l'admin, ou lancez :

```bash
npm run deploy
```

L'app est buildée, signée, installée puis lancée sur la TV (environ 10 s). À refaire après chaque modification.

**Sans Tizen Studio**, le bouton et `npm run deploy` ne peuvent pas signer ni installer l'app eux-mêmes : ils
produisent alors `TVDashboard.wgt` et indiquent comment l'installer avec Apps2Samsung (voir plus haut).

## Widgets fournis

Les widgets Agenda, Anniversaires, Bus et Météo se sélectionnent avec les flèches : **OK** ouvre un panneau plein écran
(▲▼ pour parcourir, CH▲ / CH▼ pour aller plus vite, ◀ ▶ pour les onglets, Retour pour fermer) :
📅 Agenda = tous les événements des 90 prochains jours avec le détail (horaire, lieu, description), un onglet par agenda ;
🎂 Anniversaires = toute l'année, triée par date ou par nom, avec une recherche (▲ jusqu'au champ, OK pour écrire, ou dictée).

| Widget | Remarques |
|---|---|
| ✍️ Texte | Saisie avec le clavier de la TV ou par dictée vocale (OK pour modifier). L'admin règle l'alignement, la taille et la couleur ; le texte reste enregistré sur la TV. |
| 🕐 Horloge | Fuseau horaire configurable. |
| ⛅ Météo | [Open-Meteo](https://open-meteo.com), sans clé API. **OK** : prévisions plein écran heure par heure (10 jours) et jour par jour (◀ ▶ pour changer ; OK sur un jour = ses heures). |
| 🚌 Horaires de bus | Réseaux de La Réunion (Alternéo, Car Jaune, Citalis, Kar'Ouest), données ouvertes de [transport.data.gouv.fr](https://transport.data.gouv.fr), sans clé API. Dans l'admin, « Chercher l'arrêt » puis « Choisir » : les horaires de l'arrêt sont embarqués dans l'app. Retards en temps réel pour Alternéo et Car Jaune. À la nouvelle saison d'horaires : « Mettre à jour les horaires » puis « Envoyer sur la TV » (le widget prévient 7 jours avant). **OK** : tous les horaires jusqu'à demain soir, un onglet par ligne (◀ ▶). |
| 📶 QR Wi-Fi | Le mot de passe reste dans la config locale et dans l'app installée sur la TV. |
| 🎵 Musique YouTube | Connecté à votre compte YouTube (voir ci-dessous). Boutons ⏮ ⏯ ⏭ ☰ à l'écran (◀ ▶ puis OK) pour les télécommandes sans touches média ; ☰ = bibliothèque plein écran (playlists, J'aime, recherche, en cours) avec les mêmes boutons en haut. Les touches ⏭ ⏮ ⏯ marchent aussi, même sans focus ; touche rouge = app YouTube. |
| 🖼️ Photos | Disque branché sur la box : le **partage multimédia DLNA/UPnP** doit être activé sur la box Zeop. Le bouton « Rechercher la box » trouve l'URL automatiquement. Sinon, un disque USB branché directement sur la TV fonctionne aussi. |

## Connecter YouTube (widget Musique)

YouTube Music n'a pas d'API publique : le widget utilise l'**API officielle YouTube Data v3** avec votre compte
Google, et le lecteur YouTube intégré pour la lecture.

1. **Identifiants Google** (une fois, ~15 min, gratuit) — le guide détaillé avec les liens est affiché dans l'admin
   quand on sélectionne le widget :
   - créer un projet sur la [Google Cloud Console](https://console.cloud.google.com/projectcreate) ;
   - activer l'**API YouTube Data v3** ;
   - configurer l'écran de consentement OAuth (« Externe ») puis le **publier en production** — sinon la connexion
     expire au bout de 7 jours (l'avertissement « application non validée » est normal pour un usage perso) ;
   - créer un **ID client OAuth** de type **« TV et appareils à saisie limitée »** ;
   - coller l'ID et le secret dans l'admin, puis « Tester les identifiants ».
2. **Sur la TV** : sélectionnez le widget, OK, puis scannez le QR code avec votre téléphone (ou ouvrez
   `google.com/device`) et saisissez le code affiché. La connexion est mémorisée sur la TV ; elle n'est ni dans
   la config ni dans git. « Se déconnecter » est dans la bibliothèque.

**Page lecteur** : YouTube refuse de lire dans une app installée sur la TV (« Erreur de configuration du lecteur
vidéo », erreur 153 : une app locale n'a pas d'adresse web). Le lecteur tourne donc dans la petite page
[`player/`](player/), publiée sur GitHub Pages (`https://antoine-mady.github.io/tv-dashboard/player/`), que le
widget ouvre en arrière-plan et pilote par messages. Elle ne contient et ne reçoit aucune donnée personnelle
(seulement les identifiants des morceaux à jouer). Si vous hébergez cette page ailleurs, changez « Adresse de la
page lecteur » dans l'admin et ajoutez son origine à `frame-src` dans `tizen/config.xml`.

Limites (imposées par YouTube, pas contournables proprement) :
- pas de mixes ni de recommandations personnalisées YouTube Music ; les « J'aime » sont ceux du compte YouTube ;
- le lecteur intégré n'est pas connecté au compte : **les pubs ne sont pas garanties absentes** malgré Premium
  (la touche rouge ouvre l'app YouTube officielle, connectée à Premium) ;
- quota gratuit : ~100 recherches par jour (les listes ne coûtent presque rien et sont mises en cache 30 min).

## Créer un widget

```bash
npm run new-widget mon-widget "Mon widget"
```

Tout le widget tient dans `widgets/mon-widget/`. Le guide complet (architecture, contrats, règles de
compatibilité TV) est dans [CLAUDE.md](CLAUDE.md).

## Dépannage

- **Voir la console de la TV** : le plus simple est de développer dans l'aperçu (`npm run dev`), qui exécute le
  même code. Pour déboguer sur la TV elle-même, ouvrez le dossier `dist/` comme projet dans Tizen Studio et
  utilisez *Debug As → Tizen Web Application* (Web Inspector).
- **« Connexion impossible »** : vérifiez que la TV est allumée, en Developer mode, avec l'IP du PC, et sur le même réseau.
- **Bords coupés** : augmentez « Marge autour de l'écran » dans *Réglages généraux*.
