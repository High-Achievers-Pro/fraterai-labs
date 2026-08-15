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

describe('twenty-rest list', () => {
  beforeEach(() => {
    vi.stubEnv('TWENTY_API_KEY', 'test-key');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('returns every record in the collection, not just the first', async () => {
    respondWith({ data: { workspaceMembers: [{ id: 'wm-1' }, { id: 'wm-2' }] } });
    const records = await createTwentyClient().list('workspaceMembers');
    expect(records).toEqual([{ id: 'wm-1' }, { id: 'wm-2' }]);
  });

  it('returns an empty array for an empty collection', async () => {
    respondWith({ data: { workspaceMembers: [] } });
    expect(await createTwentyClient().list('workspaceMembers')).toEqual([]);
  });

  it('throws on an unexpected shape, same as findByFilter', async () => {
    respondWith({ data: { workspaceMembers: { edges: [] } } });
    await expect(createTwentyClient().list('workspaceMembers')).rejects.toThrow(/unexpected shape/);
  });

  it('sends an explicit limit without a filter param', async () => {
    const fetchMock = respondWith({ data: { workspaceMembers: [] } });
    await createTwentyClient().list('workspaceMembers');
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain('limit=200');
    expect(url).not.toContain('filter=');
  });
});

// The live server rate-limits at 100 requests/60s (plus a shorter 100/1s
// bucket). A 252-row import issues ~2,500 requests, so a live run WILL hit
// 429s partway through — this is the retry/backoff layer that makes the
// importer re-runnable to completion instead of failing ~8 rows in. Every
// test here injects a fake `sleep` so the suite never actually waits.
describe('twenty-rest retry', () => {
  beforeEach(() => {
    vi.stubEnv('TWENTY_API_KEY', 'test-key');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  const jsonResponse = (payload: unknown, status = 200, headers: Record<string, string> = {}) =>
    new Response(JSON.stringify(payload), {
      status, headers: { 'Content-Type': 'application/json', ...headers },
    });

  const textResponse = (status: number, body = '', headers: Record<string, string> = {}) =>
    new Response(body, { status, headers });

  // Records every delay it was asked to wait, but resolves immediately —
  // this is what keeps the whole suite fast despite exercising real backoff
  // math.
  const fakeSleep = () => {
    const calls: number[] = [];
    const sleep = vi.fn(async (ms: number) => { calls.push(ms); });
    return { sleep, calls };
  };

  it('retries a 429 and succeeds on the next attempt', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(textResponse(429, JSON.stringify({ error: 'rate limited' })))
      .mockResolvedValueOnce(jsonResponse({ data: { companies: [] } }));
    vi.stubGlobal('fetch', fetchMock);
    const { sleep, calls } = fakeSleep();

    const client = createTwentyClient({ sleep, baseDelayMs: 2000 });
    const record = await client.findByFilter('companies', 'name[eq]:Acme');

    expect(record).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(calls).toEqual([2000]);
  });

  it('honours a Retry-After header over the computed backoff', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(textResponse(429, '', { 'Retry-After': '3' }))
      .mockResolvedValueOnce(jsonResponse({ data: { companies: [] } }));
    vi.stubGlobal('fetch', fetchMock);
    const { sleep, calls } = fakeSleep();

    const client = createTwentyClient({ sleep, baseDelayMs: 2000 });
    await client.findByFilter('companies', 'name[eq]:Acme');

    // 3 (seconds, from the header) * 1000, not the 2000ms backoff default.
    expect(calls).toEqual([3000]);
  });

  it('does not retry a non-429 4xx — a validation error will never succeed on retry', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(textResponse(400, 'bad filter operator'));
    vi.stubGlobal('fetch', fetchMock);
    const { sleep } = fakeSleep();

    const client = createTwentyClient({ sleep });
    await expect(client.findByFilter('companies', 'name[eq]:Acme')).rejects.toThrow(/400/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('caps attempts and surfaces the failure rather than retrying forever', async () => {
    const fetchMock = vi.fn().mockResolvedValue(textResponse(429, 'still limited'));
    vi.stubGlobal('fetch', fetchMock);
    const { sleep } = fakeSleep();

    const client = createTwentyClient({
      sleep, maxAttempts: 3, baseDelayMs: 10, maxDelayMs: 100,
    });
    await expect(client.findByFilter('companies', 'name[eq]:Acme')).rejects.toThrow(/429/);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    // 2 waits between 3 attempts — no sleep after the final, surfaced failure.
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it('grows the backoff delay exponentially between retries, capped at maxDelayMs', async () => {
    const fetchMock = vi.fn().mockResolvedValue(textResponse(500, 'server trouble'));
    vi.stubGlobal('fetch', fetchMock);
    const { sleep, calls } = fakeSleep();

    const client = createTwentyClient({
      sleep, maxAttempts: 5, baseDelayMs: 1000, maxDelayMs: 3000,
    });
    await expect(client.findByFilter('companies', 'name[eq]:Acme')).rejects.toThrow(/500/);
    expect(calls).toEqual([1000, 2000, 3000, 3000]); // doubles, then caps
  });

  it('retries a 5xx the same way as a 429', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(textResponse(503, 'service unavailable'))
      .mockResolvedValueOnce(jsonResponse({ data: { companies: [] } }));
    vi.stubGlobal('fetch', fetchMock);
    const { sleep } = fakeSleep();

    const client = createTwentyClient({ sleep, baseDelayMs: 500 });
    const record = await client.findByFilter('companies', 'name[eq]:Acme');

    expect(record).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retries a network error with the same backoff as an HTTP failure', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error('fetch failed'))
      .mockResolvedValueOnce(jsonResponse({ data: { companies: [] } }));
    vi.stubGlobal('fetch', fetchMock);
    const { sleep, calls } = fakeSleep();

    const client = createTwentyClient({ sleep, baseDelayMs: 2000 });
    const record = await client.findByFilter('companies', 'name[eq]:Acme');

    expect(record).toBeNull();
    expect(calls).toEqual([2000]);
  });

  it('caps attempts on a persistent network error too, surfacing it as a failure', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('fetch failed'));
    vi.stubGlobal('fetch', fetchMock);
    const { sleep } = fakeSleep();

    const client = createTwentyClient({ sleep, maxAttempts: 3, baseDelayMs: 10 });
    await expect(client.findByFilter('companies', 'name[eq]:Acme')).rejects.toThrow(/fetch failed/);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('passes a per-request AbortSignal so a hung request cannot stall the run', async () => {
    const fetchMock = respondWith({ data: { companies: [] } });
    const { sleep } = fakeSleep();

    const client = createTwentyClient({ sleep, timeoutMs: 12345 });
    await client.findByFilter('companies', 'name[eq]:Acme');

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
});
