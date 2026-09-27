#!/usr/bin/env node
// Découverte : quels éditeurs francophones Google Fact Check recense-t-il vraiment ?
// Lance des recherches génériques en français et compte les vérifications par site.
// Usage : npm run discover            (clé lue comme pour npm run collect)

import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readKey } from './collect.mjs';
import { hostOf } from './normalize.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const API = 'https://factchecktools.googleapis.com/v1alpha1/claims:search';
const QUERIES = ['faux', 'vidéo', 'photo', 'image', 'vaccin', 'guerre', 'climat', 'élection', 'gouvernement',
  'président', 'prix', 'police', 'Ukraine', 'Israël', 'immigration', 'santé', 'intelligence artificielle', 'France',
  // Francophonie : médias belges (RTBF Faky, Le Soir), suisses (RTS), québécois (Radio-Canada Décrypteurs), africains.
  'Belgique', 'Bruxelles', 'Wallonie', 'Suisse', 'Genève', 'Québec', 'Canada', 'Sénégal', "Côte d'Ivoire", 'Cameroun',
  'Maroc', 'Algérie', 'Tunisie', 'Afrique', 'Europe', 'Russie', 'TikTok', 'Facebook', 'arnaque', 'montage', 'intox'];

/** Pays probable d'après l'extension du site (à vérifier avant d'ajouter la source). */
function countryOf(site) {
  const tld = site.split('.').pop();
  return { fr: 'France', be: 'Belgique', ch: 'Suisse', ca: 'Canada', sn: 'Sénégal', ci: "Côte d'Ivoire", cm: 'Cameroun',
    ma: 'Maroc', dz: 'Algérie', tn: 'Tunisie', cd: 'RD Congo', bf: 'Burkina Faso', ml: 'Mali', lu: 'Luxembourg' }[tld] ?? 'International';
}
const MAX_AGE_DAYS = 90;

const { key, problem } = await readKey();
if (!key) { console.error(`Clé API manquante. ${problem}`); process.exit(2); }

const { sources } = JSON.parse(await readFile(resolve(HERE, 'sources.json'), 'utf8'));
const known = new Set(sources.map((s) => s.site));
const found = new Map(); // site -> { name, urls:Set }

for (const query of QUERIES) {
  let pageToken;
  for (let page = 0; page < 2; page++) {
    const q = new URLSearchParams({ query, languageCode: 'fr', maxAgeDays: String(MAX_AGE_DAYS), pageSize: '50', key });
    if (pageToken) q.set('pageToken', pageToken);
    const res = await fetch(`${API}?${q}`);
    if (!res.ok) { console.error(`« ${query} » : HTTP ${res.status}`); break; }
    const data = await res.json();
    for (const claim of data.claims ?? []) {
      for (const r of claim.claimReview ?? []) {
        const site = (r.publisher?.site || hostOf(r.url)).replace(/^www\./, '');
        if (!site) continue;
        const entry = found.get(site) ?? { name: r.publisher?.name ?? '?', urls: new Set(), sample: r.url };
        entry.urls.add(r.url);
        found.set(site, entry);
      }
    }
    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }
  process.stdout.write('.');
}

const rows = [...found.entries()].sort((a, b) => b[1].urls.size - a[1].urls.size);
console.log(`\n\nÉditeurs trouvés en français sur ${MAX_AGE_DAYS} jours (* = déjà dans sources.json) :\n`);
for (const [site, e] of rows) {
  console.log(`${known.has(site) ? '*' : ' '} ${String(e.urls.size).padStart(4)}  ${site.padEnd(30)} ${e.name}`);
}
const fresh = rows.filter(([site, e]) => !known.has(site) && e.urls.size >= 2);
if (fresh.length) {
  console.log('\nNouveaux éditeurs (au moins 2 vérifications) — lignes prêtes à coller dans collector/sources.json :\n');
  for (const [site, e] of fresh) {
    console.log(`    ${JSON.stringify({ site, name: e.name, country: countryOf(site), lang: 'fr' })},`);
  }
  console.log('\nVérifiez le nom et le pays, collez les lignes voulues dans "sources", puis npm run collect.');
} else {
  console.log('\nAucun nouvel éditeur francophone : sources.json est à jour.');
}

// --- 2e partie : vérificateurs francophones connus, testés un par un -------------------------
// Signataires IFCN / EFCSN ou rubriques de grands médias. Seuls ceux qui publient le balisage
// ClaimReview sont recensés par Google : c'est ce que ce test vérifie.
const CANDIDATES = [
  { site: 'francetvinfo.fr', name: 'Vrai ou Fake (franceinfo)', country: 'France' },
  { site: 'lemonde.fr', name: 'Les Décodeurs (Le Monde)', country: 'France' },
  { site: 'liberation.fr', name: 'CheckNews (Libération)', country: 'France' },
  { site: 'lessurligneurs.eu', name: 'Les Surligneurs', country: 'France' },
  { site: 'observers.france24.com', name: 'Les Observateurs (France 24)', country: 'France' },
  { site: 'sciencefeedback.co', name: 'Science Feedback', country: 'France' },
  { site: 'rtbf.be', name: 'Faky (RTBF)', country: 'Belgique' },
  { site: 'ici.radio-canada.ca', name: 'Les Décrypteurs (Radio-Canada)', country: 'Canada' },
  { site: 'sciencepresse.qc.ca', name: 'Détecteur de rumeurs (Agence Science-Presse)', country: 'Canada' },
  { site: 'rts.ch', name: 'RTS', country: 'Suisse' },
  { site: 'africacheck.org', name: 'Africa Check', country: 'Afrique' },
  { site: 'pesacheck.org', name: 'PesaCheck', country: 'Afrique' },
  { site: 'congocheck.net', name: 'Congo Check', country: 'RD Congo' },
];

async function countSite(site) {
  let n = 0;
  let pageToken;
  for (let page = 0; page < 4; page++) {
    const q = new URLSearchParams({ reviewPublisherSiteFilter: site, maxAgeDays: String(MAX_AGE_DAYS), pageSize: '50', key });
    if (pageToken) q.set('pageToken', pageToken);
    const res = await fetch(`${API}?${q}`);
    if (!res.ok) return `HTTP ${res.status}`;
    const data = await res.json();
    n += (data.claims ?? []).length;
    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }
  return n;
}

console.log(`\nVérificateurs francophones testés un par un (vérifications sur ${MAX_AGE_DAYS} jours) :\n`);
const toAdd = [];
for (const c of CANDIDATES) {
  const n = await countSite(c.site);
  const mark = known.has(c.site) ? '*' : ' ';
  console.log(`${mark} ${String(n).padStart(4)}  ${c.site.padEnd(28)} ${c.name}`);
  if (typeof n === 'number' && n >= 3 && !known.has(c.site)) toAdd.push(c);
}
if (toAdd.length) {
  console.log('\nÀ ajouter (au moins 3 vérifications) — lignes prêtes à coller dans collector/sources.json :\n');
  for (const c of toAdd) console.log(`    ${JSON.stringify({ site: c.site, name: c.name, country: c.country, lang: 'fr' })},`);
}

console.log('\nSources actuelles de sources.json :\n');
for (const s of sources) {
  const n = await countSite(s.site);
  console.log(`  ${String(n).padStart(4)}  ${s.site.padEnd(28)} ${s.name}${n === 0 ? '   ← aucune vérification en 90 jours : à retirer ?' : ''}`);
}
