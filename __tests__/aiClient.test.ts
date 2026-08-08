import { suggestPack, fetchMemoryHook, fetchExplanation, NoServerError } from '@/data/aiClient';
import { resolveServerUrl, serverHeaders } from '@/config';
import type { Verse } from '@/types';

// Mock the build-time config so the tests control URL resolution and the
// shared-secret header without depending on app.json / expo-constants.
jest.mock('@/config', () => ({
  __esModule: true,
  resolveServerUrl: jest.fn(),
  serverHeaders: jest.fn((base = {}) => base),
}));

const mockResolve = resolveServerUrl as jest.Mock;
const mockHeaders = serverHeaders as jest.Mock;

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

afterEach(() => jest.clearAllMocks());

describe('aiClient with no server resolved', () => {
  beforeEach(() => mockResolve.mockReturnValue(null));

  test('throws NoServerError when there is no override and no baked-in URL', async () => {
    await expect(suggestPack(null, 'courage')).rejects.toBeInstanceOf(NoServerError);
    await expect(fetchMemoryHook('', verse)).rejects.toBeInstanceOf(NoServerError);
  });
});

describe('aiClient with a server resolved', () => {
  beforeEach(() => {
    mockResolve.mockReturnValue('https://server.example.dev');
    // Simulate a configured shared secret.
    mockHeaders.mockImplementation((base = {}) => ({ ...base, 'x-app-secret': 'shh' }));
  });

  test('posts to {base}/ai with the secret header and returns hook text', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ text: 'a vivid image of a rescue' }),
    });
    (globalThis as unknown as { fetch: jest.Mock }).fetch = fetchMock;

    const out = await fetchMemoryHook('https://server.example.dev', verse);
    expect(out).toBe('a vivid image of a rescue');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://server.example.dev/ai');
    expect(init.method).toBe('POST');
    expect(init.headers['x-app-secret']).toBe('shh');
    expect(JSON.parse(init.body)).toMatchObject({ task: 'hook', reference: 'John 3:16' });
  });

  test('suggestPack returns the references array', async () => {
    (globalThis as unknown as { fetch: jest.Mock }).fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ references: ['John 3:16', 'Romans 8:28'] }),
    });
    await expect(suggestPack('https://server.example.dev', 'love')).resolves.toEqual([
      'John 3:16',
      'Romans 8:28',
    ]);
  });

  test('surfaces the server error message on a failed request', async () => {
    (globalThis as unknown as { fetch: jest.Mock }).fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'No AI key configured.' }),
    });
    await expect(fetchExplanation('https://server.example.dev', verse)).rejects.toThrow(
      'No AI key configured.',
    );
  });
});
