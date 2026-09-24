import { useEffect, useMemo, useState } from 'react';
import type { FactCheck, Feed } from '../types';
import type { SharedContent } from '../lib/shareInbox';
import { downloadImage, localImageSrc, readImageText, searchImageWithLens } from '../lib/shareInbox';
import { openArticle } from '../lib/native';
import { lensUrlFor, previewAvailable, previewLink, type LinkPreview } from '../lib/linkPreview';
import { cleanOcrText, extractUrls, factCheckExplorerUrl, findMatches, suggestedQuery, webSearchUrl } from '../data/match';
import { ClaimCard } from '../components/ClaimCard';
import { Close, External, Search } from '../components/Icons';

interface Props {
  feed: Feed | null;
  shared: SharedContent | null;
  onClearShared: () => void;
  onOpen: (it: FactCheck) => void;
}

const hostOf = (u: string) => {
  try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; }
};

export function CheckScreen({ feed, shared, onClearShared, onOpen }: Props) {
  const sharedText = [shared?.subject, shared?.text].filter(Boolean).join(' ');
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [lensError, setLensError] = useState<string | null>(null);
  const [preview, setPreview] = useState<LinkPreview | null>(null);
  /** Image du post téléchargée sur le téléphone (lecture du texte, Google Lens). */
  const [previewPath, setPreviewPath] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [ocr, setOcr] = useState<'idle' | 'reading' | 'found' | 'empty' | 'failed'>('idle');

  const links = extractUrls(sharedText);
  const onlyLink = !!links.length && !suggestedQuery(sharedText);
  const isFacebook = links.some((l) => /facebook\.com|fb\.watch|fb\.me/.test(l));

  // Nouveau partage : on préremplit et on lance la recherche aussitôt.
  // Image (partagée ou derrière le lien) : on lit le texte écrit dessus, souvent le seul contenu
  // du post (« Macron a offert 5 milliards… »). Lien seul : on lit aussi le texte du post.
  useEffect(() => {
    let cancelled = false;
    const q = suggestedQuery(sharedText);
    setQuery(q);
    setSubmitted(q);
    setLensError(null);
    setPreview(null);
    setPreviewPath(null);
    setOcr('idle');

    const readImage = async (path: string, caption = '') => {
      setOcr('reading');
      const raw = await readImageText(path);
      if (cancelled) return;
      if (raw === null) {
        setOcr('failed');
        return;
      }
      const text = cleanOcrText(raw);
      if (text.length >= 12) {
        // Texte de l'image d'abord (c'est l'affirmation), puis la légende du post s'il y en a une.
        const full = caption && !text.includes(caption) ? `${text} ${caption}` : text;
        setQuery(full);
        setSubmitted(full);
        setOcr('found');
      } else {
        setOcr('empty');
      }
    };

    if (shared?.imagePath && !q) readImage(shared.imagePath);
    if (onlyLink && previewAvailable) {
      setReading(true);
      (async () => {
        const p = await previewLink(links[0]);
        if (cancelled) return;
        setPreview(p);
        const caption = p?.text ? suggestedQuery(p.text) : '';
        if (caption) {
          setQuery(caption);
          setSubmitted(caption);
        }
        setReading(false);
        if (p?.imageUrl && !shared?.imagePath) {
          const path = await downloadImage(p.imageUrl);
          if (cancelled || !path) return;
          setPreviewPath(path);
          await readImage(path, caption);
        }
      })().finally(() => !cancelled && setReading(false));
    }
    return () => { cancelled = true; };
  }, [shared]); // eslint-disable-line react-hooks/exhaustive-deps

  const readFailed = onlyLink && !reading && !preview?.text && ocr !== 'found' && ocr !== 'reading';
  const matches = useMemo(() => (submitted ? findMatches(submitted, feed?.items ?? []) : []), [submitted, feed]);

  const lens = async () => {
    const path = shared?.imagePath ?? previewPath;
    if (!path) return;
    try {
      setLensError(null);
      await searchImageWithLens(path);
    } catch {
      setLensError("Impossible d'ouvrir Google Lens sur ce téléphone.");
    }
  };

  const ocrNote = (
    <>
      {ocr === 'reading' && <p className="muted small">Lecture du texte de l'image…</p>}
      {ocr === 'found' && <p className="muted small">Texte lu sur l'image : il a été placé ci-dessous, corrigez-le si besoin.</p>}
      {ocr === 'failed' && (
        <p className="muted small">
          Lecture du texte indisponible pour l'instant (le module de lecture est peut-être encore en cours de téléchargement
          par Google Play). Réessayez dans quelques minutes, ou tapez le texte ci-dessous.
        </p>
      )}
      {ocr === 'empty' && <p className="muted small">Pas de texte lisible sur cette image : décrivez-la en quelques mots ci-dessous.</p>}
    </>
  );

  return (
    <div className="screen">
      <header className="page-head">
        <h1 className="brand brand-sm">Vérifier</h1>
        {shared && (
          <button className="link-btn" onClick={onClearShared}>
            <Close /> Effacer
          </button>
        )}
      </header>

      <main className="list gap-20">
        {!shared && (
          <p className="intro">
            Un post vous paraît douteux ? Dans Facebook, TikTok, X ou WhatsApp, touchez <strong>Partager</strong> puis <strong>Vérif</strong>.
            Vous pouvez aussi coller son texte ci-dessous.
          </p>
        )}

        {shared?.imagePath && (
          <section className="panel">
            <img className="shared-img" src={localImageSrc(shared.imagePath)} alt="Image partagée" />
            {ocrNote}
            <button className="primary" onClick={lens}>
              Rechercher cette image avec Google Lens <External />
            </button>
            <p className="fineprint">
              Lens retrouve où l'image a déjà été publiée : c'est le meilleur moyen de repérer une vieille photo présentée comme récente,
              ou une image générée par IA. Une capture d'écran du post fonctionne aussi.
            </p>
            {lensError && <p className="banner banner-soft">{lensError}</p>}
          </section>
        )}

        {links.length > 0 && (
          <p className="muted small">
            Lien partagé : {links.map(hostOf).join(', ')}
            {reading && ' — lecture du post…'}
            {preview?.text && ocr !== 'found' && ' — texte du post récupéré ci-dessous.'}
          </p>
        )}

        {preview?.imageUrl && !shared?.imagePath && (
          <section className="panel">
            <img
              className="shared-img"
              src={previewPath ? localImageSrc(previewPath) : preview.imageUrl}
              alt="Image du post"
              referrerPolicy="no-referrer"
            />
            {ocrNote}
            <button className="primary" onClick={() => (previewPath ? lens() : openArticle(lensUrlFor(preview.imageUrl!)))}>
              Rechercher cette image avec Google Lens <External />
            </button>
            {lensError && <p className="banner banner-soft">{lensError}</p>}
          </section>
        )}

        {readFailed && (
          <div className="banner banner-soft">
            {isFacebook ? (
              <>
                Facebook partage seulement le <strong>lien</strong> du post, sans le texte ni l'image, et ne laisse pas les lire sans compte.
                Pour vérifier une <strong>photo</strong> : faites une <strong>capture d'écran</strong> du post (ou « Enregistrer la photo »),
                puis partagez-la vers Vérif depuis votre galerie. Pour le <strong>texte</strong> : tapez quelques mots-clés ci-dessous.
              </>
            ) : (
              <>
                Le texte du post n'a pas pu être lu depuis le lien. Tapez quelques mots-clés ci-dessous, ou partagez une capture d'écran.
              </>
            )}
          </div>
        )}

        <form
          className="stack-10"
          onSubmit={(e) => {
            e.preventDefault();
            setSubmitted(query.trim());
          }}
        >
          <label className="stack-8">
            <span className="section-title">Ce que dit le post</span>
            <textarea
              className="query"
              rows={3}
              placeholder="Ex. : vidéo d'un éléphant qui sauve un homme pendant les inondations au Népal"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <button className="secondary" type="submit" disabled={!query.trim()}>
            <Search /> Chercher dans Vérif
          </button>
        </form>

        {submitted && (
          <section className="stack-10">
            <h2 className="section-title">Dans les vérifications récentes</h2>
            {matches.length ? (
              matches.map((m) => <ClaimCard key={m.item.id} item={m.item} onOpen={onOpen} />)
            ) : (
              <p className="muted">Aucune vérification des {feed?.keepDays ?? 60} derniers jours ne correspond.</p>
            )}
          </section>
        )}

        {submitted && (
          <section className="stack-10">
            <h2 className="section-title">Chercher plus loin</h2>
            <button className="secondary" onClick={() => openArticle(factCheckExplorerUrl(submitted))}>
              Google Fact Check Explorer <External />
            </button>
            <p className="muted small">Toutes les vérifications publiées dans le monde depuis des années.</p>
            <button className="secondary" onClick={() => openArticle(webSearchUrl(submitted))}>
              Recherche Google <External />
            </button>
          </section>
        )}

        <section className="panel">
          <h2 className="section-title">Les bons réflexes</h2>
          <ul className="tips">
            <li><strong>Qui publie ?</strong> Un compte anonyme ou tout récent mérite de la méfiance.</li>
            <li><strong>De quand date l'image ?</strong> Beaucoup de fausses infos sont de vraies images sorties de leur contexte.</li>
            <li><strong>Un média sérieux en parle-t-il ?</strong> Une info importante est toujours reprise ailleurs.</li>
            <li><strong>Ça vous met en colère ?</strong> C'est souvent le but : prenez le temps avant de partager.</li>
          </ul>
          <p className="fineprint">
            Aucun résultat ne veut pas dire « vrai » : le contenu n'a peut-être pas encore été vérifié.
          </p>
        </section>
      </main>
    </div>
  );
}
