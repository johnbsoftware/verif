import type { FactCheck, Settings, Verdict } from '../types';

export type VerdictFilter = 'tous' | Exclude<Verdict, 'autre'>;

export function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export const isFrench = (it: FactCheck) => (it.lang || 'fr').toLowerCase().startsWith('fr');

export interface Query {
  settings: Settings;
  theme: string; // 'Tout' ou un thème
  verdict: VerdictFilter;
  search: string;
}

/** Mots d'une recherche, sans accents ni majuscules. */
export const searchWords = (search: string) => fold(search).split(/\s+/).filter(Boolean);

/**
 * Vrai si la vérification contient tous les mots cherchés : affirmation, titre, résumé, auteur,
 * candidat, organisme et verdict — dans le texte affiché (traduit le cas échéant) comme dans
 * le texte d'origine (« vaccin » comme « vaccine » trouvent la vérification).
 */
export function matchesSearch(it: FactCheck, words: string[]): boolean {
  if (!words.length) return true;
  const hay = fold([
    it.claim, it.title ?? '', it.summary ?? '', it.claimant ?? '', it.candidate ?? '', it.publisher, it.rating,
    it.original?.claim ?? '', it.original?.title ?? '', it.original?.summary ?? '',
  ].join(' '));
  return words.every((w) => hay.includes(w));
}

export function applyFilters(items: FactCheck[], q: Query): FactCheck[] {
  const { countries, themes } = q.settings;
  const words = searchWords(q.search);
  return items.filter((it) => {
    if (!q.settings.english && !isFrench(it)) return false;
    if (countries.length && !countries.includes(it.country)) return false;
    if (themes.length && !themes.includes(it.theme)) return false;
    if (q.theme !== 'Tout' && it.theme !== q.theme) return false;
    if (q.verdict !== 'tous' && it.verdict !== q.verdict) return false;
    return matchesSearch(it, words);
  });
}

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

export function dayLabel(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (dayKey(d) === dayKey(now)) return "Aujourd'hui";
  if (dayKey(d) === dayKey(yesterday)) return 'Hier';
  const label = d.toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long',
    ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Regroupe par jour de publication (les éléments arrivent déjà triés). */
export function groupByDay(items: FactCheck[], now = new Date()): { label: string; items: FactCheck[] }[] {
  const groups: { label: string; items: FactCheck[] }[] = [];
  for (const it of items) {
    const label = dayLabel(it.reviewDate, now);
    const last = groups[groups.length - 1];
    if (last?.label === label) last.items.push(it);
    else groups.push({ label, items: [it] });
  }
  return groups;
}

export function countriesLabel(selected: string[], all: string[]): string {
  if (!selected.length || selected.length >= all.length) return 'Tous pays';
  if (selected.length === 1) return selected[0];
  return `${selected.length} zones`;
}
