import { useDeferredValue, useMemo, useState } from 'react';
import type { FactCheck, Feed, Settings } from '../types';
import { applyFilters, countriesLabel, groupByDay, type VerdictFilter } from '../data/filters';
import { plural, todayLabel, whenLabel } from '../lib/format';
import { isStale, remoteConfigured } from '../data/feed';
import { ClaimCard } from '../components/ClaimCard';
import { Chevron, Close, Globe, People, Refresh, Search } from '../components/Icons';
import { socialOf } from '../data/social';
import { groupSimilar } from '../data/groups';
import { THEMES } from '../config';
import { ElectionView } from './ElectionView';

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
  /** Vérifications arrivées avec la dernière collecte (repère « Nouveau »). */
  freshIds: Set<string>;
  /** Rubrique Présidentielle : null = fermée, '' = tous les candidats, sinon le candidat choisi. */
  election: string | null;
  onElection: (v: string | null) => void;
  onOpen: (it: FactCheck) => void;
  onOpenFilters: () => void;
  onRefresh: () => void;
}

export function FeedScreen({ feed, settings, allCountries, loading, notice, freshIds, election, onElection, onOpen, onOpenFilters, onRefresh }: Props) {
  const [theme, setTheme] = useState('Tout');
  const [verdict, setVerdict] = useState<VerdictFilter>('tous');
  const [search, setSearch] = useState('');
  const [socialOnly, setSocialOnly] = useState(false);
  // Le filtrage et le regroupement suivent la frappe sans la ralentir : React les recalcule
  // en arrière-plan, le champ de recherche reste fluide.
  const deferredSearch = useDeferredValue(search);

  const themeChips = ['Tout', ...(settings.themes.length ? THEMES.filter((t) => settings.themes.includes(t)) : THEMES)];
  const activeTheme = themeChips.includes(theme) ? theme : 'Tout';

  // Le fil couvre keepDays (60 jours) ; les déclarations plus anciennes des candidats
  // ne se voient que dans la rubrique Présidentielle.
  const recent = useMemo(() => {
    if (!feed) return [];
    const since = Date.parse(feed.generatedAt) - (feed.keepDays ?? 60) * 86_400_000;
    return feed.items.filter((it) => !it.candidate || Date.parse(it.reviewDate) >= since);
  }, [feed]);
  const hasElection = !!feed?.election?.candidates.length;
  const inElection = hasElection && election !== null;

  const items = useMemo(
    () =>
      applyFilters(recent, { settings, theme: activeTheme, verdict, search: deferredSearch }).filter(
        (it) => !socialOnly || socialOf(it).social,
      ),
    [recent, settings, activeTheme, verdict, deferredSearch, socialOnly],
  );
  // Regroupement par sujet : une carte (la vérification « de tête ») par affirmation.
  const subjects = useMemo(
    () => (settings.grouped ? groupSimilar(items) : items.map((it) => ({ lead: it, others: [] as FactCheck[] }))),
    [items, settings.grouped],
  );
  const othersOf = useMemo(() => new Map(subjects.map((g) => [g.lead.id, g.others])), [subjects]);
  // Un sujet est « nouveau » si l'une de ses vérifications l'est.
  const freshCount = useMemo(
    () => subjects.filter((g) => freshIds.has(g.lead.id) || g.others.some((o) => freshIds.has(o.id))).length,
    [subjects, freshIds],
  );
  const isFresh = (it: FactCheck) => freshIds.has(it.id) || (othersOf.get(it.id) ?? []).some((o) => freshIds.has(o.id));
  const stale = isStale(feed);

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
        {hasElection && (
          <button className={`chip${inElection ? ' chip-on' : ''}`} aria-pressed={inElection} onClick={() => onElection(inElection ? null : '')}>
            {feed!.election!.name}
          </button>
        )}
        <span className="chips-sep" aria-hidden="true" />
        {themeChips.map((t) => (
          <button
            key={t}
            className={`chip${!inElection && activeTheme === t ? ' chip-on' : ''}`}
            aria-pressed={!inElection && activeTheme === t}
            onClick={() => { setTheme(t); onElection(null); }}
          >
            {t}
          </button>
        ))}
      </nav>

      {!inElection && (
      <div className="segments" role="tablist" aria-label="Verdict">
        {VERDICTS.map((v) => (
          <button key={v.id} role="tab" aria-selected={verdict === v.id} className={`segment${verdict === v.id ? ' segment-on' : ''}`} onClick={() => setVerdict(v.id)}>
            {v.label}
          </button>
        ))}
      </div>
      )}

      <main className="list">
        {inElection && feed?.election ? (
          <ElectionView election={feed.election} items={feed.items} selected={election ?? ''} onSelect={onElection} onOpen={onOpen} />
        ) : (
        <>
        {feed?.demo && (
          <p className="banner">Données de démonstration. Les vraies vérifications apparaîtront une fois le flux quotidien configuré.</p>
        )}
        {stale && feed && (
          <p className="banner">
            Aucune nouvelle collecte depuis {whenLabel(feed.generatedAt)} : la mise à jour quotidienne semble arrêtée.
            Les vérifications affichées ne sont plus à jour.
          </p>
        )}
        {notice && <p className="banner banner-soft">{notice}</p>}
        <div className="list-status">
          <span>
            {feed ? `${settings.grouped && subjects.length < items.length ? `${plural(subjects.length, 'sujet', 'sujets')} (${items.length} vérif.)` : plural(items.length, 'vérification', 'vérifications')} · données ${remoteConfigured() ? 'mises à jour' : 'collectées'} ${whenLabel(feed.generatedAt)}` : 'Chargement…'}
            {freshCount > 0 && <span className="fresh-count"> · {plural(freshCount, 'nouveau', 'nouveaux')}</span>}
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
              <ClaimCard key={it.id} item={it} onOpen={onOpen} others={othersOf.get(it.id)} fresh={isFresh(it)} />
            ))}
          </section>
        ))}

        {feed && items.length === 0 && (
          <p className="empty">Aucune vérification pour ces filtres.</p>
        )}
        </>
        )}
      </main>
    </div>
  );
}
