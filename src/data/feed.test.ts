import { expect, test } from 'vitest';
import { isStale, migrateItem } from './feed';
import type { Feed } from '../types';
import { fc } from '../test/fixtures';

const at = (iso: string, demo = false): Feed => ({ version: 1, generatedAt: iso, sources: [], items: [], demo });

test('flux en panne au-delà de 36 h', () => {
  const now = Date.parse('2026-09-24T09:00:00Z');
  expect(isStale(at('2026-09-24T04:40:00Z'), now)).toBe(false);
  expect(isStale(at('2026-09-23T04:40:00Z'), now)).toBe(false);
  expect(isStale(at('2026-09-22T19:00:00Z'), now)).toBe(true);
  expect(isStale(at('2026-09-01T04:40:00Z', true), now)).toBe(false); // démonstration
  expect(isStale(null, now)).toBe(false);
});

test('thème renommé : « Climat » → « Climat & catastrophes »', () => {
  expect(migrateItem(fc({ theme: 'Climat' })).theme).toBe('Climat & catastrophes');
  const it = fc({ theme: 'Santé' });
  expect(migrateItem(it)).toBe(it);
});
