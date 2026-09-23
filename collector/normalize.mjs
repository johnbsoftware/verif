// Fonctions pures de normalisation : aucune dépendance, aucun accès réseau.
// Utilisées par collect.mjs et testées par normalize.test.mjs.

import { createHash } from 'node:crypto';

/** Minuscules, sans accents, espaces compactés. */
export function fold(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// L'ordre compte : « partiellement faux » doit tomber dans trompeur avant que
// « faux » ne le capte, et « inexact » / « incorrect » / « infondé » dans faux
// avant que « exact » / « correct » / « fondé » ne les classent vrais.
const MISLEADING = [
  /(sorti|sortie|hors|manque|absence) de (son |leur )?contexte/, /decontextualis/, /trompeu/, /misleading/,
  /out of context/, /partiel/, /en partie/, /exager/, /imprecis/, /nuanc/, /approximati/,
  /mitig/, /\bmixed\b/, /half/, /plutot faux/, /pas tout a fait/, /incomplet/, /ambigu/,
  /premature/, /survendu/, /\bdetourne/, /\bvrai,? mais\b/, /missing context/, /needs context/,
  /\bunproven\b/, /non prouve/, /pas prouve/, /a relativiser/,
];
const FALSE = [
  /\bfaux\b/, /\bfausse/, /\bfake\b/, /\bfalse\b/, /infonde/, /inexact/, /errone/, /\bintox/,
  /mensong/, /montage/, /truque/, /manipul/, /pants on fire/, /incorrect/, /invente/,
  /sans fondement/, /arnaque/, /canular/, /\bhoax\b/, /deepfake/, /genere(e)? par (l )?ia/,
  /\bscam\b/, /\bfabricated\b/, /altered/, /\bnon,/, /\bnon\b$/, /\bwrong\b/,
  /\bai[- ]generated/, /\bai[- ]manipulated/, /unsubstantiated/, /baseless/, /no evidence/, /aucune preuve/,
];
const TRUE = [
  /\bvrai/, /\btrue\b/, /\bcorrect/, /\bexact/, /confirme/, /avere/, /\bfonde/, /accurate/, /\boui\b/,
];

/** Ramène le verdict libre de l'éditeur à faux | trompeur | vrai | autre. */
export function classifyVerdict(textualRating) {
  const r = fold(textualRating);
  if (!r) return 'autre';
  if (/satir|parodi|humour/.test(r)) return 'autre';
  if (MISLEADING.some((re) => re.test(r))) return 'trompeur';
  if (FALSE.some((re) => re.test(r))) return 'faux';
  if (TRUE.some((re) => re.test(r))) return 'vrai';
  return 'autre';
}

// Mots-clés sans accents, français et anglais. Chacun est cherché en DÉBUT de mot
// (« medic » trouve médical, médicament ; « tax » ne trouve pas « syntaxe »).
// Si un mot se termine par une espace, il doit être entier (« ia », « war »).
const THEMES = {
  'Santé': ['vaccin', 'virus', 'covid', 'sante', 'medec', 'medic', 'maladie', 'cancer', 'hopita', 'epidemi',
    'pandemi', 'grippe', 'traitement', 'vitamine', 'soin', 'infirm', 'patient', 'dent', 'regime ', 'aliment',
    'nourriture', 'ogm', 'poison', 'toxique', 'health', 'disease', 'vaccine', 'doctor', 'hospital', 'cure', 'drug',
    'mpox', 'rougeole', 'chikungunya', 'dengue', 'genetically', 'food', 'teeth', 'diet', 'parasit', 'deparasit',
    'plasma', 'moustique', 'mosquito', 'pharma'],
  'Politique': ['election', 'electoral', 'president', 'ministre', 'gouvernement', 'depute', 'senat', 'parti ',
    'vote', 'politique', 'assemblee', 'maire', 'candidat', 'elysee', 'parlement', 'referendum', 'censure',
    'rassemblement national', 'insoumis', 'macron', 'bardella', 'le pen', 'melenchon', 'trump', 'poutine', 'putin',
    'modi', 'xi jinping', 'zelensky', 'politician', 'congress', 'parliament', 'lawmaker', 'minister', 'prime minister',
    'democrat', 'republican', 'midterm', 'senator', 'government', 'leader', 'summit', 'sommet', 'brics', 'duterte',
    'loi ', 'law ', 'reglement europeen', 'union europeenne', 'visa', 'ballot', 'campagne electorale', 'campaign',
    'opposition'],
  'Climat': ['climat', 'rechauffement', 'co2', 'carbone', 'inondation', 'crue', 'secheresse', 'canicule',
    'incendie', 'feu de foret', 'meteo', 'ouragan', 'cyclone', 'tempete', 'environnement', 'pollution', 'glacier',
    'eolien', 'nucleaire', 'temperature', 'chemtrail', 'geoingenierie', 'haarp', 'volcan', 'eruption', 'seisme',
    'tremblement de terre', 'avalanche', 'glissement de terrain', 'climate', 'wildfire', 'forest fire', 'flood',
    'drought', 'hurricane', 'storm', 'volcano', 'earthquake', 'mudslide', 'landslide', 'cloud seeding', 'tsunami',
    'el nino', 'corail', 'coral', 'reef', 'abeille', 'bees', 'wildlife', 'faune'],
  'Économie': ['prix', 'inflation', 'salaire', 'impot', 'taxe ', 'retraite', 'chomage', 'economi', 'dette',
    'budget', 'carburant', 'smic', 'pib', 'banque', 'billet', 'emploi', 'pouvoir d achat', 'entreprise', 'bourse',
    'allocation', 'caf ', 'loyer', 'electricite', 'tarif', 'revenu', 'price', 'tax ', 'taxes', 'bank', 'banknote',
    'tariff', 'wage', 'salary', 'pension', 'economy', 'business', 'electricity', 'trade', 'currency', 'rupee', 'dollar'],
  'Sciences': ['science', 'scientifi', 'etude', 'chercheur', 'nasa', 'espace', 'intelligence artificielle', 'ia ',
    'robot', 'technolog', '5g', 'internet', 'satellite', 'lune', 'astronom', 'asteroide', 'smartphone', 'fossile',
    'plastique', 'research', 'study', 'scientist', 'space', 'moon', 'fossil', 'plastic', 'ammonite', 'dinosaur',
    'eclipse', 'data center', 'linky', ' ai ', 'artificial intelligence'],
  'International': ['guerre', 'ukraine', 'russie', 'israel', 'gaza', 'iran', 'chine', 'otan', 'onu ', 'armee',
    'conflit', 'frontiere', 'militaire', 'missile', 'bombard', 'frappe', 'drone', 'rebelle', 'soudan', 'syrie',
    'venezuela', 'taiwan', 'war ', 'russia', 'china', 'nato', 'army', 'military', 'warship', 'navy', 'naval',
    'attack', 'rebel', 'houthi', 'yemen', 'troops', 'airstrike', 'terror', 'blast', 'explosion', 'myanmar'],
  'Société': ['immigration', 'immigre', 'migrant', 'refugie', 'etranger', 'ecole', 'lycee', 'eleve', 'police',
    'justice', 'religion', 'islam', 'musulman', 'eglise', 'securite', 'transport', 'logement', 'agression',
    'tribunal', 'education', 'jeune', 'sncf', 'greve', 'manifestation', 'handicap', 'tiktok', 'challenge',
    'xenophob', 'racis', 'sexis', 'refugee', 'foreigner', 'residency', 'school', 'student', 'protest', 'crime',
    'religious', 'muslim', 'hindu', 'christian', 'temple', 'mosque', 'transgender', 'mariage', 'wedding'],
  'Culture & sport': ['mondial', 'fifa', 'coupe du monde', 'world cup', 'football', 'olympi', 'jo ', 'match',
    'sport', 'film', 'cinema', 'serie ', 'avengers', 'musique', 'chanteu', 'concert', 'celebrit', 'acteur', 'actrice',
    'star ', 'festival', 'musee', 'artiste', 'actor', 'actress', 'singer', 'movie', 'trailer', 'bande-annonce',
    'michael jackson', 'schwarzenegger', 'feu d artifice', 'fireworks'],
};

export const THEME_NAMES = [...Object.keys(THEMES), 'Divers'];

const escapeRe = (w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const THEME_RES = Object.entries(THEMES).map(([theme, words]) => [
  theme,
  words.map((w) => new RegExp(`(?:^|[^a-z0-9])${escapeRe(w.trimEnd())}${w.endsWith(' ') ? '(?![a-z0-9])' : ''}`)),
]);

/** Thème dominant d'après le texte de l'affirmation et le titre de l'article. */
export function classifyTheme(...texts) {
  const t = fold(texts.join(' '));
  let best = 'Divers';
  let bestScore = 0;
  for (const [theme, res] of THEME_RES) {
    let score = 0;
    for (const re of res) if (re.test(t)) score += 1;
    if (score > bestScore) { best = theme; bestScore = score; }
  }
  return best;
}

export function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}

export function idOf(url) {
  return createHash('sha1').update(String(url)).digest('hex').slice(0, 16);
}

function belongsTo(review, site) {
  const s = site.replace(/^www\./, '');
  const pub = String(review?.publisher?.site ?? '').replace(/^www\./, '');
  const host = hostOf(review?.url);
  return pub === s || pub.endsWith(`.${s}`) || host === s || host.endsWith(`.${s}`);
}

/**
 * Transforme un Claim de l'API Google Fact Check en élément du flux.
 * Retourne null si aucune vérification exploitable.
 */
export function toItem(claim, source) {
  const reviews = Array.isArray(claim?.claimReview) ? claim.claimReview : [];
  const review = reviews.find((r) => belongsTo(r, source.site)) ?? reviews[0];
  if (!review?.url || !claim?.text) return null;
  const reviewDate = review.reviewDate ?? claim.claimDate ?? null;
  if (!reviewDate || Number.isNaN(Date.parse(reviewDate))) return null;
  return {
    id: idOf(review.url),
    claim: String(claim.text).trim(),
    claimant: claim.claimant ? String(claim.claimant).trim() : null,
    claimDate: claim.claimDate ?? null,
    rating: String(review.textualRating ?? '').trim(),
    verdict: classifyVerdict(review.textualRating),
    theme: classifyTheme(claim.text, review.title ?? ''),
    country: source.country,
    lang: review.languageCode ?? source.lang,
    publisher: source.name,
    site: source.site,
    title: review.title ? String(review.title).trim() : null,
    url: review.url,
    reviewDate: new Date(reviewDate).toISOString(),
  };
}

/**
 * Fusionne l'ancien flux et les nouveaux éléments : dédoublonne par id (le plus
 * récent l'emporte), écarte ce qui dépasse keepDays, trie du plus récent au
 * plus ancien et plafonne à maxItems.
 */
export function mergeItems(previous, fresh, { now = new Date(), keepDays = 60, maxItems = 2000 } = {}) {
  const limit = now.getTime() - keepDays * 86_400_000;
  const byId = new Map();
  for (const it of [...(previous ?? []), ...(fresh ?? [])]) {
    if (!it?.id || Date.parse(it.reviewDate) < limit) continue;
    byId.set(it.id, it);
  }
  return [...byId.values()]
    .sort((a, b) => Date.parse(b.reviewDate) - Date.parse(a.reviewDate))
    .slice(0, maxItems);
}

// --- Résumé de l'article (balises d'aperçu écrites par la rédaction) ---

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', hellip: '…', laquo: '«', raquo: '»', eacute: 'é', egrave: 'è', agrave: 'à', ccedil: 'ç' };

export function decodeEntities(s) {
  return String(s)
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}

/** Lit og:description / twitter:description / description dans le HTML d'un article. */
export function extractSummary(html, title = '') {
  const metas = {};
  for (const tag of String(html).match(/<meta\b[^>]*>/gi) ?? []) {
    const attrs = {};
    for (const m of tag.matchAll(/([\w:-]+)\s*=\s*("([^"]*)"|'([^']*)')/g)) attrs[m[1].toLowerCase()] = m[3] ?? m[4] ?? '';
    const key = (attrs.property || attrs.name || '').toLowerCase();
    if (key && attrs.content && !(key in metas)) metas[key] = attrs.content;
  }
  const raw = metas['og:description'] || metas['twitter:description'] || metas['description'];
  if (!raw) return null;
  let text = decodeEntities(raw).replace(/\s+/g, ' ').trim();
  if (text.length < 40 || fold(text) === fold(title)) return null;
  if (text.length > 420) {
    const cut = text.slice(0, 420);
    const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
    text = end > 200 ? cut.slice(0, end + 1) : `${cut.replace(/\s+\S*$/, '')}…`;
  }
  return text;
}
