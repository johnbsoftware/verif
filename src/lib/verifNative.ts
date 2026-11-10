import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';

/**
 * Plugin natif maison (android/…/VerifNativePlugin.java) :
 * - lecture / écriture de fichiers dans le dossier privé de l'appli (le flux, trop gros pour les préférences) ;
 * - rappel quotidien : une tâche Android (WorkManager) télécharge le flux chaque matin et ne notifie
 *   que s'il y a du nouveau dans les filtres de l'utilisateur.
 */
export interface DigestConfig {
  enabled: boolean;
  hour: number;
  minute: number;
  feedUrl: string;
  countries: string[];
  themes: string[];
  english: boolean;
}

interface VerifNativePlugin {
  readFile(options: { name: string }): Promise<{ data?: string }>;
  writeFile(options: { name: string; data: string }): Promise<void>;
  configureDigest(options: DigestConfig): Promise<void>;
  setKnownIds(options: { ids: string[] }): Promise<void>;
  translate(options: { texts: string[] }): Promise<{ texts: string[] }>;
  takeOpenId(): Promise<{ id?: string }>;
  addListener(event: 'openCheck', cb: () => void): Promise<PluginListenerHandle>;
}

const VerifNative = registerPlugin<VerifNativePlugin>('VerifNative');

/** Faux dans le navigateur, et sur un APK d'avant la 1.2.0 (le plugin n'existe pas encore). */
export const nativeAvailable = Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('VerifNative');

export async function readNativeFile(name: string): Promise<string | null> {
  if (!nativeAvailable) return null;
  try {
    return (await VerifNative.readFile({ name })).data ?? null;
  } catch {
    return null;
  }
}

export async function writeNativeFile(name: string, data: string): Promise<boolean> {
  if (!nativeAvailable) return false;
  try {
    await VerifNative.writeFile({ name, data });
    return true;
  } catch {
    return false;
  }
}

export async function configureDigest(config: DigestConfig): Promise<boolean> {
  if (!nativeAvailable) return false;
  try {
    await VerifNative.configureDigest(config);
    return true;
  } catch {
    return false;
  }
}

/** Vérifications déjà vues dans l'appli : le rappel ne les annoncera pas comme nouvelles. */
export async function setKnownIds(ids: string[]): Promise<void> {
  if (!nativeAvailable) return;
  try {
    await VerifNative.setKnownIds({ ids });
  } catch {
    /* ignoré */
  }
}

/** Traduction anglais → français sur le téléphone (ML Kit). Lève une erreur si impossible. */
export async function translateTexts(texts: string[]): Promise<string[]> {
  if (!nativeAvailable) throw new Error('indisponible');
  const r = await VerifNative.translate({ texts });
  return r.texts;
}

/**
 * Vérification à ouvrir : l'utilisateur a touché la notification du rappel, qui n'en annonçait
 * qu'une. null s'il n'y en a pas (ou sur un APK d'avant la 1.4.2).
 */
export async function takeOpenId(): Promise<string | null> {
  if (!nativeAvailable) return null;
  try {
    return (await VerifNative.takeOpenId()).id || null;
  } catch {
    return null;
  }
}

/** Appelle cb quand une notification est touchée pendant que l'appli est ouverte. */
export function onOpenCheck(cb: (id: string) => void): () => void {
  if (!nativeAvailable) return () => {};
  const sub = VerifNative.addListener('openCheck', async () => {
    const id = await takeOpenId();
    if (id) cb(id);
  });
  return () => { sub.then((h) => h.remove()).catch(() => {}); };
}
