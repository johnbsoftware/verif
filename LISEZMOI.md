# Vérif

Appli Android qui rassemble chaque jour les vérifications publiées par des organismes de fact-checking reconnus, avec des filtres par pays, par thème et par verdict. L'appli ne juge rien elle-même : chaque verdict vient d'un organisme cité en source.

- **Appli** : React + TypeScript + Vite + Capacitor 8 — `fr.johnbsoftware.verif`, cible le SDK 36
- **Données** : l'API Google Fact Check Tools (balisage ClaimReview des éditeurs)
- **Mise à jour** : un workflow GitHub Actions collecte chaque matin et publie `feed.json` sur GitHub Pages ; l'appli télécharge ce fichier (pas de clé API dans l'APK)

## Arborescence

```
collector/            collecte quotidienne (Node, sans dépendance)
  discover.mjs        npm run discover : éditeurs francophones recensés par Google
  sources.json        organismes interrogés : à ajuster après la 1re collecte
  normalize.mjs       verdict libre → faux / trompeur / vrai / autre, thème, pays
  collect.mjs         appel API, pagination, fusion avec l'historique (60 jours)
  collector.test.mjs  npm test
.github/workflows/    collecte-quotidienne.yml (tous les jours vers 6 h 30, + commit de maintien)
pages/                publiées avec le flux : accueil + politique de confidentialité
PLAY-STORE.md         textes de la fiche et réponses « Sécurité des données »
public/feed.json      flux de DÉMONSTRATION embarqué (bandeau orange dans l'appli)
src/                  l'appli (config.ts : adresse du flux)
assets/               sources de l'icône et du splash (tools/make-icons.py)
```

## Commandes

| Commande | Effet |
|---|---|
| `npm install` | installe les dépendances |
| `npm run dev` | appli dans le navigateur (F12 → mode mobile) |
| `npm test` | tests du collecteur (node --test) puis de l'appli (Vitest) |
| `npm run collect` | collecte réelle en local vers `public/feed.json` (clé dans `.env`) |
| `npm run android` | build + `cap sync` + ouverture d'Android Studio |

## Ce que l'API fournit et ne fournit pas

Pour chaque vérification : l'affirmation, son auteur, le verdict **tel qu'écrit par l'éditeur** (« Photo sortie de son contexte »…), le titre de l'article, la date et le lien. **Il n'y a pas de résumé** : l'écran de détail affiche la conclusion, le titre et un bouton vers l'article complet. Le classement Faux / Trompeur / Vrai est déduit de la conclusion par `normalize.mjs`, et le thème par mots-clés : les deux sont à affiner une fois qu'on verra de vraies données.

## Nouveautés de la 1.2.0

- **Rappel quotidien intelligent** : une tâche Android (WorkManager, `DigestWorker.java`) télécharge le flux vers 7 h 30
  et ne notifie que s'il y a de nouvelles vérifications dans les pays / thèmes / langue choisis
  (« 12 nouvelles vérifications — Santé 3 · Politique 2 · Société 2 »). Collecte GitHub en retard : nouvel essai
  toutes les heures (4 fois). Rien n'est annoncé deux fois, ni ce qui a déjà été vu dans l'appli.
- **Repère « Nouveau »** sur les vérifications arrivées avec la dernière collecte, et leur nombre en tête du fil.
- **Bandeau d'alerte** quand le flux a plus de 36 h (collecte arrêtée).
- **Maintien du workflow** : GitHub coupe les tâches planifiées d'un dépôt public sans commit depuis 60 jours ;
  le workflow fait un petit commit (`.github/derniere-activite.txt`) quand le dernier date de 45 jours.
- Thème **« Climat & catastrophes »** (volcans, séismes, inondations) ; réglages et enregistrés migrés automatiquement.
- Flux stocké dans un **fichier privé** de l'appli (plugin `VerifNativePlugin.java`) au lieu des préférences Android.
- **R8** activé pour l'APK de publication (code et ressources inutilisés retirés).
- Corrections : négations (« Pas vrai », « Non avéré »… étaient classées Vrai), rapprochement des textes partagés longs,
  repère Réseaux sociaux (« compte »), résumés retentés après une panne passagère, « Lecture du résumé… » bloqué,
  bouton Retour après « Sur le même sujet » (revient à la vérification précédente).

### Après mise à jour des fichiers

`npm install` une fois (Vitest ajouté pour les tests), puis `npm run android`. Dans Android Studio, laisser
Gradle se synchroniser (nouvelle dépendance WorkManager). Sur GitHub : committer aussi `pages/` et le workflow.

## Rubrique Présidentielle (1.3.0)

- `collector/candidats.json` : la liste des candidats (nom complet, et au besoin d'autres écritures dans `aliases`).
  Modifiable à tout moment : prise en compte à la collecte suivante, sans nouvel APK. Vider la liste coupe la rubrique.
- Chaque matin, le collecteur cherche le nom de chaque candidat chez **tous** les vérificateurs recensés par Google
  (12 mois la première fois, puis 7 jours) et ne garde que les affirmations dont il est l'**auteur**.
  Ces déclarations sont conservées 400 jours (toute la campagne), hors du plafond de 2 000 éléments.
- Dans l'appli : puce « Présidentielle 2027 » dans le fil → candidats par ordre alphabétique du nom de famille →
  déclarations vérifiées. Aucun décompte ni classement, par choix d'équilibre.
- Les déclarations anciennes arrivées d'un coup (nouveau candidat) ne sont ni marquées « Nouveau » ni annoncées
  par le rappel du matin (seules les vérifications de moins de 7 jours le sont).
