import { Preferences } from '@capacitor/preferences';
import { nativeAvailable, readNativeFile, writeNativeFile } from '../lib/verifNative';

// Même principe que MiniSeries : lecture synchrone dans localStorage,
// miroir natif dans Preferences (qui survit au nettoyage du cache WebView),
// restauré au démarrage par restoreFromNative().
//
// Exception : le flux (jusqu'à ~1,5 Mo avec les résumés) est trop gros pour les préférences
// Android, réécrites en entier à chaque modification. Sur le téléphone, il vit dans un
// fichier privé de l'appli, chargé en mémoire au démarrage.

const KEYS = ['feed', 'saved', 'settings', 'summaries', 'seen'] as const;
export type StoreKey = (typeof KEYS)[number];

const FILE_KEYS: readonly StoreKey[] = ['feed'];
const inFile = (key: StoreKey) => nativeAvailable && FILE_KEYS.includes(key);
const fileName = (key: StoreKey) => `${key}.json`;
const memory = new Map<StoreKey, string>();

const prefix = 'verif.';

function readRaw(key: StoreKey): string | null {
  if (inFile(key)) return memory.get(key) ?? null;
  try {
    return localStorage.getItem(prefix + key);
  } catch {
    return null;
  }
}

export function load<T>(key: StoreKey, fallback: T): T {
  try {
    const raw = readRaw(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveInPrefs(key: StoreKey, raw: string): void {
  try { localStorage.setItem(prefix + key, raw); } catch { /* quota : le miroir natif suffit */ }
  Preferences.set({ key: prefix + key, value: raw }).catch(() => {});
}

function forgetInPrefs(key: StoreKey): void {
  try { localStorage.removeItem(prefix + key); } catch { /* ignoré */ }
  Preferences.remove({ key: prefix + key }).catch(() => {});
}

export function save(key: StoreKey, value: unknown): void {
  const raw = JSON.stringify(value);
  if (!inFile(key)) {
    saveInPrefs(key, raw);
    return;
  }
  memory.set(key, raw);
  writeNativeFile(fileName(key), raw).then((ok) => {
    if (ok) forgetInPrefs(key); // ancien emplacement (avant la 1.2.0) : place libérée
    else saveInPrefs(key, raw);
  });
}

/**
 * Au démarrage : charge les fichiers natifs en mémoire (en reprenant l'ancien emplacement
 * s'il n'y a pas encore de fichier), et recopie Preferences → localStorage pour les clés
 * absentes (WebView vidée).
 */
export async function restoreFromNative(): Promise<void> {
  await Promise.all(
    KEYS.map(async (k) => {
      try {
        if (inFile(k)) {
          const data = await readNativeFile(fileName(k));
          if (data) {
            memory.set(k, data);
            return;
          }
          const legacy = localStorage.getItem(prefix + k) ?? (await Preferences.get({ key: prefix + k })).value;
          if (legacy) save(k, JSON.parse(legacy));
          return;
        }
        if (localStorage.getItem(prefix + k)) return;
        const { value } = await Preferences.get({ key: prefix + k });
        if (value) localStorage.setItem(prefix + k, value);
      } catch { /* ignoré */ }
    }),
  );
}
