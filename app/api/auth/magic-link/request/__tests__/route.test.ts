import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const verifyTurnstileToken = vi.fn();
vi.mock('@/lib/server/turnstile', () => ({
  verifyTurnstileToken: (...args: unknown[]) => verifyTurnstileToken(...args),
}));

const findActiveWorkspaceMember = vi.fn();
vi.mock('@/lib/server/membership', () => ({
  findActiveWorkspaceMember: (...args: unknown[]) => findActiveWorkspaceMember(...args),
}));

const createMagicToken = vi.fn();
const isAllowlisted = vi.fn();
vi.mock('@/lib/server/magic-link', () => ({
  createMagicToken: (...args: unknown[]) => createMagicToken(...args),
  isAllowlisted: (...args: unknown[]) => isAllowlisted(...args),
}));

const sendMagicLinkEmail = vi.fn();
vi.mock('@/lib/server/email', () => ({
  sendMagicLinkEmail: (...args: unknown[]) => sendMagicLinkEmail(...args),
}));

// Mirrors the real implementation (lib/server/env.ts) exactly, reading
// process.env fresh on every call — mocked rather than imported via
// importOriginal() because the `@/` path alias is only configured for
// tsconfig/Next's bundler, not for vitest's resolver, so a real resolution
// of '@/lib/server/env' fails under vitest. This still exercises the
// SERVER_URL-missing case faithfully (delete process.env.SERVER_URL and
// this mock throws, exactly like the real requireEnv would).
vi.mock('@/lib/server/env', () => ({
  requireEnv: (name: string) => {
    const value = process.env[name];
    if (!value) throw new Error(`Missing required environment variable: ${name}`);
    return value;
  },
  optionalEnv: (name: string) => process.env[name],
}));

// after() needs a Next.js request-scoped AsyncLocalStorage that a bare unit
// test never sets up (calling the real one throws "`after` was called
// outside a request scope"). Mocking it to capture-rather-than-run the
// callback is what lets these tests assert the actual property under test:
// that the network-bound work runs AFTER the response, not before it.
// Real after()-in-a-request-scope behaviour was verified separately against
// a running `next dev` server — see task-5b-report.md.
let capturedAfterCallbacks: Array<() => unknown> = [];
vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>();
  return {
    ...actual,
    after: (cb: () => unknown) => {
      capturedAfterCallbacks.push(cb);
    },
  };
});

const GENERIC_BODY = { message: 'If that address has access, a link is on its way.' };

const buildRequest = (bodyValue: unknown, headers: Record<string, string> = {}) =>
  new NextRequest('http://portal.fraterailabs.com/api/auth/magic-link/request', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof bodyValue === 'string' ? bodyValue : JSON.stringify(bodyValue),
  });

const activeMember = { id: 'wm-1', userEmail: 'member@partner.test', name: 'M' };

beforeEach(() => {
  // resetAllMocks (not clearAllMocks): clearAllMocks leaves any unconsumed
  // mockReturnValueOnce/mockResolvedValueOnce queued values in place, which
  // leaked across tests here — a test earlier in the file could queue a
  // "once" value for a call that (deliberately) never happens because the
  // work is deferred inside after() and that test never runs the captured
  // callback, so the stale value silently surfaced in a *later* test instead.
  vi.resetAllMocks();
  capturedAfterCallbacks = [];
  process.env.SERVER_URL = 'https://www.fraterailabs.com';
  verifyTurnstileToken.mockResolvedValue(true);
  isAllowlisted.mockReturnValue(false);
  findActiveWorkspaceMember.mockResolvedValue(null);
  createMagicToken.mockResolvedValue('token-body.token-sig');
  sendMagicLinkEmail.mockResolvedValue(undefined);
});

