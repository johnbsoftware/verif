import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { App as CapApp } from '@capacitor/app';
import type { FactCheck, Feed, Settings, Tab } from './types';
import { cachedFeed, migrateItem, refreshFeed } from './data/feed';
import { load, save } from './data/storage';
import { REFRESH_AFTER_MS, RENAMED_THEMES } from './config';
import { isNative, setDailyDigest, syncDigest } from './lib/native';
import { setKnownIds } from './lib/verifNative';
import { nextSeen, type SeenState } from './data/seen';
import { hourLabel, whenLabel } from './lib/format';
import { FeedScreen } from './screens/FeedScreen';
import { DetailScreen } from './screens/DetailScreen';
import { FiltersScreen } from './screens/FiltersScreen';
import { SavedScreen } from './screens/SavedScreen';
import { CheckScreen } from './screens/CheckScreen';
import { onShared, takeShared, type SharedContent } from './lib/shareInbox';
import { TabBar } from './components/TabBar';
import { relatedIndex } from './data/groups';

const DEFAULT_SETTINGS: Settings = { countries: [], themes: [], dailyDigest: false, english: true, grouped: true, theme: 'system' };
/** Réglages enregistrés par une version précédente : thèmes renommés depuis. */
function loadSettings(): Settings {
  const s = { ...DEFAULT_SETTINGS, ...load<Partial<Settings>>('settings', {}) };
  const themes = [...new Set(s.themes.map((t) => RENAMED_THEMES[t] ?? t))];
  return { ...s, themes };
}

const COUNTRY_ORDER = ['France', 'Belgique', 'Suisse', 'Canada', 'Europe', 'International'];

