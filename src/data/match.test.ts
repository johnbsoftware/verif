import { describe, expect, test } from 'vitest';
import { cleanOcrText, findMatches, keywords } from './match';
import { fc } from '../test/fixtures';

const volcan = fc({ claim: "Cette vidéo montre l'éruption volcanique du mont Anak Krakatau" });
const elephant = fc({ claim: 'Une vidéo montrant un éléphant sauver un homme lors des crues au Népal' });
const dividendes = fc({ claim: "La France détient le record d'Europe des dividendes versés par les entreprises" });
const items = [volcan, elephant, dividendes];

describe('findMatches', () => {
  test('texte court : retrouve la vérification', () => {
    expect(findMatches('éruption Anak Krakatau', items)[0]?.item).toBe(volcan);
  });

  test('post long contenant l’affirmation (bug de la 1.1.1 : aucun résultat)', () => {
    const post = `Incroyable, regardez ça !!! ${volcan.claim}. Partagez avant que ce soit supprimé, les médias ne vous le
      diront jamais. Ils nous cachent la vérité depuis des années, réveillez-vous les amis, faites tourner à tous vos
      contacts et à votre famille. On nous prend vraiment pour des idiots dans ce pays.`;
    expect(keywords(post).length).toBeGreaterThan(15);
    expect(findMatches(post, items).map((m) => m.item)).toEqual([volcan]);
  });

  test('texte lu sur une capture (600 caractères) : retrouve la bonne vérification en tête', () => {
    const ocr = cleanOcrText(`Jean Dupont\n2 h\nUn éléphant sauve un homme pendant les crues au Népal, quel héros !\n${'Bravo à cet animal extraordinaire qui a montré plus de courage que nos dirigeants. '.repeat(5)}\n1,2 k J'aime\nCommenter\nPartager`);
    expect(findMatches(ocr, items)[0]?.item).toBe(elephant);
  });

  test('long texte sans rapport : aucun rapprochement fortuit', () => {
    const other = 'Recette de la tarte aux mirabelles de Lorraine : étalez la pâte, disposez les fruits dénoyautés, saupoudrez de sucre et enfournez quarante minutes à four chaud. Servez tiède avec une boule de glace vanille.';
    expect(findMatches(other, items)).toEqual([]);
  });
});
