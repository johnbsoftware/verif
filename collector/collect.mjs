#!/usr/bin/env node
// Collecte quotidienne : interroge l'API Google Fact Check Tools pour chaque
// organisme de sources.json, normalise, fusionne avec le flux précédent et
// écrit feed.json.
//
// Usage :
//   node collector/collect.mjs --out public/feed.json
// Clé API : variable FACTCHECK_API_KEY, ou ligne FACTCHECK_API_KEY=... dans .env
// Flux précédent (pour garder l'historique) : --previous <fichier ou URL>
// ou variable PREVIOUS_FEED_URL. Absent : première collecte sur 60 jours.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { toItem, mergeItems, classifyVerdict, classifyTheme, extractSummary } from './normalize.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const API = 'https://factchecktools.googleapis.com/v1alpha1/claims:search';

const PAGE_SIZE = 50;
const MAX_PAGES = 6;
const DAILY_WINDOW_DAYS = 7; // l'indexation Google peut avoir quelques jours de retard
const FIRST_WINDOW_DAYS = 60;
const KEEP_DAYS = 60;
const SUMMARY_CONCURRENCY = 4;
const SUMMARY_BUDGET_MS = 4 * 60 * 1000; // au-delà, on s'arrête : le reste sera fait demain
// Certains sites refusent les navigateurs inconnus : on se présente comme un navigateur mobile, en signant.
const USER_AGENT = 'Mozilla/5.0 (Linux; Android 16; Pixel) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36 VerifBot/1.0';
// À incrémenter quand l'extraction s'améliore : les articles sans résumé sont alors relus une fois.
export const SUMMARY_VERSION = 2;

function args(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    if (argv[i].startsWith('--')) out[argv[i].slice(2)] = argv[i + 1]?.startsWith('--') ? true : argv[++i] ?? true;
  }
  return out;
}

/** Décode un fichier texte UTF-8 ou UTF-16 (ce qu'écrit « echo > .env » sous Windows PowerShell). */
function decodeText(buf) {
  if (buf[0] === 0xff && buf[1] === 0xfe) return buf.subarray(2).toString('utf16le');
  if (buf[0] === 0xfe && buf[1] === 0xff) return Buffer.from(buf.subarray(2)).swap16().toString('utf16le');
  return buf.toString('utf8').replace(/^﻿/, '');
}

export async function readKey() {
  if (process.env.FACTCHECK_API_KEY) return { key: process.env.FACTCHECK_API_KEY.trim() };
  const root = resolve(HERE, '..');
  // .env.txt : Bloc-notes ajoute souvent l'extension sans qu'on la voie.
  for (const name of ['.env', '.env.txt']) {
    let text;
    try { text = decodeText(await readFile(resolve(root, name))); } catch { continue; }
    const m = text.match(/^\s*FACTCHECK_API_KEY\s*=\s*["']?([^"'\s]+)["']?/m);
    if (m && !m[1].startsWith('collez_')) return { key: m[1] };
    return { problem: m ? `${name} contient encore « collez_votre_cle_ici » : remplacez-le par votre clé.`
      : `${name} trouvé dans ${root}, mais sans ligne FACTCHECK_API_KEY=... lisible.` };
  }
  return { problem: `Aucun fichier .env dans ${root}.` };
}

async function loadPrevious(where, fetchImpl) {
  if (!where) return null;
  try {
    if (/^https?:\/\//.test(where)) {
      const res = await fetchImpl(where, { headers: { 'cache-control': 'no-cache' } });
      if (!res.ok) return null;
      return await res.json();
    }
    return JSON.parse(await readFile(where, 'utf8'));
  } catch {
    return null;
  }
}

