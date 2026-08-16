import { afterEach, describe, expect, it, vi } from 'vitest';
import { verifyTurnstileToken } from '../turnstile';

const mockFetch = (response: unknown, ok = true, status = 200) =>
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok, status,
    json: async () => response,
  })));

afterEach(() => vi.unstubAllGlobals());

describe('verifyTurnstileToken', () => {
  it('returns true when Cloudflare responds success: true', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'secret-key';
    mockFetch({ success: true });

    expect(await verifyTurnstileToken('a-token')).toBe(true);
  });

  it('returns false when Cloudflare responds success: false', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'secret-key';
    mockFetch({ success: false, 'error-codes': ['invalid-input-response'] });

    expect(await verifyTurnstileToken('a-token')).toBe(false);
  });

  it('returns false without calling fetch when the token is undefined', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'secret-key';
    vi.stubGlobal('fetch', vi.fn());

    expect(await verifyTurnstileToken(undefined)).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns false without calling fetch when the token is empty', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'secret-key';
    vi.stubGlobal('fetch', vi.fn());

    expect(await verifyTurnstileToken('')).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns false without calling fetch when TURNSTILE_SECRET_KEY is unset', async () => {
    delete process.env.TURNSTILE_SECRET_KEY;
    vi.stubGlobal('fetch', vi.fn());

    expect(await verifyTurnstileToken('a-token')).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns false when fetch rejects', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'secret-key';
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network down'); }));

    expect(await verifyTurnstileToken('a-token')).toBe(false);
  });

  it('returns false on a non-2xx response', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'secret-key';
    mockFetch({ success: true }, false, 500);

    expect(await verifyTurnstileToken('a-token')).toBe(false);
  });

  it('returns false when the response body is not valid JSON', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'secret-key';
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => { throw new SyntaxError('Unexpected token in JSON'); },
    })));

    expect(await verifyTurnstileToken('a-token')).toBe(false);
  });

  it('sends the secret key and token in the request body', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'secret-key';
    mockFetch({ success: true });

    await verifyTurnstileToken('a-token');

    const [url, init] = (globalThis.fetch as never as {
      mock: { calls: [string, RequestInit][] };
    }).mock.calls[0];
    expect(url).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify');
    const body = new URLSearchParams(init.body as string);
    expect(body.get('secret')).toBe('secret-key');
    expect(body.get('response')).toBe('a-token');
  });

  it('includes remoteip when remoteIp is passed', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'secret-key';
    mockFetch({ success: true });

    await verifyTurnstileToken('a-token', '203.0.113.5');

    const [, init] = (globalThis.fetch as never as {
      mock: { calls: [string, RequestInit][] };
    }).mock.calls[0];
    const body = new URLSearchParams(init.body as string);
    expect(body.get('remoteip')).toBe('203.0.113.5');
  });

  it('omits remoteip when remoteIp is not passed', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'secret-key';
    mockFetch({ success: true });

    await verifyTurnstileToken('a-token');

    const [, init] = (globalThis.fetch as never as {
      mock: { calls: [string, RequestInit][] };
    }).mock.calls[0];
    const body = new URLSearchParams(init.body as string);
    expect(body.has('remoteip')).toBe(false);
  });

  it('never leaks the secret key in a thrown error or return value', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'super-secret-value';
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network down'); }));

    const result = await verifyTurnstileToken('a-token').catch((e) => e);
    expect(JSON.stringify(result)).not.toContain('super-secret-value');
    expect(String(result)).not.toContain('super-secret-value');
  });
});
