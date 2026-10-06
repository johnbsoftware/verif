import { useEffect, useState } from 'react';
import { App as CapApp } from '@capacitor/app';
import type { Feed, Settings } from '../types';
import { CONTACT_EMAIL, PRIVACY_URL, SITE_URL, THEMES } from '../config';
import { isNative, openArticle } from '../lib/native';
import { External } from '../components/Icons';
import { plural, whenLabel } from '../lib/format';
import { remoteConfigured } from '../data/feed';
import { isFrench } from '../data/filters';
import type { TranslationStatus } from '../data/useTranslations';

interface Props {
  feed: Feed | null;
  settings: Settings;
  allCountries: string[];
  translation: { status: TranslationStatus; pending: number; retry: () => void };
  onChange: (s: Settings) => void;
  onDigest: (on: boolean) => void;
  onIntro: () => void;
  onSources: () => void;
  onDone: () => void;
}

function translationNote(on: boolean, t: { status: TranslationStatus; pending: number }): string {
  if (!on) return 'Les vérifications en anglais restent en anglais';
  if (t.status === 'download') return 'Téléchargement du traducteur (environ 30 Mo, une seule fois)…';
  if (t.status === 'working' && t.pending) return `Traduction en cours : encore ${t.pending}…`;
  if (t.status === 'error') return 'Traduction impossible pour l’instant (connexion nécessaire la première fois)';
  return 'Sur le téléphone, sans envoyer le texte. Touchez « Traduit » pour voir l’original';
}

function toggle(list: string[], value: string, universe: string[]): string[] {
  // Liste vide = tout. Décocher depuis « tout » part de l'univers complet.
  const current = list.length ? list : universe;
  const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
  if (next.length === 0) return list; // on garde au moins un élément coché
  return next.length === universe.length ? [] : next;
}