/** Télécharge l'article et en extrait le résumé écrit par la rédaction. */
export async function fetchSummary(item, fetchImpl) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12_000);
  try {
    const res = await fetchImpl(item.url, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: {
        'user-agent': USER_AGENT,
        'accept-language': 'fr-FR,fr;q=0.9,en;q=0.6',
        accept: 'text/html,application/xhtml+xml',
      },
    });
    if (!res.ok) return { summary: null, reason: `HTTP ${res.status}` };
    if (typeof res.text !== 'function') return { summary: null, reason: 'réponse illisible' };
    const html = (await res.text()).slice(0, 600_000);
    const summary = extractSummary(html, item.title ?? '');
    return { summary, reason: summary ? 'ok' : 'aucun résumé dans la page' };
  } catch (e) {
    return { summary: null, reason: e?.name === 'AbortError' ? 'délai dépassé' : 'erreur réseau' };
  } finally {
    clearTimeout(timer);
  }
}

const MAX_SUMMARY_TRIES = 3;
/** Échec qui mérite une nouvelle tentative : délai, réseau, erreur serveur ou limitation (429). */
export const isTransient = (reason) => reason === 'délai dépassé' || reason === 'erreur réseau' || /^HTTP (5\d\d|429|408)$/.test(reason);

const needsSummary = (it) => it.summary === undefined || (it.summary === null && (it.summaryV ?? 1) < SUMMARY_VERSION);

/**
 * Ajoute le résumé aux vérifications qui n'en ont pas encore. Un échec est noté
 * summary: null (avec summaryV) : il ne sera retenté qu'après une amélioration de l'extraction.
 * Affiche le bilan par organisme et par cause d'échec.
 */
export async function addSummaries(items, { fetchImpl = fetch, log = console.log, budgetMs = SUMMARY_BUDGET_MS } = {}) {
  const todo = items.filter(needsSummary);
  if (!todo.length) return 0;
  const start = Date.now();
  const bySite = new Map();
  let done = 0;
  let found = 0;
  const worker = async () => {
    while (todo.length && Date.now() - start < budgetMs) {
      const it = todo.shift();
      const { summary, reason } = await fetchSummary(it, fetchImpl);
      if (!summary && isTransient(reason) && (it.summaryTries ?? 0) + 1 < MAX_SUMMARY_TRIES) {
        // Panne passagère (délai, réseau, serveur saturé) : on retentera à la prochaine collecte.
        it.summaryTries = (it.summaryTries ?? 0) + 1;
        delete it.summary;
      } else {
        it.summary = summary;
        it.summaryV = SUMMARY_VERSION;
        delete it.summaryTries;
      }
      done++;
      if (summary) found++;
      const st = bySite.get(it.site) ?? { ok: 0, total: 0, reasons: {} };
      st.total++;
      if (summary) st.ok++;
      else st.reasons[reason] = (st.reasons[reason] ?? 0) + 1;
      bySite.set(it.site, st);
    }
  };
  await Promise.all(Array.from({ length: SUMMARY_CONCURRENCY }, worker));
  for (const [site, st] of bySite) {
    const why = Object.entries(st.reasons).map(([r, n]) => `${r} ×${n}`).join(', ');
    log(`  ${String(site ?? "?").padEnd(28)} ${String(st.ok).padStart(4)} / ${String(st.total).padEnd(4)} ${why}`);
  }
  log(`Résumés : ${found} trouvés sur ${done} articles lus${todo.length ? ` (${todo.length} reportés à la prochaine collecte)` : ''}`);
  return found;
}

