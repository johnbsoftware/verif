import { useState } from 'react';
import type { Settings } from '../types';
import { THEMES } from '../config';
import { Inspect, ShareIcon } from '../components/Icons';
import { canPickImage } from '../lib/shareInbox';

// Présentation au premier lancement (et depuis Filtres → À propos) : à quoi sert Vérif,
// comment vérifier un post (la fonction la plus utile, invisible tant qu'on ne la connaît pas),
// puis le choix des thèmes et du rappel du matin.

interface Props {
  settings: Settings;
  onChange: (s: Settings) => void;
  onDigest: (on: boolean) => void;
  onDone: () => void;
}

const PAGES = 3;

export function IntroScreen({ settings, onChange, onDigest, onDone }: Props) {
  const [page, setPage] = useState(0);
  const themeOn = (t: string) => !settings.themes.length || settings.themes.includes(t);
  const toggleTheme = (t: string) => {
    const current = settings.themes.length ? settings.themes : THEMES;
    const next = current.includes(t) ? current.filter((x) => x !== t) : [...current, t];
    if (!next.length) return;
    onChange({ ...settings, themes: next.length === THEMES.length ? [] : next });
  };

  return (
    <div className="intro-screen" role="dialog" aria-modal="true" aria-label="Présentation de Vérif">
      <div className="intro-top">
        <span className="muted small">{page + 1} / {PAGES}</span>
        <button className="link-btn" onClick={onDone}>Passer</button>
      </div>

      <main className="intro-body">
        {page === 0 && (
          <section className="stack-14">
            <div className="intro-logo" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M6 12.5l4 4 8-9" /></svg>
            </div>
            <h1 className="intro-title">Le vrai du faux, chaque matin</h1>
            <p className="intro-text">
              Vérif rassemble les vérifications publiées par les organismes de fact-checking reconnus : AFP Factuel,
              Les Vérificateurs de TF1 Info, Fake Off de 20 Minutes, franceinfo…
            </p>
            <ul className="intro-list">
              <li><span className="badge badge-faux">Faux</span><span className="badge badge-trompeur">Trompeur</span><span className="badge badge-vrai">Vrai</span> : la conclusion de l'organisme, pas un avis de Vérif.</li>
              <li>Chaque carte cite sa source et renvoie vers l'article complet.</li>
              <li>Les vérifications en anglais sont traduites sur votre téléphone.</li>
            </ul>
          </section>
        )}

        {page === 1 && (
          <section className="stack-14">
            <div className="intro-logo" aria-hidden="true"><Inspect size={40} /></div>
            <h1 className="intro-title">Un post douteux ? Vérifiez-le</h1>
            <ol className="intro-steps">
              <li>Dans Facebook, TikTok, X ou WhatsApp, touchez <strong>Partager</strong> <ShareIcon size={16} /></li>
              <li>Choisissez <strong>Vérif</strong> dans la liste des applis</li>
              <li>Vérif cherche les vérifications qui en parlent, et lit le texte des images</li>
            </ol>
            <p className="intro-text">
              Une photo ? Partagez-la, ou faites une capture d'écran
              {canPickImage ? ' et choisissez-la dans l’onglet Vérifier' : ' et partagez-la vers Vérif'} :
              Google Lens retrouve où elle a déjà été publiée.
            </p>
            <p className="muted small">Astuce : la première fois, Vérif est parfois rangée sous « Plus » dans la liste de partage.</p>
          </section>
        )}

        {page === 2 && (
          <section className="stack-14">
            <h1 className="intro-title">Ce qui vous intéresse</h1>
            <p className="intro-text">Touchez les thèmes à suivre (tous par défaut). Modifiable à tout moment dans Filtres.</p>
            <div className="wrap">
              {THEMES.map((t) => (
                <button key={t} className={`chip${themeOn(t) ? ' chip-on' : ''}`} aria-pressed={themeOn(t)} onClick={() => toggleTheme(t)}>
                  {t}
                </button>
              ))}
            </div>
            <label className="group intro-digest">
              <span className="group-row tall">
                <span className="stack-2">
                  Rappel du matin
                  <span className="muted small">Une notification vers 7 h 30, seulement s'il y a du nouveau dans vos thèmes</span>
                </span>
                <input type="checkbox" checked={settings.dailyDigest} onChange={(e) => onDigest(e.target.checked)} />
              </span>
            </label>
          </section>
        )}
      </main>

      <div className="intro-foot">
        <div className="intro-dots" aria-hidden="true">
          {Array.from({ length: PAGES }, (_, i) => <span key={i} className={i === page ? 'on' : ''} />)}
        </div>
        <button className="primary" onClick={() => (page < PAGES - 1 ? setPage(page + 1) : onDone())}>
          {page < PAGES - 1 ? 'Suivant' : 'Commencer'}
        </button>
      </div>
    </div>
  );
}
