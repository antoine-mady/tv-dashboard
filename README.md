# 📺 TV Dashboard

Dashboard à widgets pour TV Samsung (Tizen) : horloge, météo, QR code Wi-Fi, musique YouTube,
diaporama des photos du disque branché sur la box. Configuration depuis le PC, puis envoi sur la TV.

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

## Préparer la TV (une seule fois)

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

## Widgets fournis

| Widget | Remarques |
|---|---|
| 🕐 Horloge | Fuseau horaire configurable. |
| ⛅ Météo | [Open-Meteo](https://open-meteo.com), sans clé API. |
| 📶 QR Wi-Fi | Le mot de passe reste dans la config locale et dans l'app installée sur la TV. |
| 🎵 Musique YouTube | Collez le lien d'une playlist YouTube Music. OK = lecture/pause, ⏭ ⏮ ⏯ fonctionnent même sans focus, touche rouge = app YouTube. Les titres dont l'intégration est bloquée par l'ayant droit sont sautés. |
| 🖼️ Photos | Disque branché sur la box : le **partage multimédia DLNA/UPnP** doit être activé sur la box Zeop. Le bouton « Rechercher la box » trouve l'URL automatiquement. Sinon, un disque USB branché directement sur la TV fonctionne aussi. |

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