describe('POST /api/auth/magic-link/request', () => {
  it('returns the identical status and body for an allowlisted active member and for a stranger', async () => {
    const { POST } = await import('../route');

    const strangerRes = await POST(buildRequest({ email: 'stranger@example.test', turnstileToken: 't' }));
    const strangerBody = await strangerRes.json();

    isAllowlisted.mockReturnValueOnce(true);
    findActiveWorkspaceMember.mockResolvedValueOnce(activeMember);
    const memberRes = await POST(buildRequest({ email: 'member@partner.test', turnstileToken: 't' }));
    const memberBody = await memberRes.json();

    expect(strangerRes.status).toBe(200);
    expect(memberRes.status).toBe(200);
    expect(memberBody).toEqual(strangerBody);
    expect(strangerBody).toEqual(GENERIC_BODY);
  });

  it('checks Turnstile before touching the allowlist or membership at all', async () => {
    const { POST } = await import('../route');
    verifyTurnstileToken.mockResolvedValueOnce(false);

    const res = await POST(buildRequest({ email: 'someone@partner.test', turnstileToken: 'bad' }));

    expect(await res.json()).toEqual(GENERIC_BODY);
    expect(isAllowlisted).not.toHaveBeenCalled();
    expect(findActiveWorkspaceMember).not.toHaveBeenCalled();
  });

  it('never lets a non-string email field reach isAllowlisted', async () => {
    const { POST } = await import('../route');

    await POST(buildRequest({ email: { injected: true }, turnstileToken: 't' }));
    await POST(buildRequest({ email: ['array@example.test'], turnstileToken: 't' }));
    await POST(buildRequest({ email: 12345, turnstileToken: 't' }));
    await POST(buildRequest({ turnstileToken: 't' }));

    expect(isAllowlisted).not.toHaveBeenCalled();
  });

  it('never lets a non-string turnstileToken field reach verifyTurnstileToken as a string', async () => {
    const { POST } = await import('../route');

    await POST(buildRequest({ email: 'someone@partner.test', turnstileToken: { injected: true } }));

    expect(verifyTurnstileToken).toHaveBeenCalledWith(undefined, undefined);
  });

  it('defers the membership lookup and email send to after the response, via after() rather than inline', async () => {
    const { POST } = await import('../route');
    isAllowlisted.mockReturnValueOnce(true);
    findActiveWorkspaceMember.mockResolvedValueOnce(activeMember);

    const res = await POST(buildRequest({ email: 'member@partner.test', turnstileToken: 't' }));

    // The response has already resolved, but none of the network-bound work
    // has run yet — that's the whole point of deferring it with after().
    expect(res.status).toBe(200);
    expect(isAllowlisted).not.toHaveBeenCalled();
    expect(findActiveWorkspaceMember).not.toHaveBeenCalled();
    expect(sendMagicLinkEmail).not.toHaveBeenCalled();
    expect(capturedAfterCallbacks).toHaveLength(1);

    // Running the deferred callback is what actually does the work.
    await capturedAfterCallbacks[0]?.();
    expect(findActiveWorkspaceMember).toHaveBeenCalledWith('member@partner.test');
    expect(sendMagicLinkEmail).toHaveBeenCalledTimes(1);
  });

  it('builds the emailed verify link from SERVER_URL, never from the request Host / X-Forwarded-Host', async () => {
    const { POST } = await import('../route');
    isAllowlisted.mockReturnValueOnce(true);
    findActiveWorkspaceMember.mockResolvedValueOnce(activeMember);

    await POST(buildRequest(
      { email: 'member@partner.test', turnstileToken: 't' },
      { host: 'evil.test', 'x-forwarded-host': 'evil.test' },
    ));
    await capturedAfterCallbacks[0]?.();

    const [, url] = sendMagicLinkEmail.mock.calls[0] as [string, string];
    expect(url.startsWith('https://www.fraterailabs.com/api/auth/magic-link/verify?token=')).toBe(true);
    expect(url).not.toContain('evil.test');
  });

  it('returns the generic response even when the body is malformed JSON', async () => {
    const { POST } = await import('../route');

    const res = await POST(buildRequest('not json'));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(GENERIC_BODY);
  });
});

describe('deliverMagicLinkIfEligible', () => {
  it('does nothing when the address is not allowlisted', async () => {
    const { deliverMagicLinkIfEligible } = await import('../route');
    isAllowlisted.mockReturnValueOnce(false);

    await deliverMagicLinkIfEligible('stranger@example.test');

    expect(findActiveWorkspaceMember).not.toHaveBeenCalled();
    expect(sendMagicLinkEmail).not.toHaveBeenCalled();
  });

  it('does nothing when allowlisted but not an active workspace member', async () => {
    const { deliverMagicLinkIfEligible } = await import('../route');
    isAllowlisted.mockReturnValueOnce(true);
    findActiveWorkspaceMember.mockResolvedValueOnce(null);

    await deliverMagicLinkIfEligible('contractor@partner.test');

    expect(sendMagicLinkEmail).not.toHaveBeenCalled();
  });

  it('mints a token and sends mail when allowlisted and an active member', async () => {
    const { deliverMagicLinkIfEligible } = await import('../route');
    isAllowlisted.mockReturnValueOnce(true);
    findActiveWorkspaceMember.mockResolvedValueOnce(activeMember);
    createMagicToken.mockResolvedValueOnce('abc.def');

    await deliverMagicLinkIfEligible('contractor@partner.test');

    expect(createMagicToken).toHaveBeenCalledWith('contractor@partner.test');
    expect(sendMagicLinkEmail).toHaveBeenCalledWith(
      'contractor@partner.test',
      'https://www.fraterailabs.com/api/auth/magic-link/verify?token=abc.def',
    );
  });

  it('logs and does not throw when SERVER_URL is missing (fix Important-3: outages must be visible)', async () => {
    const { deliverMagicLinkIfEligible } = await import('../route');
    isAllowlisted.mockReturnValueOnce(true);
    findActiveWorkspaceMember.mockResolvedValueOnce(activeMember);
    delete process.env.SERVER_URL;
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(deliverMagicLinkIfEligible('contractor@partner.test')).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledWith(
      '[magic-link] failed to deliver sign-in email',
      expect.objectContaining({ email: 'contractor@partner.test' }),
    );
    expect(sendMagicLinkEmail).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('logs and does not throw when the email send itself fails (fix Important-3)', async () => {
    const { deliverMagicLinkIfEligible } = await import('../route');
    isAllowlisted.mockReturnValueOnce(true);
    findActiveWorkspaceMember.mockResolvedValueOnce(activeMember);
    sendMagicLinkEmail.mockRejectedValueOnce(new Error('smtp down'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(deliverMagicLinkIfEligible('contractor@partner.test')).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledWith(
      '[magic-link] failed to deliver sign-in email',
      expect.objectContaining({ email: 'contractor@partner.test' }),
    );
    errorSpy.mockRestore();
  });
});