async function searchSite(source, { key, maxAgeDays, fetchImpl, log }) {
  const claims = [];
  let pageToken;
  for (let page = 0; page < MAX_PAGES; page++) {
    const q = new URLSearchParams({
      reviewPublisherSiteFilter: source.site,
      maxAgeDays: String(maxAgeDays),
      pageSize: String(PAGE_SIZE),
      key,
    });
    if (pageToken) q.set('pageToken', pageToken);
    const res = await fetchImpl(`${API}?${q}`);
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status} ${body.slice(0, 200)}`);
    }
    const data = await res.json();
    claims.push(...(data.claims ?? []));
    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }
  log(`  ${source.name.padEnd(34)} ${String(claims.length).padStart(4)} affirmations`);
  return claims;
}

export async function collect({ key, sources, previous, now = new Date(), fetchImpl = fetch, log = console.log, summaries = true }) {
  const hadHistory = Array.isArray(previous?.items) && previous.items.length > 0 && !previous.demo;
  // Un organisme absent de l'historique (nouvelle source) est collecté sur toute la période.
  const knownSites = new Set(hadHistory ? previous.items.map((it) => it.site) : []);
  const windowFor = (source) => (knownSites.has(source.site) ? DAILY_WINDOW_DAYS : FIRST_WINDOW_DAYS);
  log(hadHistory ? `Mise à jour (${DAILY_WINDOW_DAYS} jours, ${FIRST_WINDOW_DAYS} pour les nouvelles sources)`
    : `Première collecte sur ${FIRST_WINDOW_DAYS} jours`);

  const fresh = [];
  const report = [];
  let failures = 0;
  for (const source of sources) {
    try {
      const claims = await searchSite(source, { key, maxAgeDays: windowFor(source), fetchImpl, log });
      const items = claims.map((c) => toItem(c, source)).filter(Boolean);
      fresh.push(...items);
      report.push({ ...source, fetched: items.length });
    } catch (err) {
      failures++;
      log(`  ${source.name.padEnd(34)} ÉCHEC : ${err.message}`);
      report.push({ ...source, fetched: 0, error: err.message });
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  if (failures === sources.length) throw new Error('Toutes les sources ont échoué — clé API invalide ou quota dépassé ?');

  // Les règles de classement évoluent : on reclasse aussi l'historique à chaque collecte,
  // et on écarte les éléments d'organismes retirés de sources.json.
  const sites = new Set(sources.map((s) => s.site));
  const history = (hadHistory ? previous.items : [])
    .filter((it) => sites.has(it.site))
    .map((it) => ({ ...it, verdict: classifyVerdict(it.rating), theme: classifyTheme(it.claim, it.title ?? '') }));
  // Une vérification déjà connue garde son résumé (la nouvelle version de l'API n'en a pas).
  const known = new Map(history.map((it) => [it.id, it]));
  for (const it of fresh) {
    const old = known.get(it.id);
    if (old && old.summary !== undefined) {
      it.summary = old.summary;
      if (old.summaryV !== undefined) it.summaryV = old.summaryV;
    }
  }
  const items = mergeItems(history, fresh, { now, keepDays: KEEP_DAYS });
  if (summaries) await addSummaries(items, { fetchImpl, log });
  const counts = Object.fromEntries(sources.map((s) => [s.site, 0]));
  for (const it of items) counts[it.site] = (counts[it.site] ?? 0) + 1;

  return {
    version: 1,
    generatedAt: now.toISOString(),
    keepDays: KEEP_DAYS,
    sources: report.map(({ site, name, country, lang, fetched, error }) => ({
      site, name, country, lang, fetchedToday: fetched, total: counts[site] ?? 0, ...(error ? { error } : {}),
    })),
    items,
  };
}

async function main() {
  const a = args(process.argv);
  const out = resolve(a.out ?? 'public/feed.json');
  const { key, problem } = await readKey();
  if (!key) {
    if (process.env.GITHUB_ACTIONS) {
      console.error('Clé API manquante : le secret FACTCHECK_API_KEY est absent ou vide.');
      console.error('À créer dans Settings > Secrets and variables > Actions > onglet « Secrets » (pas « Variables »),');
      console.error('bouton « New repository secret », nom exact : FACTCHECK_API_KEY');
      process.exit(2);
    }
    console.error(`Clé API manquante. ${problem}`);
    console.error('Le fichier .env doit contenir une seule ligne : FACTCHECK_API_KEY=AIza...');
    process.exit(2);
  }
  const { sources } = JSON.parse(await readFile(resolve(HERE, 'sources.json'), 'utf8'));
  const previous = await loadPrevious(a.previous ?? process.env.PREVIOUS_FEED_URL ?? out, fetch);
  const feed = await collect({ key, sources, previous });
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, JSON.stringify(feed));
  console.log(`\n${feed.items.length} vérifications écrites dans ${out}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => { console.error(err.message); process.exit(1); });
}
