import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { App as CapApp } from '@capacitor/app';
import type { FactCheck, Feed, Settings, Tab } from './types';
import { cachedFeed, refreshFeed } from './data/feed';
import { load, save } from './data/storage';
import { REFRESH_AFTER_MS } from './config';
import { isNative, setDailyDigest } from './lib/native';
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
const COUNTRY_ORDER = ['France', 'Belgique', 'Suisse', 'Canada', 'Europe', 'International'];

export default function App() {
  const [feed, setFeed] = useState<Feed | null>(() => cachedFeed());
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings>(() => ({ ...DEFAULT_SETTINGS, ...load<Partial<Settings>>('settings', {}) }));
  const [saved, setSaved] = useState<FactCheck[]>(() => load<FactCheck[]>('saved', []));
  const [tab, setTab] = useState<Tab>('feed');
  const [detail, setDetail] = useState<FactCheck | null>(null);
  const [shared, setShared] = useState<SharedContent | null>(null);
  const lastFetch = useRef(0);

  const feedRef = useRef<Feed | null>(feed);
  const refresh = useCallback(async (manual = false) => {
    setLoading(true);
    try {
      const before = feedRef.current?.generatedAt;
      const r = await refreshFeed();
      setFeed(r.feed);
      feedRef.current = r.feed;
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
      setDetail(null);
      setTab('check');
    };
    takeShared().then((s) => s && show(s));
    return onShared(show);
  }, []);

  // Bouton retour Android : détail → liste → onglet Fil → quitter.
  const nav = useRef({ detail, tab });
  nav.current = { detail, tab };
  useEffect(() => {
    if (!isNative) return;
    const sub = CapApp.addListener('backButton', () => {
      if (nav.current.detail) setDetail(null);
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

  const onDigest = async (on: boolean) => {
    const got = await setDailyDigest(on);
    updateSettings({ ...settings, dailyDigest: got });
    if (on && !got) setNotice('Notifications refusées : le rappel quotidien reste désactivé.');
  };

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
            onOpen={setDetail}
            onOpenFilters={() => setTab('filters')}
            onRefresh={() => refresh(true)}
          />
        </div>
        <div className="tab-panel" hidden={tab !== 'check'}>
          <CheckScreen feed={feed} shared={shared} onClearShared={() => setShared(null)} onOpen={setDetail} />
        </div>
        <div className="tab-panel" hidden={tab !== 'saved'}>
          <SavedScreen items={saved} onOpen={setDetail} />
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
          onBack={() => setDetail(null)}
          onToggleSave={toggleSave}
          related={settings.grouped ? related.get(detail.id) ?? [] : []}
          onOpen={setDetail}
        />
      )}
    </div>
  );
}
