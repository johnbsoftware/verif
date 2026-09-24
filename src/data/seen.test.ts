import { expect, test } from 'vitest';
import { nextSeen } from './seen';
import type { Feed } from '../types';
import { fc } from '../test/fixtures';

const a = fc({}), b = fc({}), c = fc({});
const feed = (generatedAt: string, items = [a, b], demo = false): Feed => ({ version: 1, generatedAt, sources: [], items, demo });

test('premier lancement : rien n’est « nouveau »', () => {
  const s = nextSeen(feed('2026-09-23T07:00:00Z'), null);
  expect(s.fresh).toEqual([]);
  expect(s.ids).toEqual([a.id, b.id]);
});

test('collecte suivante : seules les vérifications inédites sont nouvelles, et le restent jusqu’à la suivante', () => {
  const day1 = nextSeen(feed('2026-09-23T07:00:00Z'), null);
  const day2 = nextSeen(feed('2026-09-24T07:00:00Z', [c, a, b]), day1);
  expect(day2.fresh).toEqual([c.id]);
  expect(nextSeen(feed('2026-09-24T07:00:00Z', [c, a, b]), day2)).toBe(day2); // même collecte : inchangé
  expect(nextSeen(feed('2026-09-25T07:00:00Z', [c, a, b]), day2).fresh).toEqual([]);
});

test('flux de démonstration ignoré', () => {
  expect(nextSeen(feed('2026-09-23T07:00:00Z', [a], true), null).ids).toEqual([]);
});
