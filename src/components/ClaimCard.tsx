import type { FactCheck } from '../types';
import { ago } from '../lib/format';
import { VerdictBadge } from './VerdictBadge';
import { fold } from '../data/filters';
import { socialLabel } from '../data/social';
import { People } from './Icons';

// Conclusions qui ne font que répéter le badge : inutile de les afficher en plus.
const PLAIN = new Set(['faux', 'false', 'vrai', 'true', 'trompeur', 'misleading']);

export function ClaimCard({ item, onOpen }: { item: FactCheck; onOpen: (it: FactCheck) => void }) {
  const showRating = !!item.rating && !PLAIN.has(fold(item.rating).trim());
  const social = socialLabel(item);
  return (
    <button className="card" onClick={() => onOpen(item)}>
      <span className="card-top">
        <span className="row gap-8">
          <VerdictBadge verdict={item.verdict} />
          {social && <span className="tag"><People />{social}</span>}
        </span>
        <span className="muted small nowrap">{ago(item.reviewDate)}</span>
      </span>
      <span className="card-claim">« {item.claim} »</span>
      {showRating && <span className="card-rating">{item.rating}</span>}
      <span className="card-meta">
        {item.theme === item.country ? item.country : `${item.country} · ${item.theme}`} · {item.publisher}
      </span>
    </button>
  );
}
