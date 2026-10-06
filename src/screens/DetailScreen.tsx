import { useEffect, useState } from 'react';
import type { FactCheck } from '../types';
import { cachedExplanation, cachedSummary, canFetchOnDevice, readArticleOnDevice } from '../lib/articleSummary';
import { longDate } from '../lib/format';
import { socialLabel } from '../data/social';
import { openArticle, shareCheck } from '../lib/native';
import { VerdictBadge } from '../components/VerdictBadge';
import { ClaimCard } from '../components/ClaimCard';
import { Back, Bookmark, External, ShareIcon } from '../components/Icons';
import { translateTexts } from '../lib/verifNative';

/** Texte affiché (traduit le cas échéant) et texte d'origine. */
interface Pair { shown: string; original: string }

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
  // Ce que l'article explique : son résumé d'aperçu et les passages qui justifient le verdict
  // (« Pourquoi ? »), lus une fois sur le téléphone puis gardés en cache. Pour une vérification
  // traduite, les textes (en anglais) sont traduits à la volée ; `original` garde la version d'origine.
  const [reading, setReading] = useState<{ summary: Pair | null; why: Pair[] }>({ summary: null, why: [] });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setShowOriginal(false);
    // Remis à zéro à chaque vérification : une lecture annulée (vérification quittée
    // avant la fin) ne doit pas laisser « Lecture de l'article… » affiché.
    setLoading(false);
    const translated = !!item.original;
    const feedSummary: Pair | null = item.summary
      ? { shown: item.summary, original: item.original?.summary || item.summary }
      : null;

    const show = async (summary: string | null, why: string[]) => {
      // Résumé déjà traduit par le fil : seuls les textes lus sur le téléphone restent à traduire.
      const toTranslate = [...(feedSummary ? [] : summary ? [summary] : []), ...why];
      let out = toTranslate;
      if (translated && toTranslate.length) {
        try { out = await translateTexts(toTranslate); } catch { out = toTranslate; }
      }
      if (cancelled) return;
      const offset = feedSummary || !summary ? 0 : 1;
      setReading({
        summary: feedSummary ?? (summary ? { shown: out[0] || summary, original: summary } : null),
        why: why.map((w, k) => ({ shown: out[offset + k] || w, original: w })),
      });
    };

    setReading({ summary: feedSummary, why: [] });
    const knownWhy = cachedExplanation(item.id);
    if (knownWhy !== undefined) {
      const known = cachedSummary(item.id);
      show(item.original?.summary || item.summary || known || null, knownWhy);
      return () => { cancelled = true; };
    }
    if (!canFetchOnDevice) return () => { cancelled = true; };
    setLoading(true);
    // L'article est lu dans sa langue : titre et résumé d'origine (pour écarter les répétitions).
    const source = item.original
      ? { ...item, title: item.original.title, summary: item.original.summary ?? null }
      : item;
    readArticleOnDevice(source).then((r) => {
      if (cancelled) return;
      setLoading(false);
      if (r) show(r.summary, r.why);
    });
    return () => { cancelled = true; };
  }, [item]);

  const orig = showOriginal ? item.original : undefined;
  const claim = orig?.claim ?? item.claim;
  const rating = orig?.rating ?? item.rating;
  const title = orig ? orig.title : item.title;
  const pick = (p: Pair) => (orig ? p.original : p.shown);
  const summaryText = reading.summary ? pick(reading.summary) : null;
  const why = reading.why.map(pick);

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
          <h2 className="section-title">Verdict de l'organisme</h2>
          <p className="panel-rating">{rating || 'Voir l’article'}</p>
          {title && <p className="panel-title">{title}</p>}
        </section>

        {(loading || why.length > 0) && (
          <section className="panel">
            <h2 className="section-title">Pourquoi ?</h2>
            {loading && <p className="muted small">Lecture de l'article…</p>}
            {why.length > 0 && (
              <>
                <ul className="why-list">
                  {why.map((w) => <li key={w}>{w}</li>)}
                </ul>
                <p className="fineprint">
                  Extraits de l'article de {item.publisher}{item.original && !orig ? ', traduits de l’anglais' : ''}.
                  Les preuves complètes (documents, images d'origine) sont dans l'article.
                </p>
              </>
            )}
          </section>
        )}

        {summaryText && (
          <section className="panel">
            <h2 className="section-title">Résumé de l'article</h2>
            <p className="panel-summary">{summaryText}</p>
            <p className="fineprint">Texte d'aperçu publié par {item.publisher} avec son article.</p>
          </section>
        )}

        {!loading && !why.length && (
          <p className="muted small">L'explication détaillée du verdict se trouve dans l'article complet ci-dessous.</p>
        )}

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
