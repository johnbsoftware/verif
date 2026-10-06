import { expect, test } from 'vitest';
import { extractExplanation } from './explain';

const wrap = (body: string) => `<html><head><title>t</title><script>var x = "<p>en réalité piège</p>";</script></head><body>
  <nav><p>En réalité ce menu ne compte pas</p></nav><article>${body}</article><footer><p>Copyright</p></footer></body></html>`;

test('encadré « Ce qu’il faut retenir » : ses paragraphes, dans l’ordre', () => {
  const html = wrap(`<h1>Non, cette vidéo ne montre pas les inondations de 2026</h1>
    <p>Une vidéo partagée des milliers de fois sur Facebook prétend montrer les crues de la semaine dernière.</p>
    <h2>Ce qu'il faut retenir</h2>
    <ul><li>La vidéo a été filmée en 2019 au Pérou, selon une recherche d'image inversée.</li>
    <li>Le média local qui l'a publiée à l'époque confirme le lieu et la date.</li></ul>
    <h2>Le contexte</h2><p>Autre chose.</p>`);
  expect(extractExplanation(html)).toEqual([
    "La vidéo a été filmée en 2019 au Pérou, selon une recherche d'image inversée.",
    "Le média local qui l'a publiée à l'époque confirme le lieu et la date.",
  ]);
});

test('intitulé en gras dans un paragraphe et conclusion en ligne', () => {
  const box = wrap(`<p><strong>Notre verdict</strong></p><p>Le chiffre de 5 milliards n'apparaît dans aucun document budgétaire européen.</p>`);
  expect(extractExplanation(box)[0]).toMatch(/aucun document budgétaire/);
  const inline = wrap(`<p>Introduction sans intérêt particulier pour le lecteur de ce test.</p>
    <p>En résumé : cette citation attribuée au ministre n&#39;a jamais été prononcée, aucune archive ne la mentionne.</p>`);
  expect(extractExplanation(inline)).toEqual(["cette citation attribuée au ministre n'a jamais été prononcée, aucune archive ne la mentionne."]);
});

test('sans encadré : les paragraphes qui expliquent (français et anglais), pas les autres', () => {
  const fr = wrap(`<p>Par la rédaction, publié le 3 octobre</p>
    <p>Une publication virale affirme que le gouvernement va supprimer les allocations familiales dès janvier.</p>
    <p>En réalité, aucun projet de loi ni aucun décret ne prévoit une telle mesure, selon les données du ministère.</p>
    <p>Lire aussi : notre autre article sur les allocations, en réalité très différent.</p>`);
  expect(extractExplanation(fr)).toEqual(['En réalité, aucun projet de loi ni aucun décret ne prévoit une telle mesure, selon les données du ministère.']);
  const en = wrap(`<p>Posts shared thousands of times claim the clip shows a recent missile strike on the city.</p>
    <p>The footage actually dates back to 2014 and was filmed during a fireworks festival, AFP found.</p>`);
  expect(extractExplanation(en)[0]).toMatch(/dates back to 2014/);
});

test('rien de reconnaissable : aucun extrait ; résumé déjà affiché : pas de doublon', () => {
  expect(extractExplanation(wrap('<p>Un texte quelconque, sans explication, mais assez long pour être lu par la fonction.</p>'))).toEqual([]);
  const html = wrap('<p>En réalité, cette photo date de 2015 et montre une autre manifestation, à Lyon et non à Paris.</p>');
  expect(extractExplanation(html, '', 'En réalité, cette photo date de 2015 et montre une autre manifestation')).toEqual([]);
});

test('extraits longs raccourcis à la phrase', () => {
  const long = `En réalité, ${'cette affirmation repose sur un chiffre mal compris. '.repeat(12)}`;
  const out = extractExplanation(wrap(`<p>${long}</p>`))[0];
  expect(out.length).toBeLessThanOrEqual(361);
  expect(out.endsWith('.')).toBe(true);
});
