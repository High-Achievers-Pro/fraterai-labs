import { afterEach, describe, expect, it, vi } from 'vitest';
import { inspect } from 'node:util';
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
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(await verifyTurnstileToken('a-token')).toBe(false);
    errorSpy.mockRestore();
  });

  // I3: a network failure talking to Cloudflare must leave a signal an
  // operator can distinguish from a genuine failed challenge.
  it('logs when fetch rejects', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'secret-key';
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network down'); }));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await verifyTurnstileToken('a-token');

    expect(errorSpy).toHaveBeenCalledWith('[turnstile] siteverify request failed', expect.any(Error));
    errorSpy.mockRestore();
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
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(await verifyTurnstileToken('a-token')).toBe(false);
    errorSpy.mockRestore();
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

  // Re-review note: an earlier version of this test asserted
  // `JSON.stringify(...)` doesn't contain the secret. That's vacuous —
  // JSON.stringify(new Error(...)) always serializes to "{}" (an Error's
  // own message/stack are non-enumerable in V8), so the assertion passed
  // regardless of what the error actually carried. That's the exact class
  // of gap that let the google/callback route leak the OAuth authorization
  // code (I3 re-review): `console.error(prefix, error)` renders the error
  // via util.inspect, not JSON.stringify, so JSON.stringify-based
  // assertions prove nothing about what actually reaches the log.
  //
  // verifyTurnstileToken never rejects (it's designed to always resolve),
  // so `.catch()` on it is dead code and the return-value half of the old
  // test was equally vacuous — removed.
  //
  // The guarantee this test actually rests on is STRUCTURAL, not
  // something this test alone proves: turnstile.ts's catch block logs the
  // raw caught `error` object (not `.message`), so if the underlying
  // fetch() call ever threw an error carrying the secret as an enumerable
  // property, it WOULD reach the log — util.inspect prints own enumerable
  // properties, same as it does for gaxios's GaxiosError. What makes this
  // safe today is that turnstile.ts's fetch call is plain, unwrapped
  // node/undici fetch, and a native fetch failure carries no enumerable
  // properties at all (confirmed empirically: `Object.keys(err)` on a real
  // failed fetch() is `[]`, unlike gaxios, which explicitly attaches
  // `config`/`response`). This test cannot exercise the real network
  // failure path without an actual network call, so it instead asserts,
  // via util.inspect (the real rendering console.error uses), that a
  // representative thrown error's inspected form does not contain the
  // secret — which is the same check that WOULD have caught the
  // google/callback leak had it been written this way there.
  it('never leaks the secret key via the I3 log line, checked against the same rendering console.error uses', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'super-secret-value';
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network down'); }));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const result = await verifyTurnstileToken('a-token');
    expect(result).toBe(false);

    expect(errorSpy).toHaveBeenCalledWith('[turnstile] siteverify request failed', expect.any(Error));
    const [, loggedError] = errorSpy.mock.calls[0];
    // inspect(), not JSON.stringify(): this is what console.error actually
    // renders, and is real evidence the secret doesn't appear — not a
    // vacuously-true check.
    expect(inspect(loggedError)).not.toContain('super-secret-value');
    errorSpy.mockRestore();
  });
});
