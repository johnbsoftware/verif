// Tests du collecteur : node --test collector/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyVerdict, classifyTheme, toItem, mergeItems } from './normalize.mjs';
import { collect } from './collect.mjs';

test('verdicts : les pièges d\'ordre', () => {
  const cases = {
    'Faux': 'faux', 'FAUX': 'faux', 'C’est faux': 'faux', 'Infondé': 'faux', 'Inexact': 'faux',
    'Incorrect': 'faux', 'Montage': 'faux', 'False': 'faux', 'Pants on Fire': 'faux', 'Image générée par IA': 'faux',
    'Trompeur': 'trompeur', 'Partiellement faux': 'trompeur', 'Sorti de son contexte': 'trompeur',
    'Photo sortie de son contexte': 'trompeur', 'Manque de contexte': 'trompeur', 'Exagéré': 'trompeur',
    'Vrai, mais': 'trompeur', 'Misleading': 'trompeur', 'Half True': 'trompeur', 'Plutôt faux': 'trompeur',
    'Vrai': 'vrai', 'Plutôt vrai': 'vrai', 'True': 'vrai', 'Correct': 'vrai', 'Exact': 'vrai',
    'Satire': 'autre', '': 'autre', 'Explication': 'autre',
  };
  for (const [rating, expected] of Object.entries(cases)) {
    assert.equal(classifyVerdict(rating), expected, rating);
  }
});

test('thèmes', () => {
  assert.equal(classifyTheme('Ce vaccin contre la grippe provoquerait un cancer'), 'Santé');
  assert.equal(classifyTheme('Le président a annoncé une hausse des impôts et de la retraite'), 'Économie');
  assert.equal(classifyTheme('Des images d’inondation attribuées au réchauffement'), 'Climat & catastrophes');
  assert.equal(classifyTheme('Une vidéo montre des missiles tirés sur l’Ukraine'), 'International');
  assert.equal(classifyTheme('Un chat qui joue du piano'), 'Divers');
});

const source = { site: 'factuel.afp.com', name: 'AFP Factuel', country: 'France', lang: 'fr' };
const claim = (url, date, rating = 'Faux', text = 'Une affirmation') => ({
  text, claimant: 'Réseaux sociaux', claimDate: date,
  claimReview: [
    { publisher: { name: 'Autre', site: 'autre.fr' }, url: 'https://autre.fr/x', reviewDate: date, textualRating: 'Vrai' },
    { publisher: { name: 'AFP Factuel', site: 'factuel.afp.com' }, url, title: 'Titre', reviewDate: date, textualRating: rating, languageCode: 'fr' },
  ],
});

test('toItem choisit la vérification de la source interrogée', () => {
  const it = toItem(claim('https://factuel.afp.com/doc.afp.com.1', '2026-09-20T10:00:00Z'), source);
  assert.equal(it.url, 'https://factuel.afp.com/doc.afp.com.1');
  assert.equal(it.verdict, 'faux');
  assert.equal(it.country, 'France');
  assert.equal(it.publisher, 'AFP Factuel');
  assert.equal(toItem({ text: 'x', claimReview: [] }, source), null);
  assert.equal(toItem({ text: 'x', claimReview: [{ url: 'https://a.fr', reviewDate: 'pas une date' }] }, source), null);
});

test('mergeItems dédoublonne, purge et trie', () => {
  const now = new Date('2026-09-23T06:00:00Z');
  const a = { id: 'a', reviewDate: '2026-09-20T00:00:00Z', v: 1 };
  const aBis = { id: 'a', reviewDate: '2026-09-20T00:00:00Z', v: 2 };
  const old = { id: 'o', reviewDate: '2026-06-01T00:00:00Z' };
  const b = { id: 'b', reviewDate: '2026-09-22T00:00:00Z' };
  const out = mergeItems([a, old], [aBis, b], { now, keepDays: 60 });
  assert.deepEqual(out.map((x) => x.id), ['b', 'a']);
  assert.equal(out[1].v, 2);
});

function fakeFetch(pages, calls) {
  return async (url) => {
    calls.push(url);
    const u = new URL(url);
    const site = u.searchParams.get('reviewPublisherSiteFilter');
    if (site === 'panne.fr') return { ok: false, status: 503, text: async () => 'indisponible' };
    const token = u.searchParams.get('pageToken') ?? '0';
    const body = pages[site]?.[token] ?? {};
    return { ok: true, json: async () => body };
  };
}

