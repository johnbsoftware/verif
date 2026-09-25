import { useEffect, useMemo, useRef } from 'react';
import type { Election, FactCheck } from '../types';
import { ClaimCard } from '../components/ClaimCard';
import { Back, Chevron } from '../components/Icons';
import { longDate } from '../lib/format';
import { groupSimilar } from '../data/groups';

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
  /** '' : liste des candidats ; sinon, nom du candidat affiché. */
  selected: string;
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

export function ElectionView({ election, items, selected, onSelect, onOpen }: Props) {
  // Changement de page (liste ↔ candidat) : retour en haut de la zone qui défile.
  const top = useRef<HTMLElement>(null);
  useEffect(() => {
    let el = top.current?.parentElement ?? null;
    while (el && el.scrollHeight <= el.clientHeight) el = el.parentElement;
    el?.scrollTo({ top: 0 });
  }, [selected]);

  const names = useMemo(() => election.candidates.map((c) => c.name).sort(bySurname), [election]);
  // Une même déclaration vérifiée par plusieurs organismes : une seule carte (« + 1 autre vérification »).
  const statements = useMemo(
    () => groupSimilar(items.filter((it) => it.candidate === selected).sort((a, b) => Date.parse(b.reviewDate) - Date.parse(a.reviewDate))),
    [items, selected],
  );

  if (selected) {
    return (
      <section className="stack-10" ref={top}>
        <button className="link-btn" onClick={() => onSelect('')}>
          <Back size={18} /> Tous les candidats
        </button>
        <h2 className="candidate-name">{selected}</h2>
        <p className="muted small">Déclarations vérifiées par les organismes de fact-checking, de la plus récente à la plus ancienne.</p>
        {statements.length ? (
          statements.map((g) => <ClaimCard key={g.lead.id} item={g.lead} others={g.others} onOpen={onOpen} />)
        ) : (
          <p className="empty">Aucune déclaration de {selected} n'a encore été vérifiée par les organismes suivis.</p>
        )}
        <Disclaimer election={election} />
      </section>
    );
  }

  return (
    <section className="stack-10" ref={top}>
      <p className="intro">
        Ce que disent les candidats à la {election.name.toLowerCase()}, vérifié par les organismes de fact-checking.
        Touchez un nom pour voir ses déclarations vérifiées.
      </p>
      <div className="group">
        {names.map((n) => (
          <button key={n} className="group-row about-row" onClick={() => onSelect(n)}>
            <span>{n}</span>
            <span className="chevron-right" aria-hidden="true"><Chevron /></span>
          </button>
        ))}
      </div>
      <Disclaimer election={election} />
    </section>
  );
}
