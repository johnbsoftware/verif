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
