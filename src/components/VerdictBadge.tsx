import type { Verdict } from '../types';

export const VERDICT_LABEL: Record<Verdict, string> = {
  faux: 'Faux',
  trompeur: 'Trompeur',
  vrai: 'Vrai',
  autre: 'À lire',
};

export function VerdictBadge({ verdict, large = false }: { verdict: Verdict; large?: boolean }) {
  return <span className={`badge badge-${verdict}${large ? ' badge-lg' : ''}`}>{VERDICT_LABEL[verdict]}</span>;
}
