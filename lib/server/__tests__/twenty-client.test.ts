import { afterEach, describe, expect, it, vi } from 'vitest';
import { TwentyError, twentyGraphQL, twentyRest } from '../twenty-client';

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

describe('twentyRest', () => {
  it('returns the parsed JSON payload on success', async () => {
    process.env.TWENTY_BASE_URL = 'https://crm.test';
    process.env.TWENTY_API_KEY = 'secret-key';
    mockFetch({ id: '123', name: 'Acme' });

    const result = await twentyRest<{ id: string; name: string }>('/companies/123');
    expect(result).toEqual({ id: '123', name: 'Acme' });
  });

  it('sends the API key as a bearer token', async () => {
    process.env.TWENTY_BASE_URL = 'https://crm.test';
    process.env.TWENTY_API_KEY = 'secret-key';
    mockFetch({ id: '123' });

    await twentyRest('/companies/123');

    const [, init] = (globalThis.fetch as never as { mock: { calls: [string, RequestInit][] } }).mock.calls[0];
    expect((init.headers as Headers).get('Authorization')).toBe('Bearer secret-key');
  });

  it('merges caller-supplied Headers with the auth headers rather than dropping them', async () => {
    process.env.TWENTY_BASE_URL = 'https://crm.test';
    process.env.TWENTY_API_KEY = 'secret-key';
    mockFetch({ id: '123' });

    await twentyRest('/companies/123', { headers: new Headers({ 'X-Custom': 'value' }) });

    const [, init] = (globalThis.fetch as never as { mock: { calls: [string, RequestInit][] } }).mock.calls[0];
    const headers = init.headers as Headers;
    expect(headers.get('X-Custom')).toBe('value');
    expect(headers.get('Authorization')).toBe('Bearer secret-key');
  });

  it('throws TwentyError carrying the status, with the method and path in the message, on a non-ok response, without leaking the key', async () => {
    process.env.TWENTY_BASE_URL = 'https://crm.test';
    process.env.TWENTY_API_KEY = 'secret-key';
    mockFetch({ message: 'Not Found' }, false, 404);

    const error = await twentyRest('/companies/999', { method: 'DELETE' }).catch((e) => e);
    expect(error).toBeInstanceOf(TwentyError);
    expect((error as TwentyError).status).toBe(404);
    expect(String(error)).toContain('DELETE');
    expect(String(error)).toContain('/companies/999');
    expect(String(error)).not.toContain('secret-key');
  });
});
