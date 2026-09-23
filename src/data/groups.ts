import type { FactCheck } from '../types';
import { keywords } from './match';

// Regroupe les vérifications qui portent sur la même affirmation (articles différents
// d'un même organisme, ou de plusieurs organismes, ou version française + anglaise).
// Critère : au moins 3 mots significatifs en commun représentant au moins 60 % des mots
// du texte le plus court, et des dates de publication à moins de 21 jours d'écart.

const MAX_GAP_MS = 21 * 86_400_000;

// Dates, mois et mots de circonstance ne suffisent pas à dire « même affirmation ».
const NOISE = /^((19|20)\d\d|janv|fevr|mars|avri|avril|mai|juin|juil|aout|sept|octo|nove|dece|janua|febr|march|april|june|july|augu|recen|actua|genui|real|dernie|nouve|foota|clip|falsel|false|linke|misle|misre|onlin|circu|fake|fabri|faux|fauss|atten|tromp|decon|conte|sorti|gener|artif|altere|manip|monta|trugu|deadl|dead|catas|disas|cause|trigg|after|aftermath)$/;
// Mots de vérification courants (« falsely linked », « misleads online », « attention à »…) : sans valeur ici.

function stems(it: FactCheck): Set<string> {
  return new Set(keywords(`${it.claim} ${it.title ?? ''}`).filter((k) => !NOISE.test(k)));
}

export function similar(a: Set<string>, b: Set<string>): boolean {
  let common = 0;
  for (const k of a) if (b.has(k)) common++;
  return common >= 3 && common / Math.min(a.size, b.size) >= 0.6;
}

/** Préférence pour la carte affichée : français, avec résumé, puis la plus récente. */
function rank(it: FactCheck): number {
  return ((it.lang || 'fr').startsWith('fr') ? 4 : 0) + (it.summary ? 2 : 0);
}

export interface Group {
  lead: FactCheck;
  others: FactCheck[];
}

/**
 * Regroupe une liste triée du plus récent au plus ancien. Chaque vérification rejoint le premier
 * groupe dont la vérification d'origine lui ressemble (pas de chaînage : A~B et B~C ne suffisent
 * pas à réunir A et C, sinon tout un événement comme « les inondations au Népal » finirait en un bloc).
 */
export function groupSimilar(items: FactCheck[]): Group[] {
  const seeds: { set: Set<string>; time: number; members: FactCheck[] }[] = [];
  for (const it of items) {
    const set = stems(it);
    const time = Date.parse(it.reviewDate);
    const home = seeds.find((g) => Math.abs(g.time - time) <= MAX_GAP_MS && similar(g.set, set));
    if (home) home.members.push(it);
    else seeds.push({ set, time, members: [it] });
  }
  return seeds.map(({ members }) => {
    const sorted = [...members].sort(
      (a, b) => rank(b) - rank(a) || Date.parse(b.reviewDate) - Date.parse(a.reviewDate),
    );
    return { lead: sorted[0], others: sorted.slice(1) };
  });
}

/** Pour l'écran de détail : les autres vérifications du même sujet, par identifiant. */
export function relatedIndex(items: FactCheck[]): Map<string, FactCheck[]> {
  const index = new Map<string, FactCheck[]>();
  for (const g of groupSimilar(items)) {
    const all = [g.lead, ...g.others];
    for (const it of all) index.set(it.id, all.filter((x) => x !== it));
  }
  return index;
}
