import type { FactCheck } from '../types';
import { fold } from './filters';

// Retrouve, dans le fil, les vérifications proches d'un texte partagé.
// Méthode volontairement simple : mots significatifs en commun (racine de 5 lettres).

const STOP = new Set(
  (
    'avec dans pour sans sous vers chez entre depuis pendant contre selon plus moins tres tout tous toute toutes ' +
    'cette cette ceux celle celles elle elles nous vous leur leurs sont etait etre avoir fait faire font peut ' +
    'aussi alors donc mais comme quand quoi quel quelle quels quelles votre notre dont ainsi encore deja jamais ' +
    'video videos photo photos image images montre montrent voici voila regardez partagez partager lien article ' +
    'with that this from have were will what when your their there about after before into only over they them ' +
    'shows show shared video videos photo photos image images post posts claim claims just like more than been ' +
    'https http www com html facebook tiktok instagram twitter youtube share watch'
  ).split(' '),
);

const URL_RE = /https?:\/\/\S+/g;

export function extractUrls(text: string): string[] {
  return text.match(URL_RE) ?? [];
}

export function stripUrls(text: string): string {
  return text.replace(URL_RE, ' ').replace(/\s+/g, ' ').trim();
}

export function keywords(text: string): string[] {
  const words = fold(stripUrls(text))
    .split(/[^a-z0-9]+/)
    .filter((w) => (w.length >= 4 || /^\d{2,}$/.test(w)) && !STOP.has(w));
  return [...new Set(words.map((w) => (w.length > 4 ? w.replace(/s$/, '') : w).slice(0, 5)))];
}

export interface Match {
  item: FactCheck;
  score: number;
}

/**
 * Seuil de mots communs. Il dépend du plus court des deux textes : un post long qui contient
 * l'affirmation vérifiée (« Partagez avant suppression ! … ») doit la retrouver, alors qu'un
 * seuil calculé sur le seul texte partagé dépasserait le nombre de mots de la vérification.
 */
function needed(keys: number, stems: number): number {
  const fromKeys = keys <= 2 ? keys : Math.max(2, Math.ceil(keys * 0.25));
  // Texte partagé long : au moins 3 mots communs, pour éviter les rapprochements fortuits.
  const fromStems = Math.max(keys > 8 ? 3 : 2, Math.ceil(stems * 0.5));
  return Math.min(fromKeys, fromStems);
}

export function findMatches(text: string, items: FactCheck[], limit = 8): Match[] {
  const keys = keywords(text);
  if (!keys.length) return [];
  const scored: (Match & { cover: number })[] = [];
  for (const item of items) {
    const stems = new Set(keywords(`${item.claim} ${item.title ?? ''}`));
    if (!stems.size) continue;
    let score = 0;
    for (const k of keys) if (stems.has(k)) score++;
    if (score >= needed(keys.length, stems.size)) {
      scored.push({ item, score, cover: score / Math.min(keys.length, stems.size) });
    }
  }
  return scored
    .sort((a, b) => b.cover - a.cover || b.score - a.score || Date.parse(b.item.reviewDate) - Date.parse(a.item.reviewDate))
    .slice(0, limit)
    .map(({ item, score }) => ({ item, score }));
}

/** Texte de recherche proposé : le texte partagé sans les liens, raccourci. */
export function suggestedQuery(text: string): string {
  const clean = stripUrls(text);
  return clean.length > 160 ? `${clean.slice(0, 160).replace(/\s+\S*$/, '')}…` : clean;
}

/**
 * Requête courte pour les moteurs externes : un texte de 600 caractères lu sur une image
 * ne donne rien dans Fact Check Explorer. On garde les 12 premiers mots (sans les liens).
 */
export function shortQuery(text: string): string {
  const words = stripUrls(text).replace(/…$/, '').split(/\s+/).filter(Boolean);
  const q = words.slice(0, 12).join(' ');
  return q.length > 120 ? q.slice(0, 120).replace(/\s+\S*$/, '') : q;
}

export function factCheckExplorerUrl(query: string): string {
  const q = shortQuery(query);
  return `https://toolbox.google.com/factcheck/explorer/search/${encodeURIComponent(q)};hl=fr`;
}

export function webSearchUrl(query: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(`${shortQuery(query)} vérification`)}`;
}

// Lignes d'interface qu'on retrouve sur les captures d'écran de réseaux sociaux.
const OCR_NOISE = [
  /^\d+([.,]\d+)?\s*(k|m)?\s*(commentaires?|partages?|j.aime|r[ée]actions?|vues?|likes?|comments?|shares?|views?|retweets?|reposts?)\b/i,
  /^(j.aime|commenter|partager|r[ée]pondre|suivre|s.abonner|envoyer|voir (la )?traduction|voir plus|like|comment|share|reply|follow|send|see translation|more)$/i,
  /^(il y a|hier|aujourd|\d+\s*(min|h|j|sem|s|d|w|m|ans?)\b)/i,
  /^\d{1,2}(:\d{2})?\s*(sept|oct|nov|d[ée]c|janv|f[ée]vr|mars|avr|mai|juin|juil|ao[uû]t)\.?/i,
  /^[\d\s.,:%·•|/+-]*$/,
];

/** Nettoie le texte lu sur une capture d'écran : retire compteurs, boutons et horodatages. */
export function cleanOcrText(raw: string): string {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length >= 3 && !OCR_NOISE.some((re) => re.test(l)));
  return lines.join(' ').replace(/\s+/g, ' ').trim().slice(0, 600);
}
