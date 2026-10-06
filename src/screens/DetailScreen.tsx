import { useEffect, useState } from 'react';
import type { FactCheck } from '../types';
import { cachedSummary, canFetchOnDevice, fetchSummaryOnDevice } from '../lib/articleSummary';
import { longDate } from '../lib/format';
import { socialLabel } from '../data/social';
import { openArticle, shareCheck } from '../lib/native';
import { VerdictBadge } from '../components/VerdictBadge';
import { ClaimCard } from '../components/ClaimCard';
import { Back, Bookmark, External, ShareIcon } from '../components/Icons';
import { translateTexts } from '../lib/verifNative';

interface Props {
  related?: FactCheck[];
  onOpen?: (it: FactCheck) => void;
  item: FactCheck;
  saved: boolean;
  onBack: () => void;
  /** « Retour » vers la liste, ou « Précédent » après « Sur le même sujet ». */
  backLabel?: string;
  onToggleSave: (it: FactCheck) => void;
  onSources?: () => void;
}

export function DetailScreen({ item, saved, onBack, backLabel = 'Retour', onToggleSave, related = [], onOpen, onSources }: Props) {
  // Vérification traduite : la pastille bascule vers le texte d'origine.
  const [showOriginal, setShowOriginal] = useState(false);
  // Résumé : celui de la collecte, sinon celui déjà lu sur ce téléphone, sinon lecture de l'article.
  // Pour une vérification traduite, le résumé lu sur le téléphone (en anglais) est traduit à la volée.
  const [summary, setSummary] = useState<{ shown: string; original: string } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setShowOriginal(false);
    // Remis à zéro à chaque vérification : une lecture annulée (vérification quittée
    // avant la fin) ne doit pas laisser « Lecture du résumé… » affiché.
    setLoading(false);
    const finish = async (orig: string | null) => {
      if (!orig) return setSummary(null);
      if (!item.original) return setSummary({ shown: orig, original: orig });
      try {
        const [t] = await translateTexts([orig]);
        if (!cancelled) setSummary({ shown: t || orig, original: orig });
      } catch {
        if (!cancelled) setSummary({ shown: orig, original: orig });
      }
    };
    if (item.summary) {
      setSummary({ shown: item.summary, original: item.original?.summary || item.summary });
      return () => { cancelled = true; };
    }
    setSummary(null);
    const known = cachedSummary(item.id); // '' = déjà essayé sans succès
    if (known !== undefined) {
      finish(known || null);
      return () => { cancelled = true; };
    }
    if (!canFetchOnDevice) return;
    setLoading(true);
    // Le titre d'origine sert à écarter un résumé qui ne ferait que le répéter.
    const source = item.original ? { ...item, title: item.original.title } : item;
    fetchSummaryOnDevice(source).then((s) => {
      if (cancelled) return;
      setLoading(false);
      finish(s);
    });
    return () => { cancelled = true; };
  }, [item]);

  const orig = showOriginal ? item.original : undefined;
  const claim = orig?.claim ?? item.claim;
  const rating = orig?.rating ?? item.rating;
  const title = orig ? orig.title : item.title;
  const summaryText = summary ? (orig ? summary.original : summary.shown) : null;

  return (
    <div className="screen detail" key={item.id}>
      <header className="detail-head">
        <button className="back" onClick={onBack} aria-label={backLabel}>
          <Back /> {backLabel}
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
          {item.original && (
            <button className="translated-pill" onClick={() => setShowOriginal(!showOriginal)} aria-pressed={showOriginal}>
              {showOriginal ? 'Texte original (anglais) · Voir la traduction' : 'Traduit de l’anglais · Voir l’original'}
            </button>
          )}
          <h1 className="detail-claim">« {claim} »</h1>
          <p className="muted small">
            {item.claimant ? `Affirmation de : ${item.claimant}` : 'Auteur de l’affirmation non précisé'}
            {item.claimDate ? ` · ${longDate(item.claimDate)}` : ''}
          </p>
        </div>

        <section className="panel">
          <h2 className="section-title">Conclusion du vérificateur</h2>
          <p className="panel-rating">{rating || 'Voir l’article'}</p>
          {title && <p className="panel-title">{title}</p>}
          {loading && <p className="muted small">Lecture du résumé de l'article…</p>}
          {summaryText && (
            <>
              <p className="panel-summary">{summaryText}</p>
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
          {onSources && <button className="link-btn" onClick={onSources}>Pourquoi ces sources ?</button>}
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
