# Vérif

Appli Android qui rassemble chaque jour les vérifications publiées par des organismes de fact-checking reconnus, avec des filtres par pays, par thème et par verdict. L'appli ne juge rien elle-même : chaque verdict vient d'un organisme cité en source.

- **Appli** : React + TypeScript + Vite + Capacitor 8 — `fr.johnbsoftware.verif`, cible le SDK 36
- **Données** : l'API Google Fact Check Tools (balisage ClaimReview des éditeurs)
- **Mise à jour** : un workflow GitHub Actions collecte chaque matin et publie `feed.json` sur GitHub Pages ; l'appli télécharge ce fichier (pas de clé API dans l'APK)

## Arborescence

```
collector/            collecte quotidienne (Node, sans dépendance)
  sources.json        organismes interrogés : à ajuster après la 1re collecte
  normalize.mjs       verdict libre → faux / trompeur / vrai / autre, thème, pays
  collect.mjs         appel API, pagination, fusion avec l'historique (60 jours)
  collector.test.mjs  npm test
.github/workflows/    collecte-quotidienne.yml (tous les jours vers 6 h 30)
public/feed.json      flux de DÉMONSTRATION embarqué (bandeau orange dans l'appli)
src/                  l'appli (config.ts : adresse du flux)
assets/               sources de l'icône et du splash (tools/make-icons.py)
```

## Commandes

| Commande | Effet |
|---|---|
| `npm install` | installe les dépendances |
| `npm run dev` | appli dans le navigateur (F12 → mode mobile) |
| `npm test` | tests du collecteur |
| `npm run collect` | collecte réelle en local vers `public/feed.json` (clé dans `.env`) |
| `npm run android` | build + `cap sync` + ouverture d'Android Studio |

## Ce que l'API fournit et ne fournit pas

Pour chaque vérification : l'affirmation, son auteur, le verdict **tel qu'écrit par l'éditeur** (« Photo sortie de son contexte »…), le titre de l'article, la date et le lien. **Il n'y a pas de résumé** : l'écran de détail affiche la conclusion, le titre et un bouton vers l'article complet. Le classement Faux / Trompeur / Vrai est déduit de la conclusion par `normalize.mjs`, et le thème par mots-clés : les deux sont à affiner une fois qu'on verra de vraies données.
