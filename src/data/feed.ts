import { BUNDLED_FEED, FEED_URL } from '../config';
import type { Feed } from '../types';
import { load, save } from './storage';

export function isFeed(x: unknown): x is Feed {
  const f = x as Feed;
  return !!f && typeof f === 'object' && Array.isArray(f.items) && typeof f.generatedAt === 'string';
}

export function remoteConfigured(): boolean {
  return !FEED_URL.includes('VOTRE-PSEUDO');
}

export function cachedFeed(): Feed | null {
  const f = load<unknown>('feed', null);
  return isFeed(f) ? f : null;
}

async function fetchJson(url: string, timeoutMs = 12_000): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { cache: 'no-cache', signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export type FeedResult = { feed: Feed; origin: 'remote' | 'cache' | 'bundled'; error?: string };

/**
 * Ordre : flux en ligne → cache → flux embarqué. Un flux en ligne plus ancien
 * que le cache (CDN pas encore à jour) ne remplace pas le cache.
 */
export async function refreshFeed(): Promise<FeedResult> {
  const cached = cachedFeed();
  let error: string | undefined;

  if (remoteConfigured()) {
    try {
      const remote = await fetchJson(FEED_URL);
      if (!isFeed(remote)) throw new Error('flux illisible');
      if (!cached || cached.demo || Date.parse(remote.generatedAt) >= Date.parse(cached.generatedAt)) {
        save('feed', remote);
        return { feed: remote, origin: 'remote' };
      }
      return { feed: cached, origin: 'cache' };
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }

  if (cached && !cached.demo) return { feed: cached, origin: 'cache', error };

  const bundled = await fetchJson(BUNDLED_FEED);
  if (!isFeed(bundled)) throw new Error('Flux embarqué illisible');
  return { feed: bundled, origin: 'bundled', error };
}
