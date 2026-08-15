import { afterEach, describe, expect, it, vi } from 'vitest';
import { TwentyError, twentyGraphQL } from '../twenty-client';

const mockFetch = (response: unknown, ok = true, status = 200) =>
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok, status,
    json: async () => response,
    text: async () => JSON.stringify(response),
  })));

afterEach(() => vi.unstubAllGlobals());

describe('twentyGraphQL', () => {
  it('sends the API key as a bearer token', async () => {
    process.env.TWENTY_BASE_URL = 'https://crm.test';
    process.env.TWENTY_API_KEY = 'secret-key';
    mockFetch({ data: { ok: true } });

    await twentyGraphQL('query { ok }');

    const [, init] = (globalThis.fetch as never as { mock: { calls: [string, RequestInit][] } }).mock.calls[0];
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer secret-key');
  });

  it('returns the data payload', async () => {
    process.env.TWENTY_BASE_URL = 'https://crm.test';
    process.env.TWENTY_API_KEY = 'secret-key';
    mockFetch({ data: { workspaceMembers: [] } });

    const result = await twentyGraphQL<{ workspaceMembers: unknown[] }>('query { workspaceMembers { id } }');
    expect(result.workspaceMembers).toEqual([]);
  });

  it('throws TwentyError on a GraphQL error, without leaking the key', async () => {
    process.env.TWENTY_BASE_URL = 'https://crm.test';
    process.env.TWENTY_API_KEY = 'secret-key';
    mockFetch({ errors: [{ message: 'Unauthorized' }] });

    const error = await twentyGraphQL('query { ok }').catch((e) => e);
    expect(error).toBeInstanceOf(TwentyError);
    expect(String(error)).toContain('Unauthorized');
    expect(String(error)).not.toContain('secret-key');
  });

  it('throws when the API key is missing', async () => {
    delete process.env.TWENTY_API_KEY;
    await expect(twentyGraphQL('query { ok }')).rejects.toThrow('TWENTY_API_KEY');
  });
});
