import { Capacitor, CapacitorHttp } from '@capacitor/core';

// Lit ce qu'il y a derrière un lien partagé (texte du post, image), sans compte ni clé :
// - TikTok, X et YouTube publient une interface officielle « oEmbed » ;
// - pour les autres (Facebook, Instagram, sites), on lit les balises d'aperçu (og:title,
//   og:description, og:image) de la page publique. Facebook les masque souvent derrière
//   sa page de connexion : dans ce cas, rien n'est trouvé et l'appli le dit.
// Passe par le HTTP natif de Capacitor (pas de blocage CORS) ; indisponible dans le navigateur.

export interface LinkPreview {
  site: string;
  text: string | null;
  imageUrl: string | null;
}

const GENERIC = /^(facebook|instagram|tiktok|x|twitter|youtube|log in|login|connexion|se connecter|sign up|inscription|watch|regarder)\b/i;

const hostOf = (u: string) => {
  try { return new URL(u).hostname.replace(/^(www|m|mobile|vm|vt)\./, ''); } catch { return ''; }
};

async function get(url: string): Promise<{ data: unknown; url: string } | null> {
  try {
    const r = await CapacitorHttp.get({
      url,
      headers: { 'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.6' },
      connectTimeout: 8000,
      readTimeout: 8000,
    });
    return r.status >= 200 && r.status < 400 ? { data: r.data, url: r.url || url } : null;
  } catch {
    return null;
  }
}

function asJson(data: unknown): Record<string, unknown> | null {
  if (data && typeof data === 'object') return data as Record<string, unknown>;
  if (typeof data === 'string') { try { return JSON.parse(data); } catch { return null; } }
  return null;
}

function textOfHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function clean(s: unknown): string | null {
  if (typeof s !== 'string') return null;
  const t = s.replace(/\s+/g, ' ').trim();
  return t && !GENERIC.test(t) && t.length > 3 ? t : null;
}

async function oembed(endpoint: string, url: string): Promise<LinkPreview | null> {
  const r = await get(`${endpoint}${encodeURIComponent(url)}`);
  const j = r && asJson(r.data);
  if (!j) return null;
  // X renvoie le tweet en HTML : on garde le paragraphe du message.
  let text = clean(j.title);
  if (!text && typeof j.html === 'string') {
    const p = /<p[^>]*>([\s\S]*?)<\/p>/i.exec(j.html);
    text = clean(textOfHtml(p ? p[1] : j.html));
  }
  return { site: hostOf(url), text, imageUrl: typeof j.thumbnail_url === 'string' ? j.thumbnail_url : null };
}

function openGraph(html: string, site: string): LinkPreview | null {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const meta = (name: string) =>
    doc.querySelector(`meta[property="${name}"], meta[name="${name}"]`)?.getAttribute('content') ?? null;
  const title = clean(meta('og:title'));
  const desc = clean(meta('og:description') ?? meta('description'));
  const text = [title, desc].filter(Boolean).join(' — ') || null;
  const imageUrl = meta('og:image');
  return text || imageUrl ? { site, text, imageUrl } : null;
}

export const previewAvailable = Capacitor.isNativePlatform();

export async function previewLink(url: string): Promise<LinkPreview | null> {
  if (!previewAvailable) return null;
  // Suit les redirections (liens courts vm.tiktok.com, fb.watch, facebook.com/share/…).
  const page = await get(url);
  const finalUrl = page?.url ?? url;
  const site = hostOf(finalUrl);

  let viaEmbed: LinkPreview | null = null;
  if (site.endsWith('tiktok.com')) viaEmbed = await oembed('https://www.tiktok.com/oembed?url=', finalUrl);
  else if (site === 'x.com' || site === 'twitter.com')
    viaEmbed = await oembed('https://publish.twitter.com/oembed?omit_script=1&url=', finalUrl.replace('://x.com', '://twitter.com'));
  else if (site.endsWith('youtube.com') || site === 'youtu.be')
    viaEmbed = await oembed('https://www.youtube.com/oembed?format=json&url=', finalUrl);
  if (viaEmbed?.text) return viaEmbed;

  const og = typeof page?.data === 'string' ? openGraph(page.data, site) : null;
  if (!og) return viaEmbed;
  return { site, text: og.text ?? viaEmbed?.text ?? null, imageUrl: og.imageUrl ?? viaEmbed?.imageUrl ?? null };
}

/** Recherche d'image Google Lens à partir d'une image en ligne (s'ouvre dans le navigateur). */
export function lensUrlFor(imageUrl: string): string {
  return `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(imageUrl)}`;
}
