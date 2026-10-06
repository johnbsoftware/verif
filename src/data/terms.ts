import { fold } from './filters';
import { stripUrls } from './match';

// Mots-clés d'un texte partagé, pour les moteurs externes (Fact Check Explorer, Google) :
// ils trouvent avec 3 à 5 mots importants, presque jamais avec une phrase entière.

const STOP = new Set(
  (
    'le la les un une des du de d l au aux et ou mais donc or ni car que qui quoi dont ou ce cet cette ces son sa ses ' +
    'leur leurs mon ma mes ton ta tes notre nos votre vos il elle ils elles on nous vous je tu me te se lui y en ne pas ' +
    'plus moins tres trop tout tous toute toutes rien aucun aucune meme aussi alors ainsi encore deja jamais toujours ' +
    'est sont etait etaient sera seront ete etre avoir avait ont a ai as fait faire font peut peuvent doit veut veulent ' +
    'pour par avec sans sous sur dans entre vers chez depuis pendant contre selon comme quand si apres avant voici voila ' +
    'maintenant aujourd hui hier demain ici la-bas oui non bon bien mal vraiment enfin quel quelle quels quelles ' +
    'regardez partagez partager incroyable urgent attention video photo image post publication ' +
    'the a an and or but of to in on at for with from by is are was were be been this that these those it its ' +
    'they them their he she his her we you your our not no yes just very more most all any some will would can could'
  ).split(' '),
);

interface Scored { word: string; key: string; score: number; pos: number }

/**
 * Jusqu'à `max` mots importants, dans leur ordre d'apparition : noms propres et sigles d'abord,
 * puis chiffres et mots longs. Les mots gardent leur forme d'origine (« Macron », « milliards »).
 */
export function keyTerms(text: string, max = 5): string[] {
  const clean = stripUrls(text).replace(/[«»“”"()[\]{}…]/g, ' ');
  const words = clean.split(/\s+/).filter(Boolean);
  const seen = new Set<string>();
  const scored: Scored[] = [];
  words.forEach((raw, pos) => {
    const word = raw.replace(/[.,;:!?]+$/, '').replace(/^['’-]+|['’-]+$/g, '').replace(/^(l|d|qu|n|s|c|j|m|t)['’]/i, '');
    const key = fold(word);
    if (!key || seen.has(key) || STOP.has(key)) return;
    const isNumber = /^\d+([.,]\d+)?%?$/.test(word);
    if (!isNumber && key.length < 3) return;
    seen.add(key);
    // Majuscule en milieu de phrase : nom propre probable ; en début de phrase : peut-être.
    const upper = /^[A-ZÀ-Ý]/.test(word);
    const sentenceStart = pos === 0 || /[.!?]$/.test(words[pos - 1] ?? '');
    const acronym = /^[A-ZÀ-Ý]{2,6}$/.test(word);
    const capitalScore = acronym ? 4 : upper ? (sentenceStart ? 2 : 3) : 0;
    const score = capitalScore + (isNumber ? 2 : 0) + (key.length >= 7 ? 1 : 0) + (key.length >= 10 ? 1 : 0);
    scored.push({ word, key, score, pos });
  });
  return scored
    .sort((a, b) => b.score - a.score || a.pos - b.pos)
    .slice(0, max)
    .sort((a, b) => a.pos - b.pos)
    .map((s) => s.word);
}

/** Sites des vérificateurs francophones, pour une recherche Google ciblée (y compris hors Google Fact Check). */
export const CHECKER_SITES = [
  'factuel.afp.com',
  'tf1info.fr',
  '20minutes.fr',
  'francetvinfo.fr/vrai-ou-fake',
  'lemonde.fr/les-decodeurs',
  'liberation.fr/checknews',
  'lessurligneurs.eu',
  'observers.france24.com',
  'factcheck.afp.com',
];

export function checkersSearchUrl(terms: string[]): string {
  const sites = CHECKER_SITES.map((s) => `site:${s}`).join(' OR ');
  return `https://www.google.com/search?q=${encodeURIComponent(`${terms.join(' ')} (${sites})`)}`;
}

export function explorerUrl(terms: string[]): string {
  return `https://toolbox.google.com/factcheck/explorer/search/${encodeURIComponent(terms.join(' '))};hl=fr`;
}

export function googleUrl(terms: string[]): string {
  return `https://www.google.com/search?q=${encodeURIComponent(`${terms.join(' ')} vrai ou faux`)}`;
}
