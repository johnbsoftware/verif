import { Capacitor, CapacitorHttp } from '@capacitor/core';
import type { FactCheck } from '../types';
import { fold } from '../data/filters';
import { load, save } from '../data/storage';

// Certains organismes (l'AFP) refusent les lectures venant des serveurs de GitHub :
// pour eux, le résumé est lu depuis le téléphone, à l'ouverture de la vérification,
// comme le ferait le navigateur. Même règles que collector/normalize.mjs (extractSummary).

const BOILERPLATE = /cookie|consentement|consent|javascript|abonnez|abonnement|newsletter|inscrivez|subscribe|sign up|log in|connectez|publicit|advertis|tous droits|all rights reserved|copyright/;
const squash = (x: string) => fold(x).replace(/[^a-z0-9]+/g, ' ').trim();

function repeatsTitle(text: string, title: string): boolean {
  const a = squash(text);
  const b = squash(title);
  if (!b) return false;
  return a === b || b.includes(a) || (a.includes(b) && a.length - b.length < 40);
}

function shorten(text: string): string {
  if (text.length <= 420) return text;
  const cut = text.slice(0, 420);
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  return end > 200 ? cut.slice(0, end + 1) : `${cut.replace(/\s+\S*$/, '')}…`;
}

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();
const acceptable = (t: string, title: string, min: number) =>
  t.length >= min && !BOILERPLATE.test(fold(t)) && !repeatsTitle(t, title);

function jsonLdTexts(doc: Document): string[] {
  const out: string[] = [];
  const visit = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach(visit);
    const o = node as Record<string, unknown>;
    for (const k of ['reviewBody', 'description', 'abstract']) if (typeof o[k] === 'string') out.push(o[k] as string);
    Object.values(o).forEach(visit);
  };
  doc.querySelectorAll('script[type="application/ld+json"]').forEach((s) => {
    try { visit(JSON.parse(s.textContent ?? '')); } catch { /* ignoré */ }
  });
  return out;
}

export function extractSummaryFromHtml(html: string, title: string): string | null {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const meta = (n: string) =>
    doc.querySelector(`meta[property="${n}"], meta[name="${n}"]`)?.getAttribute('content') ?? '';
  for (const raw of [meta('og:description'), meta('twitter:description'), meta('description'), ...jsonLdTexts(doc)]) {
    const t = clean(raw);
    if (t && acceptable(t, title, 60)) return shorten(t);
  }
  const root = doc.querySelector('article') ?? doc.body;
  for (const p of Array.from(root?.querySelectorAll('p') ?? [])) {
    const t = clean(p.textContent ?? '');
    if (/^(par |publi|mis a jour|updated|by )/i.test(fold(t))) continue;
    if (acceptable(t, title, 90)) return shorten(t);
  }
  return null;
}

type Cache = Record<string, string>; // id -> résumé ('' = rien trouvé)

export const canFetchOnDevice = Capacitor.isNativePlatform();

/** Résumé déjà lu sur ce téléphone : string, '' si rien trouvé, undefined si jamais essayé. */
export function cachedSummary(id: string): string | undefined {
  return load<Cache>('summaries', {})[id];
}

export async function fetchSummaryOnDevice(item: FactCheck): Promise<string | null> {
  if (!canFetchOnDevice) return null;
  try {
    const r = await CapacitorHttp.get({
      url: item.url,
      headers: { 'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.6', Accept: 'text/html' },
      connectTimeout: 10000,
      readTimeout: 10000,
    });
    if (r.status < 200 || r.status >= 400 || typeof r.data !== 'string') return null;
    const summary = extractSummaryFromHtml(r.data, item.title ?? '');
    const cache = load<Cache>('summaries', {});
    cache[item.id] = summary ?? '';
    // On garde au plus 500 résumés (les plus récents ajoutés).
    const keys = Object.keys(cache);
    for (const k of keys.slice(0, Math.max(0, keys.length - 500))) delete cache[k];
    save('summaries', cache);
    return summary;
  } catch {
    return null; // réseau indisponible : on retentera à la prochaine ouverture
  }
}
