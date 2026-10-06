/**
 * Adresse du flux publié chaque jour par le workflow GitHub Actions.
 * À remplacer par la vôtre : https://<pseudo-github>.github.io/<nom-du-dépôt>/feed.json
 * Tant qu'elle contient VOTRE-PSEUDO, l'appli se contente du flux embarqué.
 */
export const FEED_URL = 'https://johnbsoftware.github.io/verif/feed.json';

/** Flux embarqué dans l'APK (démonstration, ou collecte locale via « npm run collect »). */
export const BUNDLED_FEED = './feed.json';

/** En dessous de cet âge, le cache suffit et on ne retélécharge pas au retour dans l'appli. */
export const REFRESH_AFTER_MS = 60 * 60 * 1000;

/** Données de plus de 20 h (la collecte du jour est attendue) : on revérifie dès 5 min. */
export const EXPECT_NEW_AFTER_MS = 20 * 60 * 60 * 1000;
export const RECHECK_AFTER_MS = 5 * 60 * 1000;

export const THEMES = ['Santé', 'Politique', 'Climat & catastrophes', 'Économie', 'Sciences', 'International', 'Société', 'Culture & sport', 'Divers'];

/** Ancien nom de thème → nouveau (réglages, enregistrés et cache d'avant la 1.2.0). */
export const RENAMED_THEMES: Record<string, string> = { Climat: 'Climat & catastrophes' };

/** Rappel quotidien : vers 7 h 30, une fois la collecte du matin publiée. */
export const DIGEST_HOUR = 7;
export const DIGEST_MINUTE = 30;

/** Au-delà, le flux est jugé « en panne » (la collecte a lieu chaque matin). */
export const STALE_AFTER_MS = 36 * 60 * 60 * 1000;

/** Politique de confidentialité, publiée avec le flux sur GitHub Pages. */
export const PRIVACY_URL = 'https://johnbsoftware.github.io/verif/confidentialite.html';

/** Contact de l'éditeur : exigé par la règle Google Play « Actualités » (appli, site et fiche Play Store). */
export const CONTACT_EMAIL = 'johnb.software@gmail.com';
export const SITE_URL = 'https://johnbsoftware.github.io/verif/';
export const CONTACT_URL = 'https://johnbsoftware.github.io/verif/contact.html';

/** Fiche Play Store, ajoutée aux vérifications partagées depuis l'appli. */
export const STORE_URL = 'https://play.google.com/store/apps/details?id=fr.johnbsoftware.verif';
export const IFCN_URL = 'https://ifcncodeofprinciples.poynter.org/signatories';
export const EFCSN_URL = 'https://efcsn.com/';
