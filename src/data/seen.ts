import type { Feed } from '../types';

// Repère « Nouveau » : vérifications arrivées depuis la dernière collecte affichée.
// On retient les identifiants du flux déjà vu ; à l'arrivée d'un flux plus récent,
// ce qui n'y figurait pas est « nouveau » jusqu'au flux suivant (même si l'appli est
// fermée entre-temps).

const RECENT_MS = 7 * 86_400_000;

export interface SeenState {
  /** Date de la collecte à laquelle se rapportent `ids` et `fresh`. */
  generatedAt: string;
  /** Toutes les vérifications de ce flux. */
  ids: string[];
  /** Celles qui étaient nouvelles à son arrivée. */
  fresh: string[];
}

/**
 * Calcule le nouvel état. Premier lancement (rien de vu) : rien n'est « nouveau »,
 * sinon tout le fil le serait. Flux de démonstration : ignoré.
 */
export function nextSeen(feed: Feed, previous: SeenState | null): SeenState {
  const ids = feed.items.map((it) => it.id);
  if (feed.demo) return previous ?? { generatedAt: '', ids: [], fresh: [] };
  if (previous && previous.generatedAt === feed.generatedAt) return previous;
  if (!previous || !previous.ids.length) return { generatedAt: feed.generatedAt, ids, fresh: [] };
  const known = new Set(previous.ids);
  // Seules les vérifications récentes peuvent être « nouvelles » : l'ajout d'un candidat
  // apporte jusqu'à un an de déclarations, qui ne sont pas des nouveautés.
  const since = Date.parse(feed.generatedAt) - RECENT_MS;
  const fresh = feed.items.filter((it) => !known.has(it.id) && Date.parse(it.reviewDate) >= since).map((it) => it.id);
  return { generatedAt: feed.generatedAt, ids, fresh };
}
