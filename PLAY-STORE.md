# Vérif — fiche Google Play

## Textes de la fiche

**Nom** (30 car. max) : `Vérif – le vrai du faux`

**Description courte** (80 car. max) :
`Les vérifications des fact-checkeurs, chaque jour, par pays et par thème.`

**Description complète** :

> Une photo, une vidéo, une info qui circule sur Facebook ou TikTok vous paraît douteuse ? Vérif rassemble chaque
> matin les vérifications publiées par des organismes de fact-checking reconnus : AFP Factuel, Les Vérificateurs
> (TF1 Info), Fake Off (20 Minutes), Vrai ou Fake (franceinfo), Poligraph, De Facto…
>
> • Un fil clair : l'affirmation, le verdict (Faux, Trompeur, Vrai) et l'organisme qui l'a vérifiée
> • Des filtres par pays, par thème (santé, politique, climat & catastrophes, économie…) et par verdict
> • Le repère « Réseaux sociaux » pour les rumeurs venues de Facebook, TikTok, X, WhatsApp…
> • Vérifier un post : dans Facebook, TikTok ou X, touchez Partager puis Vérif. Une capture d'écran fonctionne aussi :
>   le texte de l'image est lu sur le téléphone, et Google Lens retrouve où l'image a déjà été publiée
> • Un rappel le matin, seulement s'il y a du nouveau dans vos thèmes
> • Enregistrez les vérifications utiles pour les retrouver plus tard
>
> Vérif ne juge rien elle-même : chaque verdict vient de l'organisme cité, avec un lien vers son article complet.
> Aucune inscription, aucune publicité, aucune donnée personnelle collectée.
>
> Données : Google Fact Check Tools (balisage ClaimReview publié par les éditeurs).

**Catégorie** : Actualités et magazines · **Adresse e-mail** : johnb.software@gmail.com
**Site web** : https://johnbsoftware.github.io/verif/
**Règles de confidentialité** : https://johnbsoftware.github.io/verif/confidentialite.html
(publiée par le workflow à la prochaine collecte, une fois `pages/` poussé sur GitHub)

## Contenu de l'application (Play Console → Règles et programmes)

| Question | Réponse |
|---|---|
| Publicités | Non |
| Accès à l'appli | Toutes les fonctionnalités sont accessibles sans restriction |
| Public cible | 18 ans et plus (ou 13+ ; pas destinée aux enfants) |
| Appli d'actualités | Oui — sources citées sur chaque vérification, éditeur et contact dans la fiche |
| Classification du contenu | Questionnaire IARC : aucun contenu sensible (catégorie « Référence, actualités ou éducation ») |
| Autorisations sensibles | Aucune (notifications uniquement, demandées à l'activation du rappel) |

## Sécurité des données

- **Votre application collecte-t-elle ou partage-t-elle des données utilisateur requises ?** → **Non.**
  - Aucune donnée n'est envoyée à l'éditeur ; réglages et enregistrés restent sur le téléphone.
  - Les liens partagés vers Vérif sont transmis à TikTok / X / YouTube (aperçu oEmbed) et les images à Google Lens
    **uniquement à l'initiative de l'utilisateur** : Google considère ces transferts comme exclus du « partage ».
  - La lecture du texte des images (ML Kit) se fait sur l'appareil.
- **Chiffrement en transit** : oui (toutes les connexions en HTTPS).
- **Suppression des données** : pas de compte ; tout s'efface en désinstallant l'appli.

## Captures conseillées (téléphone, 1080 × 1920 ou plus)

1. Le fil (filtre « Réseaux sociaux » actif, un repère « Nouveau » visible)
2. Une vérification ouverte avec son résumé
3. L'onglet Vérifier après un partage depuis TikTok
4. Les filtres (pays, thèmes)

## Avant la première publication

- Générer l'**Android App Bundle** signé (Build → Generate Signed App Bundle), garder la clé en lieu sûr
  (les fichiers `*.jks` / `*.keystore` sont exclus de Git).
- Tester l'APK de publication (R8 activé) : ouvrir le fil, partager un post, activer le rappel.
- Compte développeur personnel récent : Google impose un test fermé (12 testeurs pendant 14 jours) avant la production — à confirmer dans la Play Console.
