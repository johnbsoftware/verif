import { expect, test } from 'vitest';
import { socialLabel, socialOf } from './social';
import { fc } from '../test/fixtures';

test('« compte » au sens de dénombrer n’est pas un indice de réseau social', () => {
  expect(socialOf(fc({ claimant: 'Marine Le Pen', claim: 'On compte en France 9 millions de mètres carrés de bureaux inutilisés' })).social).toBe(false);
  expect(socialOf(fc({ claimant: null, claim: 'La France compte sept millions de bénéficiaires en trop' })).social).toBe(false);
  expect(socialOf(fc({ claimant: 'Un ministre', claim: 'La publication d’une étude sur les retraites' })).social).toBe(false);
});

test('auteur générique (« Multiple sources ») = posts viraux', () => {
  expect(socialOf(fc({ claimant: 'Multiple sources', claim: 'Refugees who give birth in S. Korea will be given residency status.' })).social).toBe(true);
  expect(socialOf(fc({ claimant: 'Sources multiples', claim: 'Le Mébendazole breveté pour traiter les tumeurs' })).social).toBe(true);
});

test('plateformes nommées', () => {
  expect(socialLabel(fc({ claimant: 'Compte TikTok', claim: 'Une vidéo' }))).toBe('Vu sur TikTok');
  expect(socialLabel(fc({ claimant: 'Publications X', claim: 'Des robots s’enfuient' }))).toBe('Vu sur X');
  expect(socialLabel(fc({ claimant: 'Eric Coquerel', claim: 'La France détient le record des dividendes' }))).toBeNull();
});
