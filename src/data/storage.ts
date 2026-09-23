import { Preferences } from '@capacitor/preferences';

// Même principe que MiniSeries : lecture synchrone dans localStorage,
// miroir natif dans Preferences (qui survit au nettoyage du cache WebView),
// restauré au démarrage par restoreFromNative().

const KEYS = ['feed', 'saved', 'settings', 'summaries'] as const;
export type StoreKey = (typeof KEYS)[number];

const prefix = 'verif.';

export function load<T>(key: StoreKey, fallback: T): T {
  try {
    const raw = localStorage.getItem(prefix + key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function save(key: StoreKey, value: unknown): void {
  const raw = JSON.stringify(value);
  try { localStorage.setItem(prefix + key, raw); } catch { /* quota : le miroir natif suffit */ }
  Preferences.set({ key: prefix + key, value: raw }).catch(() => {});
}

/** Recopie Preferences → localStorage pour les clés absentes (WebView vidée). */
export async function restoreFromNative(): Promise<void> {
  await Promise.all(
    KEYS.map(async (k) => {
      try {
        if (localStorage.getItem(prefix + k)) return;
        const { value } = await Preferences.get({ key: prefix + k });
        if (value) localStorage.setItem(prefix + k, value);
      } catch { /* ignoré */ }
    }),
  );
}
