# Vérif — première diffusion sur la Play Console

Tout ce qu'il faut pour publier Vérif en **test interne** (toi et ta femme, disponible en quelques minutes),
puis en test fermé et en production. Les visuels sont dans `play-store/`.

| Fichier | Où il va dans la Play Console | Format exigé |
|---|---|---|
| `play-store/icone-512.png` | Fiche principale → Icône de l'application | 512 × 512, PNG, ≤ 1 Mo |
| `play-store/banniere-1024x500.png` | Fiche principale → Image de présentation | 1024 × 500, PNG ou JPEG |
| `play-store/captures/01…06.png` | Fiche principale → Captures d'écran du téléphone | 2 à 8 images, 9:16 (1080 × 1920) |

L'icône reprend exactement le rendu de l'icône installée sur le téléphone (coche ivoire sur bleu encre) ;
Google arrondit lui-même les angles.

---

## Étape 1 — Construire l'AAB signé (Android Studio)

1. Décompresser le zip dans `K:\Verif`, puis dans PowerShell : `npm run android` (Android Studio s'ouvre).
2. Si Android Studio affiche **Sync Now**, cliquer dessus.
3. **Build → Generate Signed App Bundle or APK…** → cocher **Android App Bundle** → Next.
4. **Key store path** : le même fichier `.jks` que pour tes APK signés de Vérif (même mot de passe, même alias).
   Cette clé devient ta **clé d'importation** : garde-la précieusement (sauvegarde NAS), elle servira pour chaque mise à jour.
5. Next → variante **release** → **Create**.
6. Le fichier est créé ici : `K:\Verif\android\app\release\app-release.aab` (versionCode 17, version 1.3.2).

> Chaque nouvel envoi sur la Play Console exige un **versionCode plus grand** que le précédent (déjà fait : 17).

## Étape 2 — Créer l'application

Play Console → **Toutes les applications** → **Créer une application** :

| Champ | Réponse |
|---|---|
| Nom de l'application | `Vérif – le vrai du faux` (modifiable plus tard) |
| Langue par défaut | Français – fr-FR |
| Application ou jeu | Application |
| Gratuite ou payante | **Gratuite** (irréversible : une appli gratuite ne peut plus devenir payante) |
| Déclarations | cocher les deux (règlement développeur, lois d'exportation des États-Unis) |

→ **Créer l'application**.

## Étape 3 — Test interne et dépôt de l'AAB

1. Menu de gauche : **Tester et publier → Tests → Tests internes**.
2. Onglet **Testeurs** → **Créer une liste de diffusion** : nom « Famille », ajouter ton adresse Gmail et celle de ta femme
   (celles des comptes Google des téléphones) → Enregistrer → cocher la liste → Enregistrer.
3. Onglet **Versions** → **Créer une version**.
4. **Signature d'application par Google Play** : accepter (« Utiliser la clé de signature générée par Google »).
   Google signe l'appli distribuée ; ta clé `.jks` ne sert qu'à lui envoyer les AAB.
5. **App bundles** → **Importer** → choisir `app-release.aab`. Attendre la fin de l'analyse.
6. **Nom de la version** : laisser `17 (1.3.2)`.
7. **Notes de version** (copier tel quel) :
   ```
   <fr-FR>
   Première version de test de Vérif :
   • le fil des vérifications du jour, par pays, thème et verdict
   • Vérifier un post en le partageant depuis Facebook, TikTok, X ou une capture d'écran
   • la rubrique Présidentielle 2027
   • le rappel du matin quand il y a du nouveau dans vos thèmes
   </fr-FR>
   ```
8. **Suivant** → lire les avertissements (normaux à ce stade : fiche incomplète…) → **Enregistrer et publier**.
   Si la Console bloque la publication, elle indique la tâche manquante : la remplir avec l'étape 4 puis revenir ici.
9. Onglet **Testeurs** → **Copier le lien** (« Comment les testeurs rejoignent-ils le test ? ») et l'envoyer à ta femme.

## Étape 4 — Installer la version de test sur les téléphones

1. **Désinstaller d'abord Vérif** (l'APK installé à la main) : la version du Play Store est signée par Google, Android
   refuserait la mise à jour par-dessus. Les enregistrés et réglages de l'APK de test seront perdus.
2. Ouvrir le lien de test sur le téléphone → **Accepter l'invitation** → **Télécharger sur Google Play** → Installer.
3. Vérifier dans Filtres → À propos : **1.3.2 (17)**.
   Si le Play Store dit « non disponible », attendre 10-30 minutes (première publication) et relancer le Play Store.

## Étape 5 — Contenu de l'application (Règles et programmes → Contenu de l'application)

Obligatoire avant le test fermé et la production. Réponses pour Vérif :

| Section | Réponse |
|---|---|
| **Règles de confidentialité** | `https://johnbsoftware.github.io/verif/confidentialite.html` |
| **Accès à l'application** | Toutes les fonctionnalités sont disponibles sans restriction (pas de compte) |
| **Annonces** | Non, mon appli ne contient pas d'annonces |
| **Identifiant publicitaire** | Non (l'autorisation AD_ID est retirée dans le manifeste depuis la 1.3.2) |
| **Classification du contenu** | Catégorie « Référence, actualités ou éducation » ; aucune violence, sexualité, langage grossier, drogue ; pas d'interaction entre utilisateurs, pas de partage de position, pas d'achats → PEGI 3 / Tous publics attendu |
| **Public cible** | **18 ans et plus uniquement** (évite les exigences « Familles » qui ont bloqué MiniSeries) ; appli non attrayante pour les enfants : Non |
| **Appli d'actualités** | **Oui** (catégorie Actualités) : chaque vérification cite l'organisme source, l'éditeur et son contact figurent sur la fiche |
| **Applis gouvernementales** | Non |
| **Fonctionnalités financières** | Mon appli ne propose aucune fonctionnalité financière |
| **Santé** | Mon appli n'a aucune fonctionnalité de santé |
| **Sécurité des données** | voir ci-dessous |

### Sécurité des données

La lecture du texte des images (ML Kit, via les services Google Play) envoie à Google des informations techniques
(modèle du téléphone, performances, identifiant d'installation), selon la
[page de divulgation de ML Kit](https://developers.google.com/ml-kit/android-data-disclosure). Il faut donc les déclarer :

1. **Votre application collecte-t-elle ou partage-t-elle des types de données requis ?** → **Oui**
2. **Toutes les données sont-elles chiffrées en transit ?** → **Oui**
3. **Moyen de demander la suppression des données** → Non (aucun compte ; données techniques gérées par Google)
4. Types de données à cocher :
   - **Infos et performances de l'appli → Diagnostics** : collectées, **non partagées**, non éphémères,
     **obligatoires**, finalité **Analyses**
   - **Appareil ou autres identifiants** : collectés, **non partagés**, non éphémères, **obligatoires**, finalité **Analyses**
5. Rien d'autre : pas de position, pas de contacts, pas de données personnelles ; les réglages et enregistrés restent
   sur le téléphone. Les liens partagés vers TikTok / X / YouTube et les images envoyées à Google Lens le sont
   **à la demande explicite de l'utilisateur** (exemption prévue par Google pour ce type de transfert).

## Étape 6 — Fiche principale du Play Store (Développer l'audience → Présence sur le Play Store)

**Coordonnées et catégorie** (Paramètres de la fiche) : catégorie **Actualités et magazines**,
e-mail `johnb.software@gmail.com`, site web `https://johnbsoftware.github.io/verif/`.

**Fiche principale** :

- **Nom** (30 car.) : `Vérif – le vrai du faux`
- **Description courte** (80 car.) : `Les vérifications des fact-checkeurs, chaque jour, par pays et par thème.`
- **Description complète** :

> Une photo, une vidéo, une info qui circule sur Facebook ou TikTok vous paraît douteuse ? Vérif rassemble chaque
> matin les vérifications publiées par des organismes de fact-checking reconnus : AFP Factuel, Les Vérificateurs
> (TF1 Info), Fake Off (20 Minutes), Vrai ou Fake (franceinfo), Poligraph, De Facto…
>
> • Un fil clair : l'affirmation, le verdict (Faux, Trompeur, Vrai) et l'organisme qui l'a vérifiée
> • Des filtres par pays, par thème (santé, politique, climat & catastrophes, économie…) et par verdict
> • Le repère « Réseaux sociaux » pour les rumeurs venues de Facebook, TikTok, X, WhatsApp…
> • Vérifier un post : dans Facebook, TikTok ou X, touchez Partager puis Vérif. Une capture d'écran fonctionne aussi :
>   le texte de l'image est lu sur le téléphone, et Google Lens retrouve où l'image a déjà été publiée
> • Présidentielle 2027 : les déclarations des candidats vérifiées par les fact-checkeurs, sans classement
> • Un rappel le matin, seulement s'il y a du nouveau dans vos thèmes
> • Enregistrez les vérifications utiles pour les retrouver plus tard
>
> Vérif ne juge rien elle-même : chaque verdict vient de l'organisme cité, avec un lien vers son article complet.
> Aucune inscription, aucune publicité.
>
> Données : Google Fact Check Tools (balisage ClaimReview publié par les éditeurs).

- **Icône** : `play-store/icone-512.png`
- **Image de présentation** : `play-store/banniere-1024x500.png`
- **Captures d'écran du téléphone** : les 6 fichiers de `play-store/captures/`, dans l'ordre
- Tablettes : rien à mettre (facultatif).

## Étape 7 — Test fermé puis production

Comme pour MiniSeries : un compte développeur personnel récent doit faire tourner un **test fermé avec au moins
12 testeurs inscrits pendant 14 jours d'affilée** avant de pouvoir demander la production.

1. **Tests → Test fermé → Alpha → Gérer le canal** → Testeurs : liste d'e-mails (12 personnes minimum :
   famille, collègues…) ou un Google Groupe.
2. **Créer une version** → **Ajouter depuis la bibliothèque** : reprendre l'AAB 17 déjà importé → Publier.
   Le premier test fermé passe par l'**examen Google** (quelques heures à quelques jours).
3. Envoyer le lien d'inscription aux testeurs ; ils doivent rester inscrits 14 jours.
4. Au bout de 14 jours : **Tableau de bord → Demander l'accès à la production** (questionnaire sur le test),
   puis **Production → Créer une version** avec le dernier AAB, pays : France, Belgique, Suisse, Luxembourg, Canada…

## Avant chaque nouvelle version

- `versionCode` + 1 dans `android/app/build.gradle` (le zip le fait) → `npm run android` → Generate Signed App Bundle
- Tests internes → Créer une version → importer le nouvel AAB → notes de version → Publier