test('collect : pagination, source en panne, fusion avec l\'historique', async () => {
  const now = new Date('2026-09-23T06:00:00Z');
  const sources = [source, { site: 'panne.fr', name: 'En panne', country: 'France', lang: 'fr' }];
  const pages = {
    'factuel.afp.com': {
      0: { claims: [claim('https://factuel.afp.com/1', '2026-09-22T08:00:00Z')], nextPageToken: 'p2' },
      p2: { claims: [claim('https://factuel.afp.com/2', '2026-09-21T08:00:00Z', 'Trompeur')] },
    },
  };
  const calls = [];
  const previous = { items: [{ id: 'ancien', reviewDate: '2026-09-10T00:00:00Z', site: 'factuel.afp.com' }] };
  const feed = await collect({ key: 'K', sources, previous, now, fetchImpl: fakeFetch(pages, calls), log: () => {} });
  assert.equal(feed.items.length, 3);
  assert.deepEqual(feed.items.map((i) => i.verdict ?? '-'), ['faux', 'trompeur', 'autre']);
  assert.ok(calls[0].includes('maxAgeDays=7'), 'mise à jour sur 7 jours quand l\'historique existe');
  assert.equal(feed.sources[0].total, 3);
  assert.ok(feed.sources[1].error);
});

test('collect : première collecte sur 60 jours, et échec total signalé', async () => {
  const calls = [];
  await collect({ key: 'K', sources: [source], previous: { demo: true, items: [{ id: 'd', reviewDate: new Date().toISOString() }] },
    fetchImpl: fakeFetch({}, calls), log: () => {} });
  assert.ok(calls[0].includes('maxAgeDays=60'));
  await assert.rejects(collect({ key: 'K', sources: [{ site: 'panne.fr', name: 'x', country: 'France' }], previous: null,
    fetchImpl: fakeFetch({}, []), log: () => {} }));
});

test('données réelles du 23/09 : verdicts anglais et thèmes', () => {
  assert.equal(classifyVerdict('AI-generated'), 'faux');
  assert.equal(classifyVerdict('Unsubstantiated'), 'faux');
  assert.equal(classifyVerdict('Missing context'), 'trompeur');
  assert.equal(classifyTheme('Video shows Indonesia volcanic eruption in Sept 2026'), 'Climat & catastrophes');
  assert.equal(classifyTheme('Blast went off near a military base', 'Old footage of deadly blast'), 'International');
  assert.equal(classifyTheme('La bande-annonce du prochain « Avengers »'), 'Culture & sport');
  assert.equal(classifyTheme('Pakistan central bank announces discontinuation of 10-rupee banknotes'), 'Économie');
  assert.equal(classifyTheme('Une erreur de syntaxe dans un vieux texte'), 'Divers');
});

test('collect : une nouvelle source est collectée sur 60 jours même avec un historique', async () => {
  const calls = [];
  const other = { site: 'tf1info.fr', name: 'TF1', country: 'France', lang: 'fr' };
  const previous = { items: [{ id: 'x', reviewDate: new Date().toISOString(), site: 'factuel.afp.com', rating: 'Faux', claim: 'c' }] };
  await collect({ key: 'K', sources: [source, other], previous, fetchImpl: fakeFetch({}, calls), log: () => {} });
  assert.ok(calls[0].includes('maxAgeDays=7'));
  assert.ok(calls[1].includes('maxAgeDays=60'));
});

import { extractSummary, decodeEntities } from './normalize.mjs';
import { addSummaries } from './collect.mjs';

test('résumé : balises d\'aperçu, entités, longueur', () => {
  const html = `<html><head><title>x</title>
    <meta content="Cette vidéo ne montre pas les inondations de 2026 : elle a été filmée en 2019 au Pérou, selon une recherche d&#39;image inversée." property="og:description">
    <meta name="description" content="autre">`;
  assert.equal(extractSummary(html), "Cette vidéo ne montre pas les inondations de 2026 : elle a été filmée en 2019 au Pérou, selon une recherche d'image inversée.");
  assert.equal(extractSummary('<meta name="description" content="Trop court">'), null);
  assert.equal(extractSummary('<p>pas de balise</p>'), null);
  const same = '<meta property="og:description" content="Non, ces images ne montrent pas un couple fuyant le Maroc">';
  assert.equal(extractSummary(same, 'Non, ces images ne montrent pas un couple fuyant le Maroc'), null);
  const long = `<meta property="og:description" content="${'Phrase de contexte assez longue pour le test. '.repeat(15)}">`;
  assert.ok(extractSummary(long).length <= 421);
  assert.equal(decodeEntities('l&rsquo;image &amp; &laquo;vid&eacute;o&raquo;'), 'l’image & «vidéo»');
});

