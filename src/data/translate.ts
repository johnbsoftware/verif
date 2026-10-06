import type { FactCheck } from '../types';
import { isFrench } from './filters';

// Traduction des vérifications en anglais (AFP Fact Check…) : faite sur le téléphone par ML Kit,
// gardée en cache par identifiant. L'affichage remplace les textes par leur traduction et garde
// l'original dans `original` (pastille « Traduit » → « Voir l'original »).

export interface Translated {
  claim: string;
  title: string | null;
  rating: string;
  summary: string | null;
}

export type TranslationCache = Record<string, Translated>;

export const needsTranslation = (it: FactCheck) => !isFrench(it);

/** Version affichée : textes traduits, original conservé. */
export function applyTranslation(it: FactCheck, tr: Translated | undefined): FactCheck {
  if (!tr || it.original) return it;
  return {
    ...it,
    claim: tr.claim || it.claim,
    title: it.title ? tr.title || it.title : it.title,
    rating: tr.rating || it.rating,
    summary: it.summary ? tr.summary || it.summary : it.summary,
    original: { claim: it.claim, title: it.title, rating: it.rating, summary: it.summary ?? null },
  };
}

/** Retour aux textes d'origine (pour enregistrer une vérification telle que publiée). */
export function stripTranslation(it: FactCheck): FactCheck {
  if (!it.original) return it;
  const { original, ...rest } = it;
  return { ...rest, claim: original.claim, title: original.title, rating: original.rating, summary: original.summary ?? rest.summary };
}

/** Textes à traduire pour une vérification, dans l'ordre attendu par fromTexts. */
export const toTexts = (it: FactCheck) => [it.claim, it.title ?? '', it.rating, it.summary ?? ''];

export function fromTexts(it: FactCheck, out: string[]): Translated {
  return {
    claim: out[0] || it.claim,
    title: it.title ? out[1] || it.title : null,
    rating: out[2] || it.rating,
    summary: it.summary ? out[3] || it.summary : null,
  };
}

/** Garde le cache aux seules vérifications encore utiles (flux + enregistrés). */
export function pruneCache(cache: TranslationCache, keep: Set<string>): TranslationCache {
  return Object.fromEntries(Object.entries(cache).filter(([id]) => keep.has(id)));
}
