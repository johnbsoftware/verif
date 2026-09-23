import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { Share } from '@capacitor/share';
import { LocalNotifications } from '@capacitor/local-notifications';
import { DIGEST_HOUR } from '../config';
import type { FactCheck } from '../types';

export const isNative = Capacitor.isNativePlatform();

export async function openArticle(url: string): Promise<void> {
  if (isNative) await Browser.open({ url, toolbarColor: '#F7F6F2' });
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

const DIGEST_ID = 7001;

/**
 * Active ou coupe le rappel quotidien. Retourne l'état réellement obtenu
 * (false si l'utilisateur refuse l'autorisation de notifier).
 */
export async function setDailyDigest(on: boolean): Promise<boolean> {
  if (!isNative) return on;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: DIGEST_ID }] });
    if (!on) return false;
    let perm = await LocalNotifications.checkPermissions();
    if (perm.display !== 'granted') perm = await LocalNotifications.requestPermissions();
    if (perm.display !== 'granted') return false;
    await LocalNotifications.schedule({
      notifications: [{
        id: DIGEST_ID,
        title: 'Vérif',
        body: 'Les vérifications du jour sont disponibles.',
        schedule: { on: { hour: DIGEST_HOUR, minute: 0 }, allowWhileIdle: true },
      }],
    });
    return true;
  } catch {
    return false;
  }
}
