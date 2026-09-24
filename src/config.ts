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
