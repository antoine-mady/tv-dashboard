# Icônes Samsung TV

L’icône Tizen utilisée par le paquet est `tizen/icon.png` (256 × 256, PNG RGBA). `tools/build.js` la copie déjà dans `dist/icon.png` : son chemin déclaré par `tizen/config.xml` ne change pas.

## Seller Office

Le dossier contient les visuels séparés à téléverser dans Samsung Apps TV Seller Office :

| Fichier | Dimensions | Format | Usage |
| --- | ---: | --- | --- |
| `icon-logo-1920x1080.png` | 1920 × 1080 | PNG RGBA, < 300 Ko | Logo transparent à superposer au fond |
| `icon-background-1920x1080.png` | 1920 × 1080 | PNG RGB, < 300 Ko | Fond correspondant au logo |
| `icon-store-512x423.png` | 512 × 423 | PNG RGB, < 300 Ko | Icône compacte de l’application |

Le dessin source éditable est `tizen/icon.svg`. Les captures de l’application sont un autre champ Seller Office : Samsung demande au moins quatre captures JPG de 1920 × 1080, chacune de moins de 500 Ko.

Les dimensions et formats ci-dessus suivent le [guide Samsung App Icons and Screenshots](https://developer.samsung.com/smarttv/design/app-icons-and-screenshots.html).