test('résumés : un seul essai par vérification, échecs notés null', async () => {
  const items = [
    { id: 'a', url: 'https://ok.fr/a', title: 't' },
    { id: 'b', url: 'https://ko.fr/b', title: 't' },
    { id: 'c', url: 'https://ok.fr/c', title: 't', summary: 'déjà là' },
  ];
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    if (url.includes('ko.fr')) return { ok: false, status: 403, text: async () => '' };
    return { ok: true, text: async () => '<meta property="og:description" content="Un résumé suffisamment long pour être retenu par le collecteur.">' };
  };
  await addSummaries(items, { fetchImpl, log: () => {} });
  assert.deepEqual(calls.sort(), ['https://ko.fr/b', 'https://ok.fr/a']);
  assert.equal(items[0].summary, 'Un résumé suffisamment long pour être retenu par le collecteur.');
  assert.equal(items[1].summary, null);
  assert.equal(items[2].summary, 'déjà là');
});

import { repeatsTitle } from './normalize.mjs';

test('résumé v2 : titre répété écarté, repli sur JSON-LD puis sur le chapô', () => {
  const title = 'Ces images de "braquages dans le Nord", virales sur TikTok, sont-elles réelles ?';
  assert.ok(repeatsTitle(`VÉRIF' - ${title}`, title));
  const withLd = `<meta property="og:description" content="VÉRIF' - ${title}">
    <script type="application/ld+json">{"@type":"ClaimReview","reviewBody":"Ces vidéos ont été tournées en 2021 en Belgique et ne montrent aucun braquage récent dans la métropole lilloise."}</script>`;
  assert.match(extractSummary(withLd, title), /tournées en 2021 en Belgique/);
  const withLead = `<meta property="og:description" content="${title}"><body><article>
    <p>Par la rédaction</p><p>Acceptez les cookies pour continuer votre lecture sur notre site internet ce soir.</p>
    <p>Plusieurs vidéos présentées comme des braquages filmés à Lille circulent sur TikTok. Il s'agit en réalité d'extraits d'une série policière diffusée en 2019.</p>
    </article></body>`;
  assert.match(extractSummary(withLead, title), /série policière diffusée en 2019/);
});

test('résumés v2 : les échecs de la version 1 sont retentés une fois', async () => {
  const items = [
    { id: 'a', site: 's', url: 'https://s/a', title: 't', summary: null },
    { id: 'b', site: 's', url: 'https://s/b', title: 't', summary: null, summaryV: 2 },
  ];
  const calls = [];
  await addSummaries(items, { fetchImpl: async (u) => { calls.push(u); return { ok: false, status: 403 }; }, log: () => {} });
  assert.deepEqual(calls, ['https://s/a']);
  assert.equal(items[0].summaryV, 2);
});

test('verdicts : les négations ne sont jamais classées vraies', () => {
  const cases = {
    'Pas vrai': 'faux', 'Ce n’est pas vrai': 'faux', "Ce n'est pas le cas": 'faux', 'Non avéré': 'faux',
    'Non confirmé': 'faux', 'Non fondé': 'faux', 'Pas exact': 'faux', 'Not true': 'faux', 'Not correct': 'faux',
    'Not accurate': 'faux', 'Pas du tout vrai': 'faux', "Isn't true": 'faux',
    'Partly false': 'trompeur', 'Partially true': 'trompeur', 'Mostly false': 'trompeur',
    'Pas tout à fait vrai': 'trompeur', 'Plutôt vrai': 'vrai', 'Vrai': 'vrai', 'Exact': 'vrai',
  };
  for (const [rating, expected] of Object.entries(cases)) assert.equal(classifyVerdict(rating), expected, rating);
});

import { isTransient } from './collect.mjs';

test('résumés : une panne passagère est retentée (3 essais au plus), un refus est définitif', async () => {
  assert.ok(isTransient('délai dépassé') && isTransient('erreur réseau') && isTransient('HTTP 503') && isTransient('HTTP 429'));
  assert.ok(!isTransient('HTTP 403') && !isTransient('aucun résumé dans la page'));
  const it = { id: 'a', site: 's', url: 'https://s/a', title: 't' };
  const down = async () => { throw new TypeError('fetch failed'); };
  await addSummaries([it], { fetchImpl: down, log: () => {} });
  assert.equal(it.summary, undefined);
  assert.equal(it.summaryTries, 1);
  await addSummaries([it], { fetchImpl: down, log: () => {} });
  assert.equal(it.summaryTries, 2);
  await addSummaries([it], { fetchImpl: down, log: () => {} });
  assert.equal(it.summary, null, 'abandon après le 3e essai');
  assert.equal(it.summaryTries, undefined);
  const refused = { id: 'b', site: 's', url: 'https://s/b', title: 't' };
  await addSummaries([refused], { fetchImpl: async () => ({ ok: false, status: 403 }), log: () => {} });
  assert.equal(refused.summary, null);
});

