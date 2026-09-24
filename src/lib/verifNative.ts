import { Capacitor, registerPlugin } from '@capacitor/core';

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
