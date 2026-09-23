import { useMemo, useState } from 'react';
import type { FactCheck, Feed, Settings } from '../types';
import { applyFilters, countriesLabel, groupByDay, type VerdictFilter } from '../data/filters';
import { plural, todayLabel, whenLabel } from '../lib/format';
import { remoteConfigured } from '../data/feed';
import { ClaimCard } from '../components/ClaimCard';
import { Chevron, Close, Globe, People, Refresh, Search } from '../components/Icons';
import { socialOf } from '../data/social';
import { groupSimilar } from '../data/groups';
import { THEMES } from '../config';

const VERDICTS: { id: VerdictFilter; label: string }[] = [
  { id: 'tous', label: 'Tous' },
  { id: 'faux', label: 'Faux' },
  { id: 'trompeur', label: 'Trompeur' },
  { id: 'vrai', label: 'Vrai' },
];

interface Props {
  feed: Feed | null;
  settings: Settings;
  allCountries: string[];
  loading: boolean;
  notice: string | null;
  onOpen: (it: FactCheck) => void;
  onOpenFilters: () => void;
  onRefresh: () => void;
}

export function FeedScreen({ feed, settings, allCountries, loading, notice, onOpen, onOpenFilters, onRefresh }: Props) {
  const [theme, setTheme] = useState('Tout');
  const [verdict, setVerdict] = useState<VerdictFilter>('tous');
  const [search, setSearch] = useState('');
  const [socialOnly, setSocialOnly] = useState(false);

  const themeChips = ['Tout', ...(settings.themes.length ? THEMES.filter((t) => settings.themes.includes(t)) : THEMES)];
  const activeTheme = themeChips.includes(theme) ? theme : 'Tout';

  const items = useMemo(
    () =>
      applyFilters(feed?.items ?? [], { settings, theme: activeTheme, verdict, search }).filter(
        (it) => !socialOnly || socialOf(it).social,
      ),
    [feed, settings, activeTheme, verdict, search, socialOnly],
  );
  // Regroupement par sujet : une carte (la vérification « de tête ») par affirmation.
  const subjects = useMemo(
    () => (settings.grouped ? groupSimilar(items) : items.map((it) => ({ lead: it, others: [] as FactCheck[] }))),
    [items, settings.grouped],
  );
  const othersOf = useMemo(() => new Map(subjects.map((g) => [g.lead.id, g.others])), [subjects]);
  const groups = useMemo(
    () => groupByDay(subjects.map((g) => g.lead).sort((a, b) => Date.parse(b.reviewDate) - Date.parse(a.reviewDate))),
    [subjects],
  );

  return (
    <div className="screen">
      <header className="feed-head">
        <div className="feed-title-row">
          <div className="stack-2">
            <span className="muted small">{todayLabel()}</span>
            <h1 className="brand">Vérif</h1>
          </div>
          <button className="pill" onClick={onOpenFilters} aria-label="Pays et filtres">
            <Globe />
            {countriesLabel(settings.countries, allCountries)}
            <Chevron />
          </button>
        </div>
        <label className="search">
          <Search />
          <input
            type="search"
            placeholder="Rechercher une affirmation, un sujet…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            enterKeyHint="search"
          />
          {search && (
            <button className="icon-btn" aria-label="Effacer la recherche" onClick={() => setSearch('')}>
              <Close />
            </button>
          )}
        </label>
      </header>

      <nav className="chips" aria-label="Thèmes">
        <button className={`chip chip-social${socialOnly ? ' chip-on' : ''}`} aria-pressed={socialOnly} onClick={() => setSocialOnly(!socialOnly)}>
          <People size={16} /> Réseaux sociaux
        </button>
        <span className="chips-sep" aria-hidden="true" />
        {themeChips.map((t) => (
          <button key={t} className={`chip${activeTheme === t ? ' chip-on' : ''}`} aria-pressed={activeTheme === t} onClick={() => setTheme(t)}>
            {t}
          </button>
        ))}
      </nav>

      <div className="segments" role="tablist" aria-label="Verdict">
        {VERDICTS.map((v) => (
          <button key={v.id} role="tab" aria-selected={verdict === v.id} className={`segment${verdict === v.id ? ' segment-on' : ''}`} onClick={() => setVerdict(v.id)}>
            {v.label}
          </button>
        ))}
      </div>

      <main className="list">
        {feed?.demo && (
          <p className="banner">Données de démonstration. Les vraies vérifications apparaîtront une fois le flux quotidien configuré.</p>
        )}
        {notice && <p className="banner banner-soft">{notice}</p>}
        <div className="list-status">
          <span>
            {feed ? `${settings.grouped && subjects.length < items.length ? `${plural(subjects.length, 'sujet', 'sujets')} (${items.length} vérif.)` : plural(items.length, 'vérification', 'vérifications')} · données ${remoteConfigured() ? 'mises à jour' : 'collectées'} ${whenLabel(feed.generatedAt)}` : 'Chargement…'}
          </span>
          {remoteConfigured() && (
            <button className="link-btn" onClick={onRefresh} disabled={loading} aria-label="Actualiser">
              <Refresh /> {loading ? 'Actualisation…' : 'Actualiser'}
            </button>
          )}
        </div>

        {groups.map((g) => (
          <section key={g.label} className="day">
            <h2 className="day-title">{g.label}</h2>
            {g.items.map((it) => (
              <ClaimCard key={it.id} item={it} onOpen={onOpen} others={othersOf.get(it.id)} />
            ))}
          </section>
        ))}

        {feed && items.length === 0 && (
          <p className="empty">Aucune vérification pour ces filtres.</p>
        )}
      </main>
    </div>
  );
}
