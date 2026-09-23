import type { FactCheck } from '../types';
import { fold } from './filters';

// Déduit, à partir du texte, si l'affirmation vérifiée circulait sur les réseaux
// sociaux, et sur lequel quand c'est dit. L'API ne fournit pas cette information :
// c'est une estimation (auteur « Multiple sources », mots « publication », « vidéo »…).

const PLATFORMS: [string, RegExp][] = [
  ['Facebook', /\bfacebook\b/],
  ['TikTok', /\btik ?tok\b/],
  ['X', /\btwitter\b|\bsur x\b|\bon x\b|\bx posts?\b|\bx users\b|^x$/],
  ['Instagram', /\binstagram\b/],
  ['YouTube', /\byoutube\b/],
  ['WhatsApp', /\bwhatsapp\b/],
  ['Telegram', /\btelegram\b/],
  ['Threads', /\bthreads\b/],
  ['Bluesky', /\bbluesky\b/],
  ['Snapchat', /\bsnapchat\b/],
];

const SOCIAL_WORDS = /reseaux sociaux|social media|\bonline\b|en ligne|internaute|viral|\bposts?\b|publication|circul|partag|\bshared\b|netizens|\busers\b|utilisateurs|\baccounts?\b|\bcomptes?\b/;
const MEDIA_WORDS = /\bvideos?\b|\bimages?\b|\bphotos?\b|\bclips?\b|footage|capture d.ecran|screenshot|\bvisuals?\b|montage/;
const GENERIC_CLAIMANT = /multiple|multiples|plusieurs|various|many|sources|users|utilisateurs|people|persons|individuals|accounts|posts|internautes|social|reseaux/;
const HANDLE = /^@|^[a-z0-9._]*[._][a-z0-9._]*$/;

export interface SocialInfo {
  social: boolean;
  /** Plateforme nommée quand on la connaît. */
  platform: string | null;
}

const cache = new WeakMap<FactCheck, SocialInfo>();

export function socialOf(it: FactCheck): SocialInfo {
  const hit = cache.get(it);
  if (hit) return hit;
  const claimant = fold(it.claimant ?? '').trim();
  const text = fold(`${it.claim} ${it.title ?? ''}`);
  const platform = PLATFORMS.find(([, re]) => re.test(claimant) || re.test(text))?.[0] ?? null;
  const namedPerson = !!claimant && !GENERIC_CLAIMANT.test(claimant) && !HANDLE.test(claimant);
  const social =
    !!platform ||
    HANDLE.test(claimant) ||
    SOCIAL_WORDS.test(text) ||
    (MEDIA_WORDS.test(text) && (!namedPerson || /\bvideo|\bphoto|\bimage/.test(text)));
  const info = { social, platform };
  cache.set(it, info);
  return info;
}

export function socialLabel(it: FactCheck): string | null {
  const s = socialOf(it);
  if (!s.social) return null;
  return s.platform ? `Vu sur ${s.platform}` : 'Réseaux sociaux';
}
