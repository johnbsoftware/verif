import { useEffect, useState } from 'react';
import type { FactCheck } from '../types';
import { cachedSummary, canFetchOnDevice, fetchSummaryOnDevice } from '../lib/articleSummary';
import { longDate } from '../lib/format';
import { socialLabel } from '../data/social';
import { openArticle, shareCheck } from '../lib/native';
import { VerdictBadge } from '../components/VerdictBadge';
import { ClaimCard } from '../components/ClaimCard';
import { Back, Bookmark, External, ShareIcon } from '../components/Icons';

interface Props {
  related?: FactCheck[];
  onOpen?: (it: FactCheck) => void;
  item: FactCheck;
  saved: boolean;
  onBack: () => void;
  onToggleSave: (it: FactCheck) => void;
}

export function DetailScreen({ item, saved, onBack, onToggleSave, related = [], onOpen }: Props) {
  // Résumé : celui de la collecte, sinon celui déjà lu sur ce téléphone, sinon lecture de l'article.
  const initial = item.summary || cachedSummary(item.id) || null;
  const [summary, setSummary] = useState<string | null>(initial);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const known = item.summary || cachedSummary(item.id);
    setSummary(known || null);
    if (known !== undefined && known !== null) return; // déjà connu (ou déjà essayé sans succès : '')
    if (!canFetchOnDevice) return;
    let cancelled = false;
    setLoading(true);
    fetchSummaryOnDevice(item).then((s) => {
      if (!cancelled) {
        setSummary(s);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [item]);

  return (
    <div className="screen detail" key={item.id}>
      <header className="detail-head">
        <button className="back" onClick={onBack} aria-label="Retour">
          <Back /> Retour
        </button>
        <div className="row">
          <button className="icon-btn" onClick={() => onToggleSave(item)} aria-label={saved ? 'Retirer des enregistrés' : 'Enregistrer'} aria-pressed={saved}>
            <Bookmark size={20} filled={saved} />
          </button>
          <button className="icon-btn" onClick={() => shareCheck(item)} aria-label="Partager">
            <ShareIcon />
          </button>
        </div>
      </header>

      <main className="detail-body">
        <div className="stack-14">
          <div className="row gap-10">
            <VerdictBadge verdict={item.verdict} large />
            <span className="muted small">
              {item.theme === item.country ? item.country : `${item.country} · ${item.theme}`}
              {socialLabel(item) ? ` · ${socialLabel(item)}` : ''}
            </span>
          </div>
          <h1 className="detail-claim">« {item.claim} »</h1>
          <p className="muted small">
            {item.claimant ? `Affirmation de : ${item.claimant}` : 'Auteur de l’affirmation non précisé'}
            {item.claimDate ? ` · ${longDate(item.claimDate)}` : ''}
          </p>
        </div>

        <section className="panel">
          <h2 className="section-title">Conclusion du vérificateur</h2>
          <p className="panel-rating">{item.rating || 'Voir l’article'}</p>
          {item.title && <p className="panel-title">{item.title}</p>}
          {loading && <p className="muted small">Lecture du résumé de l'article…</p>}
          {summary && (
            <>
              <p className="panel-summary">{summary}</p>
              <p className="fineprint">Résumé publié par {item.publisher} avec son article.</p>
            </>
          )}
        </section>

        <section className="source">
          <h2 className="section-title">Vérifié par</h2>
          <div className="stack-2">
            <span className="source-name">{item.publisher}</span>
            <span className="muted small">Publié le {longDate(item.reviewDate)} · {item.site}</span>
          </div>
          <button className="primary" onClick={() => openArticle(item.url)}>
            Lire la vérification complète <External />
          </button>
          <p className="fineprint">
            Vérif ne juge pas elle-même : chaque verdict provient de l’organisme cité, recensé par Google Fact Check Tools.
            Le classement Faux / Trompeur / Vrai est une traduction automatique de sa conclusion.
          </p>
        </section>
        {related.length > 0 && onOpen && (
          <section className="stack-10">
            <h2 className="section-title">Sur le même sujet · {related.length}</h2>
            {related.map((r) => (
              <ClaimCard key={r.id} item={r} onOpen={onOpen} />
            ))}
          </section>
        )}
      </main>
    </div>
  );
}
