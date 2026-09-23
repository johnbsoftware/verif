import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';

/** Ce qu'une autre appli a partagé vers Vérif (plugin natif android/…/ShareInboxPlugin.java). */
export interface SharedContent {
  text?: string;
  subject?: string;
  /** Chemin local de l'image reçue (copiée dans le cache de l'appli). */
  imagePath?: string;
  mimeType?: string;
}

interface ShareInboxPlugin {
  take(): Promise<SharedContent>;
  searchImage(options: { path: string }): Promise<{ via: 'lens' | 'google' | 'chooser' }>;
  readText(options: { path: string }): Promise<{ text: string }>;
  addListener(event: 'shareReceived', cb: () => void): Promise<PluginListenerHandle>;
}

const ShareInbox = registerPlugin<ShareInboxPlugin>('ShareInbox');
const available = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

/** Récupère le partage en attente, s'il y en a un (null sinon). */
export async function takeShared(): Promise<SharedContent | null> {
  if (!available) return null;
  try {
    const s = await ShareInbox.take();
    return s && (s.text || s.subject || s.imagePath) ? s : null;
  } catch {
    return null;
  }
}

/** Appelle cb à chaque nouveau partage reçu pendant que l'appli est ouverte. */
export function onShared(cb: (s: SharedContent) => void): () => void {
  if (!available) return () => {};
  const sub = ShareInbox.addListener('shareReceived', async () => {
    const s = await takeShared();
    if (s) cb(s);
  });
  return () => { sub.then((h) => h.remove()); };
}

/**
 * Texte lu sur une image reçue (reconnaissance sur le téléphone).
 * Chaîne vide : aucun texte ; null : lecture impossible (module pas encore téléchargé par Google Play…).
 */
export async function readImageText(path: string): Promise<string | null> {
  if (!available) return null;
  try {
    return (await ShareInbox.readText({ path })).text ?? '';
  } catch {
    return null;
  }
}

export async function searchImageWithLens(path: string): Promise<void> {
  await ShareInbox.searchImage({ path });
}

/** Adresse affichable dans la WebView pour un fichier local. */
export const localImageSrc = (path: string) => Capacitor.convertFileSrc(path);
