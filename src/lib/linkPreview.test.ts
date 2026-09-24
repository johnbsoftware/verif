import { expect, test } from 'vitest';
import { isProfileBlurb } from './linkPreview';
import { factCheckExplorerUrl, shortQuery } from '../data/match';

test('carte de visite Facebook écartée, vrai texte de post conservé', () => {
  expect(isProfileBlurb('Francis Beck. 672 followers · 40 en parlent. Création digitale')).toBe(true);
  expect(isProfileBlurb('Mairie de Sarrebourg. 12 k mentions J’aime · 310 en parlent')).toBe(true);
  expect(isProfileBlurb('Jane Doe. 1.2K likes · 30 talking about this. Public figure')).toBe(true);
  expect(isProfileBlurb('Macron a offert 5 milliards supplémentaires à l’Europe, maintenant il veut récupérer 6 milliards sur le dos des retraités')).toBe(false);
});

test('requête courte pour Fact Check Explorer et Google', () => {
  const ocr = 'Macron a offert 5 milliards supplémentaires (argent racketté aux Français) à l’Europe antisociale et antidémocratique. Maintenant il veut récupérer 6 milliards sur le dos des retraités.';
  expect(shortQuery(ocr).split(' ')).toHaveLength(12);
  expect(factCheckExplorerUrl(ocr)).not.toContain('retrait');
});
