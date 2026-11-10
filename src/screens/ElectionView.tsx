import { useEffect, useMemo, useRef, useState } from 'react';
import type { Election, FactCheck } from '../types';
import { ClaimCard } from '../components/ClaimCard';
import { Chevron } from '../components/Icons';
import { longDate } from '../lib/format';
import { groupSimilar } from '../data/groups';
import { matchesSearch, searchWords } from '../data/filters';
import { THEMES } from '../config';

// Rubrique Présidentielle. Règles d'équilibre :
// - même présentation pour tous, ordre alphabétique du nom de famille ;
// - aucun décompte ni classement (les rédactions choisissent ce qu'elles vérifient :
//   comparer des chiffres d'un candidat à l'autre induirait en erreur) ;
// - toutes les déclarations vérifiées, vraies comme fausses.

/** « Jean-Luc Mélenchon » → « Mélenchon », « Marine Le Pen » → « Le Pen » : tout sauf le prénom. */
export const surname = (name: string) => name.split(' ').slice(1).join(' ') || name;
const bySurname = (a: string, b: string) => surname(a).localeCompare(surname(b), 'fr', { sensitivity: 'base' });

interface Props {
  election: Election;
  items: FactCheck[];
  /** '' : tous les candidats ; sinon, nom du candidat choisi. */
  selected: string;
  /** Texte du champ de recherche du fil : il s'applique aussi aux déclarations. */
  search?: string;
  /** Vrai pour une vérification d'un éditeur hors des organismes suivis. */
  isOutside?: (it: FactCheck) => boolean;
  onSelect: (name: string) => void;
  onOpen: (it: FactCheck) => void;
}

function Disclaimer({ election }: { election: Election }) {
  return (
    <p className="fineprint">
      Vérif ne choisit ni ne juge les déclarations : chaque organisme de vérification décide de ce qu'il vérifie,
      et le nombre de vérifications ne dit rien de la sincérité d'un candidat.
      {election.updated ? ` Liste des candidats déclarés mise à jour le ${longDate(election.updated)}.` : ''}
    </p>
  );
}

export function ElectionView({ election, items, selected, search = '', isOutside, onSelect, onOpen }: Props) {
  const [theme, setTheme] = useState('');
  // Changement de candidat : retour en haut de la zone qui défile.
  const top = useRef<HTMLElement>(null);
  useEffect(() => {
    let el = top.current?.parentElement ?? null;
    while (el && el.scrollHeight <= el.clientHeight) el = el.parentElement;
    el?.scrollTo({ top: 0 });
  }, [selected]);

  const names = useMemo(() => election.candidates.map((c) => c.name).sort(bySurname), [election]);
  // Tous les candidats, ou celui choisi ; une même déclaration vérifiée par plusieurs
  // organismes ne fait qu'une carte (« + 1 autre vérification »).
  const ofCandidate = useMemo(
    () => items.filter((it) => (selected ? it.candidate === selected : !!it.candidate && names.includes(it.candidate))),
    [items, selected, names],
  );
  // Seuls les thèmes réellement abordés sont proposés (sans décompte, comme le reste de la rubrique).
  const themes = useMemo(() => THEMES.filter((t) => ofCandidate.some((it) => it.theme === t)), [ofCandidate]);
  const activeTheme = themes.includes(theme) ? theme : '';
  const filtered = !!activeTheme || !!search.trim();
  const statements = useMemo(() => {
    const words = searchWords(search);
    return groupSimilar(
      ofCandidate
        .filter((it) => (!activeTheme || it.theme === activeTheme) && matchesSearch(it, words))
        .sort((a, b) => Date.parse(b.reviewDate) - Date.parse(a.reviewDate)),
    );
  }, [ofCandidate, activeTheme, search]);

  return (
    <section className="stack-10" ref={top}>
      <p className="intro">Ce que disent les candidats à la {election.name.toLowerCase()}, vérifié par les organismes de fact-checking.</p>
      <label className="picker">
        <span className="visually-hidden">Candidat</span>
        <select value={selected} onChange={(e) => onSelect(e.target.value)}>
          <option value="">Tous les candidats</option>
          {names.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
        <span className="picker-chevron" aria-hidden="true"><Chevron size={14} /></span>
      </label>
      {themes.length > 1 && (
        <label className="picker">
          <span className="visually-hidden">Thème</span>
          <select value={activeTheme} onChange={(e) => setTheme(e.target.value)}>
            <option value="">Tous les thèmes</option>
            {themes.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <span className="picker-chevron" aria-hidden="true"><Chevron size={14} /></span>
        </label>
      )}
      <p className="muted small">
        {selected ? `Déclarations de ${selected}` : 'Déclarations de tous les candidats'}
        {activeTheme ? ` · ${activeTheme}` : ''}
        {search.trim() ? ` · recherche « ${search.trim()} »` : ''}, de la plus récente à la plus ancienne.
      </p>
      {statements.length ? (
        statements.map((g) => <ClaimCard key={g.lead.id} item={g.lead} others={g.others} onOpen={onOpen} outside={isOutside?.(g.lead)} />)
      ) : (
        <p className="empty">
          {filtered
            ? 'Aucune déclaration ne correspond à ce thème ou à cette recherche.'
            : selected
            ? `Aucune déclaration de ${selected} n'a encore été vérifiée par les organismes suivis.`
            : "Aucune déclaration de candidat n'a encore été vérifiée par les organismes suivis."}
        </p>
      )}
      <Disclaimer election={election} />
    </section>
  );
}
