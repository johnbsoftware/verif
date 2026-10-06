import { fold } from '../data/filters';

// « Pourquoi ? » : passages de l'article qui justifient le verdict, cités mot pour mot.
// 1. Un encadré de conclusion (« Ce qu'il faut retenir », « En résumé », « Notre verdict »…) ;
// 2. à défaut, les paragraphes qui expliquent (« en réalité », « cette vidéo date de », « aucune preuve »…).
// Fonction pure (pas de DOM) : testée sur des pages d'exemple, utilisable partout.

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“',
  hellip: '…', laquo: '«', raquo: '»', eacute: 'é', egrave: 'è', ecirc: 'ê', agrave: 'à', acirc: 'â', ccedil: 'ç',
  ocirc: 'ô', ucirc: 'û', ugrave: 'ù', icirc: 'î', iuml: 'ï', euml: 'ë', oelig: 'œ', ndash: '–', mdash: '—',
};

function decode(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}

const text = (html: string) => decode(html.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

/** Intitulés d'encadrés de conclusion (comparés sans accents ni majuscules). */
const HEADING =
  /^(ce qu.il faut retenir|a retenir|les points cles|l.essentiel|en resume|en bref|resume|notre verdict|le verdict|verdict|notre conclusion|conclusion|en conclusion|ce que l.on sait|what we found|the bottom line|bottom line|our ruling|the verdict|in summary|summary|conclusion)\s*:?$/;

/** Formules qui annoncent une explication. */
const MARKERS = [
  /\ben realite\b/, /\ben fait\b/, /\bil s.agit (en realite |en fait )?(d.une?|de|du)\b/, /\bcontrairement a\b/,
  /\bn.a (jamais|pas) (ete|dit|declare|annonce)\b/, /\baucune? (preuve|trace|element|source|etude|document)\b/,
  /\bdate(nt)? (en realite )?de (19|20)\d\d\b/, /\ba ete (tourne|filme|prise?|publiee?|realisee?|genere)/,
  /\bsortie? de (son|leur) contexte\b/, /\bdetourne/, /\bmontage\b/, /\bgenere(e)?s? (par|avec) (l.)?(ia|intelligence)/,
  /\bselon (les|le|la|l.)\b.*\b(chiffres|donnees|insee|ministere|rapport|etude)\b/, /\bc.est faux\b/, /\bc.est inexact\b/,
  /\brien ne prouve\b/, /\bne montre pas\b/, /\bne correspond pas\b/, /\bin fact\b/, /\bactually\b/, /\bno evidence\b/,
  /\bwas (filmed|taken|recorded|published|created|generated)\b/, /\bdates? (back )?(from|to) (19|20)\d\d\b/,
  /\bout of context\b/, /\bai.generated\b/, /\bdoes not show\b/, /\bthere is no\b/, /\bthis is false\b/,
];

const SKIP = /^(par |publi|mis a jour|updated|by |lire aussi|a lire|voir aussi|read more|related|abonnez|inscrivez|newsletter|partager|share|copyright|tous droits|photo |credit|©)/;

const shorten = (t: string, max = 360) => {
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  return end > 120 ? cut.slice(0, end + 1) : `${cut.replace(/\s+\S*$/, '')}…`;
};

interface Block { tag: string; text: string }

function blocks(html: string): Block[] {
  let zone = /<article\b[\s\S]*?<\/article>/i.exec(html)?.[0] ?? /<main\b[\s\S]*?<\/main>/i.exec(html)?.[0]
    ?? /<body\b[\s\S]*<\/body>/i.exec(html)?.[0] ?? html;
  zone = zone.replace(/<(script|style|noscript|aside|nav|footer|figure|form|button|svg)\b[\s\S]*?<\/\1>/gi, ' ');
  const out: Block[] = [];
  for (const m of zone.matchAll(/<(h[2-4]|p|li)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
    const t = text(m[2]);
    if (t) out.push({ tag: m[1].toLowerCase(), text: t });
  }
  return out;
}

const usable = (t: string, title: string, min = 50) => {
  const f = fold(t);
  return t.length >= min && t.length <= 900 && !SKIP.test(f) && fold(title).trim() !== f.trim();
};

const isHeading = (b: Block) => {
  const f = fold(b.text).replace(/[«»"“”]/g, '').trim();
  return (b.tag.startsWith('h') || b.text.length <= 40) && HEADING.test(f);
};

/** Un paragraphe « En résumé : … » ou « Notre verdict : … » : on garde ce qui suit les deux-points. */
function inlineConclusion(t: string): string | null {
  const m = /^(en resume|en bref|notre verdict|verdict|conclusion|en conclusion|ce qu.il faut retenir|the bottom line|bottom line|in summary|what we found)\s*[:—–-]\s*/.exec(fold(t));
  return m ? t.slice(m[0].length).trim() : null;
}

/**
 * Jusqu'à `max` extraits (mot pour mot, raccourcis à ~360 caractères) qui justifient le verdict,
 * ou [] si l'article n'en contient pas de reconnaissable. `exclude` : texte déjà affiché (résumé).
 */
export function extractExplanation(html: string, title = '', exclude = '', max = 3): string[] {
  const all = blocks(html);
  const already = fold(exclude).slice(0, 80);
  const keep = (t: string) => !already || !fold(t).startsWith(already);

  // 1. Encadré de conclusion : les paragraphes qui suivent son intitulé.
  for (let i = 0; i < all.length; i++) {
    if (!isHeading(all[i])) continue;
    const found: string[] = [];
    for (let j = i + 1; j < all.length && found.length < max; j++) {
      if (all[j].tag.startsWith('h') || isHeading(all[j])) break;
      if (usable(all[j].text, title, 25) && keep(all[j].text)) found.push(shorten(all[j].text));
    }
    if (found.length) return found;
  }
  // 2. Conclusion en ligne (« En résumé : … »).
  for (const b of all) {
    const rest = inlineConclusion(b.text);
    if (rest && rest.length >= 40) return [shorten(rest)];
  }
  // 3. Paragraphes explicatifs, dans l'ordre de l'article (les deux premiers).
  const found: string[] = [];
  for (const b of all) {
    if (b.tag !== 'p' && b.tag !== 'li') continue;
    if (!usable(b.text, title, 70) || !keep(b.text)) continue;
    const f = fold(b.text);
    if (MARKERS.some((re) => re.test(f))) found.push(shorten(b.text));
    if (found.length >= Math.min(2, max)) break;
  }
  return found;
}
