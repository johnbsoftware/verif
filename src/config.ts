/**
 * Adresse du flux publié chaque jour par le workflow GitHub Actions.
 * À remplacer par la vôtre : https://<pseudo-github>.github.io/<nom-du-dépôt>/feed.json
 * Tant qu'elle contient VOTRE-PSEUDO, l'appli se contente du flux embarqué.
 */
export const FEED_URL = 'https://VOTRE-PSEUDO.github.io/verif/feed.json';

/** Flux embarqué dans l'APK (démonstration, ou collecte locale via « npm run collect »). */
export const BUNDLED_FEED = './feed.json';

/** En dessous de cet âge, le cache suffit et on ne retélécharge pas au retour dans l'appli. */
export const REFRESH_AFTER_MS = 60 * 60 * 1000;

export const THEMES = ['Santé', 'Politique', 'Climat', 'Économie', 'Sciences', 'International', 'Société', 'Culture & sport', 'Divers'];

export const DIGEST_HOUR = 7;
