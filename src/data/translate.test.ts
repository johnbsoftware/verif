import { expect, test } from 'vitest';
import { applyTranslation, fromTexts, pruneCache, stripTranslation, toTexts } from './translate';
import { applyFilters } from './filters';
import { fc } from '../test/fixtures';
import type { Settings } from '../types';

const en = fc({ lang: 'en', claim: 'Video shows a volcano erupting in Indonesia', title: 'Old footage', rating: 'False', summary: 'This clip dates from 2019.' });

test('traduction : textes remplacés, original conservé, aller-retour fidèle', () => {
  const out = ['Une vidéo montre un volcan en éruption en Indonésie', 'Vieilles images', 'Faux', 'Ce clip date de 2019.'];
  expect(toTexts(en)).toHaveLength(4);
  const shown = applyTranslation(en, fromTexts(en, out));
  expect(shown.claim).toBe(out[0]);
  expect(shown.rating).toBe('Faux');
  expect(shown.original?.claim).toBe(en.claim);
  expect(stripTranslation(shown)).toEqual(en);
  expect(applyTranslation(en, undefined)).toBe(en);
});

test('recherche : en français comme en anglais', () => {
  const shown = applyTranslation(en, fromTexts(en, ['Une vidéo montre un volcan en éruption', '', 'Faux', '']));
  const settings: Settings = { countries: [], themes: [], dailyDigest: false, english: true, grouped: true, theme: 'system', translate: true };
  const q = (search: string) => applyFilters([shown], { settings, theme: 'Tout', verdict: 'tous', search }).length;
  expect(q('éruption')).toBe(1);
  expect(q('erupting')).toBe(1);
});

test('cache limité aux vérifications utiles', () => {
  const t = fromTexts(en, ['a', '', 'b', '']);
  expect(Object.keys(pruneCache({ x: t, y: t }, new Set(['y'])))).toEqual(['y']);
});
