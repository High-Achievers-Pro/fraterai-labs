import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const verifyTurnstileToken = vi.fn();
vi.mock('@/lib/server/turnstile', () => ({
  verifyTurnstileToken: (...args: unknown[]) => verifyTurnstileToken(...args),
}));

const captureInboundLead = vi.fn();
vi.mock('@/lib/server/leads', () => ({
  captureInboundLead: (...args: unknown[]) => captureInboundLead(...args),
}));

const mirrorToHubSpot = vi.fn();
vi.mock('@/lib/server/hubspot-mirror', () => ({
  mirrorToHubSpot: (...args: unknown[]) => mirrorToHubSpot(...args),
}));

// after() needs a Next.js request-scoped AsyncLocalStorage that a bare unit
// test never sets up (calling the real one throws "`after` was called
// outside a request scope"). Mocking it to capture-rather-than-run the
// callback lets these tests assert the actual property under test: that the
// mirror is scheduled to run AFTER the response, not before it. Same
// technique as app/api/auth/magic-link/request/__tests__/route.test.ts.
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

const validBody = {
  name: 'Ada Lovelace',
  email: 'ada@acme.test',
  company: 'Acme Corp',
  message: 'We need agents',
  turnstileToken: 't',
};

const buildRequest = (bodyValue: unknown, headers: Record<string, string> = {}) =>
  new NextRequest('http://www.fraterailabs.com/api/leads/inbound', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof bodyValue === 'string' ? bodyValue : JSON.stringify(bodyValue),
  });

beforeEach(() => {
  // resetAllMocks (not clearAllMocks): see the magic-link route test for why
  // — a queued mockResolvedValueOnce left over from an earlier test could
  // otherwise leak into a later one, especially here where the mirror call
  // only actually runs once its captured after() callback is invoked.
  vi.resetAllMocks();
  capturedAfterCallbacks = [];
  verifyTurnstileToken.mockResolvedValue(true);
  captureInboundLead.mockResolvedValue({ companyId: 'c1', personId: 'p1', prospectId: 'pr1' });
  mirrorToHubSpot.mockResolvedValue(undefined);
});

