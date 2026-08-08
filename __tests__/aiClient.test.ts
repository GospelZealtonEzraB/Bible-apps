import { suggestPack, fetchMemoryHook, NoServerError } from '@/data/aiClient';
import type { Verse } from '@/types';

const verse: Verse = {
  id: 'web:john 3:16',
  reference: 'John 3:16',
  text: 'For God so loved the world...',
  translation: 'web',
  dateAdded: 0,
  status: 'new',
  srs: { repetitions: 0, interval: 0, easeFactor: 2.5, dueDate: 0 },
  mastery: 0,
};

describe('aiClient without a server', () => {
  test('throws NoServerError when serverUrl is missing', async () => {
    await expect(suggestPack(null, 'courage')).rejects.toBeInstanceOf(NoServerError);
    await expect(fetchMemoryHook('', verse)).rejects.toBeInstanceOf(NoServerError);
    await expect(fetchMemoryHook('   ', verse)).rejects.toBeInstanceOf(NoServerError);
  });
});
