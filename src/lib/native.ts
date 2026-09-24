import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { Share } from '@capacitor/share';
import { LocalNotifications } from '@capacitor/local-notifications';
import { DIGEST_HOUR, DIGEST_MINUTE, FEED_URL } from '../config';
import type { FactCheck, Settings } from '../types';
import { configureDigest, nativeAvailable } from './verifNative';

export const isNative = Capacitor.isNativePlatform();

/** Vrai si l'appli s'affiche en sombre (réglage forcé, sinon celui du téléphone). */
function isDark(): boolean {
  const forced = document.documentElement.dataset.theme;
  if (forced) return forced === 'dark';
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

export async function openArticle(url: string): Promise<void> {
  // Même fond que l'appli (voir --bg dans styles.css) : pas de barre claire en mode sombre.
  if (isNative) await Browser.open({ url, toolbarColor: isDark() ? '#151514' : '#F7F6F2' });
  else window.open(url, '_blank', 'noopener');
}

export async function shareCheck(it: FactCheck): Promise<void> {
  const text = `« ${it.claim} » — ${it.rating || 'vérifié'} selon ${it.publisher}`;
  try {
    const nav = navigator as Navigator & { share?: unknown };
    if (isNative || typeof nav.share === 'function') await Share.share({ title: 'Vérif', text, url: it.url, dialogTitle: 'Partager' });
    else await nav.clipboard.writeText(`${text}\n${it.url}`);
  } catch { /* partage annulé */ }
}

/** Ancien rappel (versions ≤ 1.1.1) : notification fixe programmée par LocalNotifications. */
const LEGACY_DIGEST_ID = 7001;

/** Transmet au rappel natif l'état et les filtres courants (sans demander d'autorisation). */
export async function syncDigest(settings: Settings): Promise<void> {
  // Mise à jour depuis la 1.1.x : l'ancienne notification fixe ne doit pas s'ajouter au nouveau rappel.
  if (isNative) await LocalNotifications.cancel({ notifications: [{ id: LEGACY_DIGEST_ID }] }).catch(() => {});
  await configureDigest({
    enabled: settings.dailyDigest,
    hour: DIGEST_HOUR,
    minute: DIGEST_MINUTE,
    feedUrl: FEED_URL,
    countries: settings.countries,
    themes: settings.themes,
    english: settings.english,
  });
}

/**
 * Active ou coupe le rappel quotidien. Retourne l'état réellement obtenu
 * (false si l'utilisateur refuse l'autorisation de notifier).
 * Le rappel lui-même est une tâche Android qui télécharge le flux vers 7 h 30
 * et ne notifie que s'il y a de nouvelles vérifications dans les filtres.
 */
export async function setDailyDigest(on: boolean, settings: Settings): Promise<boolean> {
  if (!isNative) return on;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: LEGACY_DIGEST_ID }] }).catch(() => {});
    if (on) {
      let perm = await LocalNotifications.checkPermissions();
      if (perm.display !== 'granted') perm = await LocalNotifications.requestPermissions();
      if (perm.display !== 'granted') return false;
    }
    if (!nativeAvailable) return false;
    await syncDigest({ ...settings, dailyDigest: on });
    return on;
  } catch {
    return false;
  }
}