describe('POST /api/leads/inbound', () => {
  it('rejects with 400 and never calls Twenty when Turnstile fails', async () => {
    const { POST } = await import('../route');
    verifyTurnstileToken.mockResolvedValueOnce(false);

    const res = await POST(buildRequest(validBody));

    expect(res.status).toBe(400);
    expect(captureInboundLead).not.toHaveBeenCalled();
    expect(capturedAfterCallbacks).toHaveLength(0);
  });

  it('checks Turnstile before the honeypot or any field validation', async () => {
    const { POST } = await import('../route');
    verifyTurnstileToken.mockResolvedValueOnce(false);

    // A body that would otherwise be rejected for a completely different
    // reason (honeypot filled, fields missing) — if Turnstile is checked
    // first, the response and the lack of any Twenty call must be identical
    // to any other Turnstile failure, proving the honeypot/validation logic
    // never ran.
    const res = await POST(buildRequest({ website: 'i-am-a-bot' }));

    expect(res.status).toBe(400);
    expect(captureInboundLead).not.toHaveBeenCalled();
  });

  it('never lets a non-string turnstileToken reach verifyTurnstileToken as a string', async () => {
    const { POST } = await import('../route');

    await POST(buildRequest({ ...validBody, turnstileToken: { injected: true } }));

    expect(verifyTurnstileToken).toHaveBeenCalledWith(undefined, undefined);
  });

  it('returns a byte-identical 200 response for a filled honeypot and does no work', async () => {
    const { POST } = await import('../route');

    const honeypotRes = await POST(buildRequest({ ...validBody, website: 'http://spam.test' }));
    const honeypotBody = await honeypotRes.json();

    const realRes = await POST(buildRequest(validBody));
    const realBody = await realRes.json();

    expect(honeypotRes.status).toBe(realRes.status);
    expect(honeypotBody).toEqual(realBody);
    // Only the real submission should have triggered any work.
    expect(captureInboundLead).toHaveBeenCalledTimes(1);
    expect(captureInboundLead).toHaveBeenCalledWith(expect.objectContaining({ email: 'ada@acme.test' }));
  });

  it('rejects malformed JSON with 400', async () => {
    const { POST } = await import('../route');

    const res = await POST(buildRequest('not json'));

    expect(res.status).toBe(400);
    expect(captureInboundLead).not.toHaveBeenCalled();
  });

  it.each([
    ['name', { ...validBody, name: undefined }],
    ['email', { ...validBody, email: undefined }],
    ['company', { ...validBody, company: undefined }],
    ['message', { ...validBody, message: undefined }],
  ])('returns 400 when %s is missing, without calling Twenty', async (_field, body) => {
    const { POST } = await import('../route');

    const res = await POST(buildRequest(body));

    expect(res.status).toBe(400);
    expect(captureInboundLead).not.toHaveBeenCalled();
  });

  it('returns 400 for a malformed email address', async () => {
    const { POST } = await import('../route');

    const res = await POST(buildRequest({ ...validBody, email: 'not-an-email' }));

    expect(res.status).toBe(400);
    expect(captureInboundLead).not.toHaveBeenCalled();
  });

  it('returns 400 for a message at or over the 5,000-character limit', async () => {
    const { POST } = await import('../route');

    const res = await POST(buildRequest({ ...validBody, message: 'x'.repeat(5000) }));

    expect(res.status).toBe(400);
    expect(captureInboundLead).not.toHaveBeenCalled();
  });

  it('accepts a message just under the limit', async () => {
    const { POST } = await import('../route');

    const res = await POST(buildRequest({ ...validBody, message: 'x'.repeat(4999) }));

    expect(res.status).toBe(200);
    expect(captureInboundLead).toHaveBeenCalledTimes(1);
  });

  it('returns 500 with a fixed generic message, not the underlying error, when captureInboundLead throws', async () => {
    const { POST } = await import('../route');
    captureInboundLead.mockRejectedValueOnce(new Error('Twenty REST POST /people failed with 400: field "bogus" does not exist, secret-key-xyz'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const res = await POST(buildRequest(validBody));
    const resBody = await res.json();

    expect(res.status).toBe(500);
    expect(JSON.stringify(resBody)).not.toContain('bogus');
    expect(JSON.stringify(resBody)).not.toContain('secret-key-xyz');
    expect(resBody).toEqual({ error: 'Something went wrong. Please try again later.' });
    // The mirror must never be scheduled for a lead that was never captured.
    expect(capturedAfterCallbacks).toHaveLength(0);
    errorSpy.mockRestore();
  });

  it('returns 200 and schedules the HubSpot mirror via after(), not inline, on success', async () => {
    const { POST } = await import('../route');

    const res = await POST(buildRequest(validBody));

    // The response has already resolved, but the mirror has not run yet —
    // that's the whole point of deferring it with after().
    expect(res.status).toBe(200);
    expect(mirrorToHubSpot).not.toHaveBeenCalled();
    expect(capturedAfterCallbacks).toHaveLength(1);

    await capturedAfterCallbacks[0]?.();
    expect(mirrorToHubSpot).toHaveBeenCalledTimes(1);
    expect(mirrorToHubSpot).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'ada@acme.test' }),
      expect.any(String),
    );
  });

  it('captures the lead before scheduling the mirror, so a bug in the mirror callback cannot lose it', async () => {
    const { POST } = await import('../route');
    mirrorToHubSpot.mockRejectedValueOnce(new Error('mirror blew up unexpectedly'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const res = await POST(buildRequest(validBody));
    expect(res.status).toBe(200);
    expect(captureInboundLead).toHaveBeenCalledTimes(1);

    // Even a rejection from the mirror itself must not throw out of the
    // scheduled callback — it's caught and logged, never surfaced as an
    // unhandled rejection.
    await expect(capturedAfterCallbacks[0]?.()).resolves.toBeUndefined();
    errorSpy.mockRestore();
  });

  it('falls back to the Referer header for pageUri when the body omits it', async () => {
    const { POST } = await import('../route');

    await POST(buildRequest(validBody, { referer: 'https://www.fraterailabs.com/contact' }));
    await capturedAfterCallbacks[0]?.();

    expect(mirrorToHubSpot).toHaveBeenCalledWith(
      expect.anything(),
      'https://www.fraterailabs.com/contact',
    );
  });
});