export function FiltersScreen({ feed, settings, allCountries, translation, onChange, onDigest, onIntro, onSources, onDone }: Props) {
  const [version, setVersion] = useState<string | null>(null);
  useEffect(() => {
    if (isNative) CapApp.getInfo().then((i) => setVersion(`${i.version} (${i.build})`)).catch(() => {});
  }, []);

  const countryOn = (c: string) => !settings.countries.length || settings.countries.includes(c);
  const themeOn = (t: string) => !settings.themes.length || settings.themes.includes(t);
  const englishCount = feed?.items.filter((i) => !isFrench(i)).length ?? 0;
  const countByCountry = (c: string) => feed?.items.filter((i) => i.country === c).length ?? 0;

  return (
    <div className="screen">
      <header className="page-head">
        <h1 className="brand brand-sm">Filtres</h1>
        <button className="link-btn" onClick={() => onChange({ ...settings, countries: [], themes: [], english: true, grouped: true })}>
          Réinitialiser
        </button>
      </header>

      <main className="list gap-24">
        <section className="stack-8">
          <h2 className="section-title">Pays et zones</h2>
          <div className="group">
            {allCountries.map((c) => (
              <label key={c} className="group-row">
                <span>
                  {c} <span className="muted small">· {countByCountry(c)}</span>
                </span>
                <input
                  type="checkbox"
                  checked={countryOn(c)}
                  onChange={() => onChange({ ...settings, countries: toggle(settings.countries, c, allCountries) })}
                />
              </label>
            ))}
          </div>
        </section>

        <section className="stack-8">
          <h2 className="section-title">Langue</h2>
          <div className="group">
            <label className="group-row tall">
              <span className="stack-2">
                Vérifications en anglais
                <span className="muted small">{englishCount} dans le fil, surtout de l’AFP internationale</span>
              </span>
              <input type="checkbox" checked={settings.english} onChange={(e) => onChange({ ...settings, english: e.target.checked })} />
            </label>
            {translation.status !== 'unavailable' && (
              <label className="group-row tall">
                <span className="stack-2">
                  Traduire en français
                  <span className="muted small">{translationNote(settings.translate, translation)}</span>
                </span>
                <input
                  type="checkbox"
                  checked={settings.translate}
                  disabled={!settings.english}
                  onChange={(e) => onChange({ ...settings, translate: e.target.checked })}
                />
              </label>
            )}
          </div>
          {settings.translate && translation.status === 'error' && (
            <button className="link-btn" onClick={translation.retry}>Réessayer la traduction</button>
          )}
        </section>

        <section className="stack-8">
          <h2 className="section-title">Affichage</h2>
          <div className="segments segments-box" role="radiogroup" aria-label="Apparence">
            {([['system', 'Système'], ['light', 'Clair'], ['dark', 'Sombre']] as const).map(([v, label]) => (
              <button
                key={v}
                role="radio"
                aria-checked={settings.theme === v}
                className={`segment${settings.theme === v ? ' segment-on' : ''}`}
                onClick={() => onChange({ ...settings, theme: v })}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="group">
            <label className="group-row tall">
              <span className="stack-2">
                Regrouper par sujet
                <span className="muted small">Une seule carte quand plusieurs vérifications portent sur la même affirmation</span>
              </span>
              <input type="checkbox" checked={settings.grouped} onChange={(e) => onChange({ ...settings, grouped: e.target.checked })} />
            </label>
          </div>
        </section>

        <section className="stack-10">
          <h2 className="section-title">Thèmes suivis</h2>
          <div className="wrap">
            {THEMES.map((t) => (
              <button
                key={t}
                className={`chip${themeOn(t) ? ' chip-on' : ''}`}
                aria-pressed={themeOn(t)}
                onClick={() => onChange({ ...settings, themes: toggle(settings.themes, t, THEMES) })}
              >
                {t}
              </button>
            ))}
          </div>
        </section>

        <section className="stack-8">
          <h2 className="section-title">Mise à jour</h2>
          <div className="group">
            <label className="group-row tall">
              <span className="stack-2">
                Rappel quotidien
                <span className="muted small">
                  Vers 7 h 30, seulement s'il y a de nouvelles vérifications dans vos pays et thèmes
                </span>
              </span>
              <input type="checkbox" checked={settings.dailyDigest} onChange={(e) => onDigest(e.target.checked)} />
            </label>
          </div>
          <p className="muted small">
            {remoteConfigured()
              ? 'Le flux est collecté automatiquement chaque matin'
              : `Données collectées ${feed ? whenLabel(feed.generatedAt) : ''} et intégrées à l'appli (mise à jour automatique pas encore en place)`}
            {feed ? ` — ${plural(feed.items.length, 'vérification', 'vérifications')} sur ${feed.keepDays ?? 60} jours.` : '.'}
          </p>
        </section>

        {feed && (
          <section className="stack-8">
            <h2 className="section-title">Sources</h2>
            <div className="group">
              {feed.sources.map((s) => (
                <div key={s.site} className="group-row">
                  <span className="stack-2">
                    {s.name}
                    <span className="muted small">{s.country} · {s.site}</span>
                  </span>
                  <span className="muted small">{s.total}</span>
                </div>
              ))}
            </div>
            <p className="muted small">Données : Google Fact Check Tools (ClaimReview).</p>
            <button className="link-btn" onClick={onSources}>Pourquoi ces sources ? Qui dit qu'elles sont fiables ?</button>
          </section>
        )}

        <section className="stack-8" id="contact">
          <h2 className="section-title">Nous contacter</h2>
          <div className="group">
            <a className="group-row about-row" href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Vérif')}`}>
              <span className="stack-2">
                E-mail
                <span className="muted small">{CONTACT_EMAIL}</span>
              </span>
              <External />
            </a>
            <button className="group-row about-row" onClick={() => openArticle(SITE_URL)}>
              <span className="stack-2">
                Site web
                <span className="muted small">{SITE_URL.replace(/^https:\/\//, '')}</span>
              </span>
              <External />
            </button>
          </div>
          <p className="muted small">
            Éditeur : JohnB Software. Vérif rassemble les vérifications publiées par les organismes listés dans « Sources » ;
            chacune renvoie vers l'article original de son auteur.
          </p>
        </section>

        <section className="stack-8">
          <h2 className="section-title">À propos</h2>
          <div className="group">
            <button className="group-row about-row" onClick={onIntro}>
              <span>Revoir la présentation</span>
            </button>
            <button className="group-row about-row" onClick={() => openArticle(PRIVACY_URL)}>
              <span className="stack-2">
                Confidentialité
                <span className="muted small">Vérif ne collecte aucune donnée personnelle</span>
              </span>
              <External />
            </button>
            {version && (
              <div className="group-row">
                <span>Version</span>
                <span className="muted small">{version}</span>
              </div>
            )}
          </div>
        </section>
      </main>

      <div className="footer-action">
        <button className="primary" onClick={onDone}>Afficher les vérifications</button>
      </div>
    </div>
  );
}
