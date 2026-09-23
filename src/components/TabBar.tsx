import type { ReactNode } from 'react';
import type { Tab } from '../types';
import { Bookmark, Inspect, List, Sliders } from './Icons';

const TABS: { id: Tab; label: string; icon: ReactNode }[] = [
  { id: 'feed', label: 'Fil', icon: <List /> },
  { id: 'check', label: 'Vérifier', icon: <Inspect /> },
  { id: 'saved', label: 'Enregistrés', icon: <Bookmark /> },
  { id: 'filters', label: 'Filtres', icon: <Sliders /> },
];

export function TabBar({ tab, onChange, savedCount }: { tab: Tab; onChange: (t: Tab) => void; savedCount: number }) {
  return (
    <nav className="tabbar" aria-label="Navigation principale">
      {TABS.map((t) => (
        <button
          key={t.id}
          className={`tab${tab === t.id ? ' tab-on' : ''}`}
          aria-current={tab === t.id ? 'page' : undefined}
          onClick={() => onChange(t.id)}
        >
          {t.icon}
          <span>
            {t.label}
            {t.id === 'saved' && savedCount > 0 ? ` (${savedCount})` : ''}
          </span>
        </button>
      ))}
    </nav>
  );
}
