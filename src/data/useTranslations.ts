import { useEffect, useMemo, useState } from 'react';
import type { FactCheck, Feed } from '../types';
import { load, save } from './storage';
import { nativeAvailable, translateTexts } from '../lib/verifNative';
import { applyTranslation, fromTexts, needsTranslation, pruneCache, toTexts, type TranslationCache } from './translate';

export type TranslationStatus = 'idle' | 'working' | 'download' | 'error' | 'unavailable';

const BATCH = 20;

/**
 * Traduit en arrière-plan, par lots de 20, les vérifications en anglais du flux et des enregistrés
 * (les plus récentes d'abord) et renvoie les versions à afficher. Le cache survit aux redémarrages ;
 * la première traduction télécharge le modèle ML Kit (~30 Mo, une seule fois).
 */
export function useTranslations(feed: Feed | null, saved: FactCheck[], enabled: boolean) {
  const [cache, setCache] = useState<TranslationCache>(() => load<TranslationCache>('translations', {}));
  const [status, setStatus] = useState<TranslationStatus>(nativeAvailable ? 'idle' : 'unavailable');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!enabled || !feed || !nativeAvailable) return;
    let cancelled = false;
    (async () => {
      let current = load<TranslationCache>('translations', {});
      const pool = new Map<string, FactCheck>();
      for (const it of [...saved, ...feed.items]) if (needsTranslation(it)) pool.set(it.id, it);
      const todo = [...pool.values()]
        .filter((it) => !current[it.id])
        .sort((a, b) => Date.parse(b.reviewDate) - Date.parse(a.reviewDate));
      if (!todo.length) return;
      setStatus(Object.keys(current).length ? 'working' : 'download');
      for (let i = 0; i < todo.length && !cancelled; i += BATCH) {
        const batch = todo.slice(i, i + BATCH);
        try {
          const out = await translateTexts(batch.flatMap(toTexts));
          batch.forEach((it, k) => { current[it.id] = fromTexts(it, out.slice(k * 4, k * 4 + 4)); });
        } catch {
          if (!cancelled) setStatus('error');
          return;
        }
        if (cancelled) {
          save('translations', current); // nouveau flux arrivé en cours de route : on garde l'acquis
          return;
        }
        setStatus('working');
        setCache({ ...current });
        if ((i / BATCH) % 5 === 4) save('translations', current); // l'appli peut être fermée en cours de route
      }
      current = pruneCache(current, new Set([...feed.items, ...saved].map((it) => it.id)));
      save('translations', current);
      setCache(current);
      setStatus('idle');
    })();
    return () => { cancelled = true; };
  }, [feed, enabled, retry]); // eslint-disable-line react-hooks/exhaustive-deps

  const shownFeed = useMemo<Feed | null>(() => {
    if (!feed || !enabled) return feed;
    return { ...feed, items: feed.items.map((it) => applyTranslation(it, cache[it.id])) };
  }, [feed, enabled, cache]);

  const shownSaved = useMemo(
    () => (enabled ? saved.map((it) => applyTranslation(it, cache[it.id])) : saved),
    [saved, enabled, cache],
  );

  const pending = useMemo(
    () => (enabled && feed ? feed.items.filter((it) => needsTranslation(it) && !cache[it.id]).length : 0),
    [feed, enabled, cache],
  );

  return { feed: shownFeed, saved: shownSaved, status, pending, retry: () => setRetry((n) => n + 1) };
}
