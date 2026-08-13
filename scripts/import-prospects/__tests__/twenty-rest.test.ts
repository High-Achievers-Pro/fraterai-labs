import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTwentyClient } from '../twenty-rest';

const respondWith = (payload: unknown) => {
  const fetchMock = vi.fn(async (..._args: unknown[]) => new Response(JSON.stringify(payload), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

describe('twenty-rest findByFilter', () => {
  beforeEach(() => {
    vi.stubEnv('TWENTY_API_KEY', 'test-key');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('returns the first record when the response has the expected shape', async () => {
    respondWith({ data: { companies: [{ id: 'c1', name: 'Acme Co' }, { id: 'c2' }] } });
    const record = await createTwentyClient().findByFilter('companies', 'name[eq]:Acme Co');
    expect(record?.id).toBe('c1');
  });

  it('returns null when the collection is present but empty', async () => {
    respondWith({ data: { companies: [] } });
    expect(await createTwentyClient().findByFilter('companies', 'name[eq]:Nope')).toBeNull();
  });

  // A silent null here means every lookup misses, every record is created
  // afresh, and a second run duplicates the whole import — reported as a
  // clean run with zero failures. The filter grammar is unverified against a
  // live server, so this is the failure mode most likely to actually happen.
  it('throws instead of reporting "not found" when the collection key is missing', async () => {
    respondWith({ data: { people: [] } });
    await expect(createTwentyClient().findByFilter('companies', 'name[eq]:Acme Co'))
      .rejects.toThrow(/unexpected shape/);
  });

  it('throws when the results are nested differently', async () => {
    respondWith({ data: { companies: { edges: [{ node: { id: 'c1' } }] } } });
    await expect(createTwentyClient().findByFilter('companies', 'name[eq]:Acme Co'))
      .rejects.toThrow(/expected data\.companies to be an array/);
  });

  it('throws when there is no data envelope at all', async () => {
    respondWith({ error: 'Unrecognized filter operator' });
    await expect(createTwentyClient().findByFilter('companies', 'name[eq]:Acme Co'))
      .rejects.toThrow(/unexpected shape/);
  });

  it('sends the filter url-encoded on the query string', async () => {
    const fetchMock = respondWith({ data: { companies: [] } });
    await createTwentyClient().findByFilter('companies', 'name[eq]:Acme Co');
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      `filter=${encodeURIComponent('name[eq]:Acme Co')}`,
    );
  });
});
