import { expect, test } from 'vitest';
import { checkersSearchUrl, explorerUrl, keyTerms } from './terms';

test('mots-clés : noms propres, chiffres et mots rares, dans l’ordre du texte', () => {
  const ocr = "Macron a offert 5 milliards supplémentaires (argent racketté aux Français) à l'Europe antisociale et antidémocratique. Maintenant il veut récupérer 6 milliards sur le dos des retraités.";
  const t = keyTerms(ocr);
  expect(t).toHaveLength(5);
  expect(t).toContain('Macron');
  expect(t).toContain('Europe');
  expect(t.some((w) => /^\d$/.test(w))).toBe(true);
  expect(t).not.toContain('Maintenant');
  expect(keyTerms('Regardez cette vidéo incroyable du mont Anak Krakatau https://x.com/a/1')).toEqual(['mont', 'Anak', 'Krakatau']);
});

test('liens : Explorer reçoit les mots-clés, Google cible les sites des vérificateurs', () => {
  expect(explorerUrl(['Macron', 'retraités'])).toContain('Macron%20retrait');
  const g = decodeURIComponent(checkersSearchUrl(['Macron', 'milliards']));
  expect(g).toContain('Macron milliards (site:factuel.afp.com OR site:tf1info.fr');
  expect(g).toContain('site:lemonde.fr/les-decodeurs');
});
