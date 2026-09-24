import type { Feed } from '../types';

// Repère « Nouveau » : vérifications arrivées depuis la dernière collecte affichée.
// On retient les identifiants du flux déjà vu ; à l'arrivée d'un flux plus récent,
// ce qui n'y figurait pas est « nouveau » jusqu'au flux suivant (même si l'appli est
// fermée entre-temps).

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
  return { generatedAt: feed.generatedAt, ids, fresh: ids.filter((id) => !known.has(id)) };
}
