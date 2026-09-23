import type { Feed, Settings } from '../types';
import { THEMES } from '../config';
import { plural } from '../lib/format';
import { isFrench } from '../data/filters';

interface Props {
  feed: Feed | null;
  settings: Settings;
  allCountries: string[];
  onChange: (s: Settings) => void;
  onDigest: (on: boolean) => void;
  onDone: () => void;
}

function toggle(list: string[], value: string, universe: string[]): string[] {
  // Liste vide = tout. Décocher depuis « tout » part de l'univers complet.
  const current = list.length ? list : universe;
  const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
  if (next.length === 0) return list; // on garde au moins un élément coché
  return next.length === universe.length ? [] : next;
}

export function FiltersScreen({ feed, settings, allCountries, onChange, onDigest, onDone }: Props) {
  const countryOn = (c: string) => !settings.countries.length || settings.countries.includes(c);
  const themeOn = (t: string) => !settings.themes.length || settings.themes.includes(t);
  const englishCount = feed?.items.filter((i) => !isFrench(i)).length ?? 0;
  const countByCountry = (c: string) => feed?.items.filter((i) => i.country === c).length ?? 0;

  return (
    <div className="screen">
      <header className="page-head">
        <h1 className="brand brand-sm">Filtres</h1>
        <button className="link-btn" onClick={() => onChange({ ...settings, countries: [], themes: [], english: true })}>
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
                <span className="muted small">Notification chaque matin à 7 h 00</span>
              </span>
              <input type="checkbox" checked={settings.dailyDigest} onChange={(e) => onDigest(e.target.checked)} />
            </label>
          </div>
          <p className="muted small">
            Le flux est collecté automatiquement chaque matin
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
          </section>
        )}
      </main>

      <div className="footer-action">
        <button className="primary" onClick={onDone}>Afficher les vérifications</button>
      </div>
    </div>
  );
}
