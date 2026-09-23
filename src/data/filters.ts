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

export function applyFilters(items: FactCheck[], q: Query): FactCheck[] {
  const { countries, themes } = q.settings;
  const words = fold(q.search).split(/\s+/).filter(Boolean);
  return items.filter((it) => {
    if (!q.settings.english && !isFrench(it)) return false;
    if (countries.length && !countries.includes(it.country)) return false;
    if (themes.length && !themes.includes(it.theme)) return false;
    if (q.theme !== 'Tout' && it.theme !== q.theme) return false;
    if (q.verdict !== 'tous' && it.verdict !== q.verdict) return false;
    if (words.length) {
      const hay = fold([it.claim, it.title ?? '', it.claimant ?? '', it.publisher, it.rating].join(' '));
      if (!words.every((w) => hay.includes(w))) return false;
    }
    return true;
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
