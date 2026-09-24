import type { FactCheck } from '../types';

let n = 0;
/** Vérification factice : seuls les champs utiles au test sont à préciser. */
export function fc(over: Partial<FactCheck>): FactCheck {
  n++;
  return {
    id: `id${n}`, claim: '', claimant: null, claimDate: null, rating: 'Faux', verdict: 'faux', theme: 'Divers',
    country: 'France', lang: 'fr', publisher: 'AFP Factuel', site: 'factuel.afp.com', title: null,
    url: `https://factuel.afp.com/${n}`, reviewDate: '2026-09-20T10:00:00Z', ...over,
  };
}