import { candidateMatcher, toItemsAnyPublisher } from './normalize.mjs';

test('présidentielle : reconnaissance du candidat dans l’auteur de l’affirmation', () => {
  const of = candidateMatcher([{ name: 'Marine Le Pen' }, { name: 'Jean-Luc Mélenchon' }, { name: 'Édouard Philippe' }, { name: 'Nicolas Dupont-Aignan' }]);
  assert.equal(of('Marine Le Pen'), 'Marine Le Pen');
  assert.equal(of('Marine Le Pen, présidente du groupe RN'), 'Marine Le Pen');
  assert.equal(of('Jean-Luc Melenchon'), 'Jean-Luc Mélenchon');
  assert.equal(of('Edouard Philippe'), 'Édouard Philippe');
  assert.equal(of('Nicolas Dupont Aignan'), 'Nicolas Dupont-Aignan');
  assert.equal(of('Jean-Marie Le Pen'), null);
  assert.equal(of('Marion Maréchal'), null);
  assert.equal(of('Des publications sur les réseaux sociaux'), null);
  assert.equal(of(null), null);
});

test('présidentielle : une déclaration trouvée par nom, gardée toute la campagne, hors plafond', async () => {
  const now = new Date('2026-09-25T05:00:00Z');
  const old = new Date('2026-03-01T10:00:00Z').toISOString();
  const pages = {
    'query=Marine+Le+Pen': {
      claims: [
        { text: 'On compte 9 millions de m² de bureaux vides', claimant: 'Marine Le Pen', claimDate: old,
          claimReview: [
            { publisher: { name: 'Les Décodeurs', site: 'lemonde.fr' }, url: 'https://www.lemonde.fr/x', title: 'T', reviewDate: old, textualRating: 'Faux', languageCode: 'fr' },
            { publisher: { name: 'AFP Factuel', site: 'factuel.afp.com' }, url: 'https://factuel.afp.com/y', title: 'T', reviewDate: old, textualRating: 'Trompeur', languageCode: 'fr' },
          ] },
        { text: 'Une photo montre Marine Le Pen au ski', claimant: 'Multiple sources', claimDate: old,
          claimReview: [{ publisher: { site: 'factuel.afp.com' }, url: 'https://factuel.afp.com/z', reviewDate: old, textualRating: 'Faux' }] },
      ],
    },
  };
  const fetchImpl = async (url) => {
    const hit = Object.entries(pages).find(([k]) => url.includes(k));
    return { ok: true, json: async () => (hit ? hit[1] : {}) };
  };
  const election = { election: 'Présidentielle 2027', candidats: [{ name: 'Marine Le Pen' }] };
  const feed = await collect({ key: 'K', sources: [source], election, previous: null, now, fetchImpl, log: () => {}, summaries: false });
  assert.equal(feed.items.length, 2, 'deux vérifications de la déclaration, pas l’affirmation « à propos » d’elle');
  assert.ok(feed.items.every((it) => it.candidate === 'Marine Le Pen'));
  assert.deepEqual(feed.items.map((it) => it.publisher).sort(), ['AFP Factuel', 'Les Décodeurs']);
  assert.equal(feed.election.candidates[0].name, 'Marine Le Pen');
  // Lendemain : l'historique (hors 60 jours, éditeur hors sources.json) est conservé.
  const next = await collect({ key: 'K', sources: [source], election, previous: feed, now: new Date('2026-09-26T05:00:00Z'),
    fetchImpl: async () => ({ ok: true, json: async () => ({}) }), log: () => {}, summaries: false });
  assert.equal(next.items.length, 2);
  // Candidat retiré de la liste : ses déclarations venues d'éditeurs hors sources.json disparaissent.
  const none = await collect({ key: 'K', sources: [source], election: { candidats: [] }, previous: next,
    fetchImpl: async () => ({ ok: true, json: async () => ({}) }), log: () => {}, summaries: false });
  assert.equal(none.items.length, 0);
  assert.equal(none.election, undefined);
});
