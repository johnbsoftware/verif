import { useEffect, useMemo, useRef, useState } from 'react';
import type { FactCheck, Feed } from '../types';
import { load, save } from './storage';
import { nativeAvailable, translateTexts } from '../lib/verifNative';
import { applyTranslation, fromTexts, isUpToDate, needsTranslation, pruneCache, toTexts, type Translated, type TranslationCache } from './translate';

export type TranslationStatus = 'idle' | 'working' | 'download' | 'error' | 'unavailable';

const BATCH = 20;

/**
 * Traduit en arrière-plan, par lots de 20, les vérifications en anglais du flux et des enregistrés
 * (les plus récentes d'abord) et renvoie les versions à afficher. Le cache survit aux redémarrages ;
 * la première traduction télécharge le modèle ML Kit (~30 Mo, une seule fois).
 *
 * `english` : faux quand l'utilisateur masque les vérifications en anglais. Celles du flux ne sont
 * alors pas traduites (inutile de télécharger le traducteur pour des cartes qu'on n'affiche pas) ;
 * les enregistrés le restent.
 */
export function useTranslations(feed: Feed | null, saved: FactCheck[], enabled: boolean, english = true) {
  // Cache commun à tous les passages : un passage interrompu (nouveau flux) ne perd pas son acquis.
  const store = useRef<TranslationCache | null>(null);
  if (store.current === null) store.current = load<TranslationCache>('translations', {});
  const [cache, setCache] = useState<TranslationCache>(store.current);
  const [status, setStatus] = useState<TranslationStatus>(nativeAvailable ? 'idle' : 'unavailable');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!enabled || !feed || !nativeAvailable) return;
    let cancelled = false;
    (async () => {
      const done = () => store.current!;
      const pool = new Map<string, FactCheck>();
      for (const it of [...saved, ...(english ? feed.items : [])]) if (needsTranslation(it)) pool.set(it.id, it);
      const todo = [...pool.values()]
        .filter((it) => !isUpToDate(it, done()[it.id]))
        .sort((a, b) => Date.parse(b.reviewDate) - Date.parse(a.reviewDate));
      if (!todo.length) {
        setStatus('idle');
        return;
      }
      setStatus(Object.keys(done()).length ? 'working' : 'download');
      for (let i = 0; i < todo.length && !cancelled; i += BATCH) {
        const batch = todo.slice(i, i + BATCH);
        try {
          const out = await translateTexts(batch.flatMap(toTexts));
          batch.forEach((it, k) => { done()[it.id] = fromTexts(it, out.slice(k * 4, k * 4 + 4)); });
        } catch {
          if (!cancelled) setStatus('error');
          return;
        }
        if (cancelled) {
          save('translations', done()); // nouveau flux arrivé en cours de route : on garde l'acquis
          return;
        }
        setStatus('working');
        setCache({ ...done() });
        if ((i / BATCH) % 5 === 4) save('translations', done()); // l'appli peut être fermée en cours de route
      }
      if (cancelled) return;
      store.current = pruneCache(done(), new Set([...feed.items, ...saved].map((it) => it.id)));
      save('translations', store.current);
      setCache(store.current);
      setStatus('idle');
    })();
    return () => { cancelled = true; };
  }, [feed, enabled, english, retry]); // eslint-disable-line react-hooks/exhaustive-deps

  // Une vérification déjà traduite garde le même objet d'un lot à l'autre : le fil ne recalcule
  // (regroupement par sujet, repère « réseaux sociaux ») que pour ce qui vient de changer.
  const memo = useRef(new Map<string, { src: FactCheck; tr: Translated; out: FactCheck }>());
  const show = (it: FactCheck): FactCheck => {
    const tr = cache[it.id];
    if (!tr) return it;
    const hit = memo.current.get(it.id);
    if (hit && hit.src === it && hit.tr === tr) return hit.out;
    const out = applyTranslation(it, tr);
    memo.current.set(it.id, { src: it, tr, out });
    return out;
  };

  const shownFeed = useMemo<Feed | null>(() => {
    if (!feed || !enabled) return feed;
    // Rien de traduit dans ce flux : on rend le flux tel quel (même objet).
    if (!feed.items.some((it) => cache[it.id])) return feed;
    return { ...feed, items: feed.items.map(show) };
  }, [feed, enabled, cache]); // eslint-disable-line react-hooks/exhaustive-deps

  const shownSaved = useMemo(
    () => (enabled ? saved.map(show) : saved),
    [saved, enabled, cache], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const pending = useMemo(
    () => (enabled && english && feed ? feed.items.filter((it) => needsTranslation(it) && !isUpToDate(it, cache[it.id])).length : 0),
    [feed, enabled, english, cache],
  );

  return { feed: shownFeed, saved: shownSaved, status, pending, retry: () => setRetry((n) => n + 1) };
}