export default function App() {
  const [feed, setFeed] = useState<Feed | null>(() => cachedFeed());
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [saved, setSaved] = useState<FactCheck[]>(() => load<FactCheck[]>('saved', []).map(migrateItem));
  const [tab, setTab] = useState<Tab>('feed');
  // Pile des vérifications ouvertes : « Sur le même sujet » empile, Retour dépile.
  const [stack, setStack] = useState<FactCheck[]>([]);
  const detail = stack.length ? stack[stack.length - 1] : null;
  const openDetail = useCallback((it: FactCheck) => setStack([it]), []);
  const openRelated = useCallback((it: FactCheck) => setStack((s) => [...s, it]), []);
  const closeDetail = useCallback(() => setStack((s) => s.slice(0, -1)), []);
  // Rubrique Présidentielle (onglet Fil) : null = fermée, '' = liste, sinon un candidat.
  const [election, setElection] = useState<string | null>(null);
  const [seen, setSeen] = useState<SeenState | null>(() => load<SeenState | null>('seen', null));
  const [shared, setShared] = useState<SharedContent | null>(null);
  const lastFetch = useRef(0);

  const feedRef = useRef<Feed | null>(feed);
  const refresh = useCallback(async (manual = false) => {
    setLoading(true);
    try {
      const before = feedRef.current?.generatedAt;
      const r = await refreshFeed();
      // Même collecte que celle affichée : on garde l'objet (pas de recalcul du regroupement).
      if (r.feed.generatedAt !== before || !feedRef.current) {
        setFeed(r.feed);
        feedRef.current = r.feed;
      }
      lastFetch.current = Date.now();
      const now = hourLabel(new Date().toISOString());
      if (r.error && r.origin !== 'remote') {
        setNotice(`Actualisation impossible à ${now} (${r.error}) : affichage des données ${whenLabel(r.feed.generatedAt)}.`);
      } else if (manual && before === r.feed.generatedAt) {
        setNotice(`Vérifié à ${now} : déjà à jour (dernière collecte ${whenLabel(r.feed.generatedAt)}). La prochaine collecte a lieu chaque matin vers 6 h 30.`);
      } else if (manual) {
        setNotice(`Nouvelles vérifications chargées à ${now}.`);
      } else setNotice(null);
    } catch (e) {
      setNotice(`Impossible de charger les vérifications (${e instanceof Error ? e.message : String(e)}). Vérifiez la connexion puis touchez Actualiser.`);
    } finally {
      setLoading(false);
    }
  }, []);

  // Chargement initial + actualisation au retour dans l'appli.
  useEffect(() => {
    refresh();
    if (!isNative) return;
    const sub = CapApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive && Date.now() - lastFetch.current > REFRESH_AFTER_MS) refresh();
    });
    return () => { sub.then((h) => h.remove()); };
  }, [refresh]);

  // Partage reçu d'une autre appli (Facebook, TikTok…) : ouvrir l'onglet Vérifier.
  useEffect(() => {
    const show = (s: SharedContent) => {
      setShared(s);
      setStack([]);
      setTab('check');
    };
    takeShared().then((s) => s && show(s));
    return onShared(show);
  }, []);

  // Bouton retour Android : détail → liste → onglet Fil → quitter.
  const nav = useRef({ detail, tab, election });
  nav.current = { detail, tab, election };
  useEffect(() => {
    if (!isNative) return;
    const sub = CapApp.addListener('backButton', () => {
      if (nav.current.detail) setStack((s) => s.slice(0, -1));
      else if (nav.current.tab === 'feed' && nav.current.election) setElection('');
      else if (nav.current.tab === 'feed' && nav.current.election === '') setElection(null);
      else if (nav.current.tab !== 'feed') setTab('feed');
      else CapApp.exitApp();
    });
    return () => { sub.then((h) => h.remove()); };
  }, []);

  // Apparence choisie dans Filtres → Affichage.
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'system') delete root.dataset.theme;
    else root.dataset.theme = settings.theme;
  }, [settings.theme]);

  const updateSettings = (s: Settings) => {
    setSettings(s);
    save('settings', s);
  };

  // Enregistre les réglages migrés (thèmes renommés) une fois pour toutes.
  useEffect(() => { save('settings', settings); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Le rappel natif filtre comme le fil : on lui transmet pays, thèmes et langue à chaque changement.
  const { dailyDigest, countries, themes, english } = settings;
  useEffect(() => {
    if (dailyDigest) syncDigest(settings);
  }, [dailyDigest, countries, themes, english]); // eslint-disable-line react-hooks/exhaustive-deps

  const onDigest = async (on: boolean) => {
    const got = await setDailyDigest(on, settings);
    updateSettings({ ...settings, dailyDigest: got });
    if (on && !got) {
      setNotice(isNative ? 'Notifications refusées : le rappel quotidien reste désactivé.'
        : 'Le rappel quotidien ne fonctionne que dans l’appli Android.');
    }
  };

  // Repère « Nouveau » : à chaque nouvelle collecte affichée.
  useEffect(() => {
    if (!feed) return;
    const next = nextSeen(feed, seen);
    if (next === seen) return;
    setSeen(next);
    save('seen', next);
    if (!feed.demo) setKnownIds(next.ids); // le rappel du lendemain ne les annoncera pas
  }, [feed]); // eslint-disable-line react-hooks/exhaustive-deps
  const freshIds = useMemo(() => new Set(seen?.generatedAt === feed?.generatedAt ? seen?.fresh ?? [] : []), [seen, feed]);

  const toggleSave = (it: FactCheck) => {
    const next = saved.some((s) => s.id === it.id) ? saved.filter((s) => s.id !== it.id) : [it, ...saved];
    setSaved(next);
    save('saved', next);
  };

  const related = useMemo(() => relatedIndex(feed?.items ?? []), [feed]);

  const allCountries = useMemo(() => {
    const set = new Set<string>([...(feed?.sources ?? []).map((s) => s.country), ...(feed?.items ?? []).map((i) => i.country)]);
    return [...set].sort((a, b) => {
      const ia = COUNTRY_ORDER.indexOf(a), ib = COUNTRY_ORDER.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b, 'fr');
    });
  }, [feed]);

  return (
    <div className="app">
      {/* Les onglets restent montés : la position de défilement du fil survit à l'ouverture d'un détail. */}
      <div className="tabs-area" hidden={!!detail}>
        <div className="tab-panel" hidden={tab !== 'feed'}>
          <FeedScreen
            feed={feed}
            settings={settings}
            allCountries={allCountries}
            loading={loading}
            notice={notice}
            freshIds={freshIds}
            election={election}
            onElection={setElection}
            onOpen={openDetail}
            onOpenFilters={() => setTab('filters')}
            onRefresh={() => refresh(true)}
          />
        </div>
        <div className="tab-panel" hidden={tab !== 'check'}>
          <CheckScreen feed={feed} shared={shared} onClearShared={() => setShared(null)} onPicked={setShared} onOpen={openDetail} />
        </div>
        <div className="tab-panel" hidden={tab !== 'saved'}>
          <SavedScreen items={saved} onOpen={openDetail} />
        </div>
        <div className="tab-panel" hidden={tab !== 'filters'}>
          <FiltersScreen
            feed={feed}
            settings={settings}
            allCountries={allCountries}
            onChange={updateSettings}
            onDigest={onDigest}
            onDone={() => setTab('feed')}
          />
        </div>
        <TabBar tab={tab} onChange={setTab} savedCount={saved.length} />
      </div>

      {detail && (
        <DetailScreen
          item={detail}
          saved={saved.some((s) => s.id === detail.id)}
          onBack={closeDetail}
          backLabel={stack.length > 1 ? 'Précédent' : 'Retour'}
          onToggleSave={toggleSave}
          related={settings.grouped ? related.get(detail.id) ?? [] : []}
          onOpen={openRelated}
        />
      )}
    </div>
  );
}
