import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Header names duplicated here as literals rather than imported from
// lib/server/webhook-verify.ts: that module is mocked below via a bare
// literal specifier (no importOriginal), the same technique used for
// '@/lib/server/env' in app/api/auth/magic-link/request/__tests__/route.test.ts
// — real resolution of a '@/'-aliased module fails under vitest (no alias
// configured in vitest.config.ts), so importOriginal() would throw. These
// must be kept in sync with the real SIGNATURE_HEADER / TIMESTAMP_HEADER
// constants by hand if that file's assumed scheme is ever corrected.
const SIGNATURE_HEADER = 'x-twenty-signature';
const TIMESTAMP_HEADER = 'x-twenty-timestamp';

const verifyWebhookSignature = vi.fn();
vi.mock('@/lib/server/webhook-verify', () => ({
  verifyWebhookSignature: (...args: unknown[]) => verifyWebhookSignature(...args),
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
}));

// Mirrors the real implementation (lib/server/env.ts) exactly — same reason
// as the magic-link request route test: the '@/' alias does not resolve
// under vitest, so this can't use importOriginal().
vi.mock('@/lib/server/env', () => ({
  requireEnv: (name: string) => {
    const value = process.env[name];
    if (!value) throw new Error(`Missing required environment variable: ${name}`);
    return value;
  },
  optionalEnv: (name: string) => process.env[name],
}));

// after() needs a Next.js request-scoped AsyncLocalStorage that a bare unit
// test never sets up. Mocking it to capture-rather-than-run the callback is
// what lets these tests assert the actual property under test: that Slack
// posting happens after the response, not before it. Same technique as
// app/api/leads/inbound/__tests__/route.test.ts.
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

const buildRequest = (bodyText: string, headers: Record<string, string> = {}) =>
  new NextRequest('https://www.fraterailabs.com/api/webhooks/twenty', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: bodyText,
  });

const validHeaders = { [SIGNATURE_HEADER]: 'sig', [TIMESTAMP_HEADER]: '123' };

beforeEach(() => {
  // resetModules: the route's event-id dedup Set is module-level state by
  // design (see its own comment on why — it exists to catch a retried
  // delivery within one process's lifetime). That means it persists across
  // `it` blocks in this file unless the module is re-imported fresh each
  // time, which would make tests reusing the same event id (e.g. 'evt_1')
  // spuriously interfere with each other. Each test dynamically
  // `import('../route')`s after this reset, so each gets its own clean Set.
  vi.resetModules();
  vi.resetAllMocks();
  capturedAfterCallbacks = [];
  verifyWebhookSignature.mockReturnValue(true);
  delete process.env.SLACK_WEBHOOK_URL;
});

describe('POST /api/webhooks/twenty', () => {
  it('returns 401 and does no processing when signature verification fails', async () => {
    const { POST } = await import('../route');
    verifyWebhookSignature.mockReturnValueOnce(false);

    const res = await POST(buildRequest(JSON.stringify({ id: 'evt_1' }), validHeaders));

    expect(res.status).toBe(401);
    expect(capturedAfterCallbacks).toHaveLength(0);
  });

  it('passes the exact raw body text to verifyWebhookSignature, not a re-serialised version', async () => {
    const { POST } = await import('../route');
    // Irregular whitespace that JSON.parse -> JSON.stringify would not
    // reproduce byte-for-byte — proves the route reads raw text and does
    // not parse-then-reserialise before verifying.
    const rawBody = '{"id":  "evt_1",   "eventName":"person.created"}';

    await POST(buildRequest(rawBody, validHeaders));

    expect(verifyWebhookSignature).toHaveBeenCalledWith(rawBody, 'sig', '123');
  });

  it('reads the signature and timestamp from the assumed header names', async () => {
    const { POST } = await import('../route');

    await POST(buildRequest(JSON.stringify({ id: 'evt_1' }), {
      [SIGNATURE_HEADER]: 'abc',
      [TIMESTAMP_HEADER]: '999',
    }));

    expect(verifyWebhookSignature).toHaveBeenCalledWith(expect.any(String), 'abc', '999');
  });

  it('passes undefined (not null or empty string) when a header is absent', async () => {
    const { POST } = await import('../route');

    await POST(buildRequest(JSON.stringify({ id: 'evt_1' })));

    expect(verifyWebhookSignature).toHaveBeenCalledWith(expect.any(String), undefined, undefined);
  });

  it('returns 200 on a fresh, verified event', async () => {
    const { POST } = await import('../route');

    const res = await POST(buildRequest(JSON.stringify({ id: 'evt_1' }), validHeaders));

    expect(res.status).toBe(200);
  });

  it('still returns 200, not 500 or 401, when the verified payload is not valid JSON', async () => {
    const { POST } = await import('../route');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const res = await POST(buildRequest('not json at all', validHeaders));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(errorSpy).toHaveBeenCalled();
    // No processing (Slack post) should have been scheduled for an
    // unparseable payload.
    expect(capturedAfterCallbacks).toHaveLength(0);
    expect(JSON.stringify(body)).not.toContain('not json at all');
    errorSpy.mockRestore();
  });

  it('deduplicates on event id: a second delivery of the same id does no further processing', async () => {
    const { POST } = await import('../route');
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.test/services/xyz';
    const body = JSON.stringify({ id: 'evt-dup-1', eventName: 'person.created' });

    const first = await POST(buildRequest(body, validHeaders));
    const second = await POST(buildRequest(body, validHeaders));

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    // Only the first delivery should have scheduled Slack-posting work.
    expect(capturedAfterCallbacks).toHaveLength(1);
  });

  it('processes two different event ids independently (not conflated by dedup)', async () => {
    const { POST } = await import('../route');
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.test/services/xyz';

    await POST(buildRequest(JSON.stringify({ id: 'evt-a' }), validHeaders));
    await POST(buildRequest(JSON.stringify({ id: 'evt-b' }), validHeaders));

    expect(capturedAfterCallbacks).toHaveLength(2);
  });

  it('does not post to Slack when SLACK_WEBHOOK_URL is unset', async () => {
    const { POST } = await import('../route');
    vi.stubGlobal('fetch', vi.fn());

    await POST(buildRequest(JSON.stringify({ id: 'evt_1' }), validHeaders));
    expect(capturedAfterCallbacks).toHaveLength(1);
    await capturedAfterCallbacks[0]?.();

    expect(fetch).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('posts to Slack via after(), not inline, when SLACK_WEBHOOK_URL is set', async () => {
    const { POST } = await import('../route');
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.test/services/xyz';
    const fetchMock = vi.fn(async () => new Response('ok', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const res = await POST(buildRequest(JSON.stringify({ id: 'evt_1' }), validHeaders));

    // Response already resolved; Slack has not been called yet — that is
    // the whole point of deferring it with after().
    expect(res.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(capturedAfterCallbacks).toHaveLength(1);

    await capturedAfterCallbacks[0]?.();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('https://hooks.slack.test/services/xyz', expect.anything());
    vi.unstubAllGlobals();
  });

  it('does not throw out of the after() callback when the Slack post itself fails', async () => {
    const { POST } = await import('../route');
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.test/services/xyz';
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network down'); }));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await POST(buildRequest(JSON.stringify({ id: 'evt_1' }), validHeaders));

    await expect(capturedAfterCallbacks[0]?.()).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  it('never leaks TWENTY_WEBHOOK_SECRET, the raw signature, or a Slack webhook URL into the response body', async () => {
    const { POST } = await import('../route');
    process.env.TWENTY_WEBHOOK_SECRET = 'super-secret-value';
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.test/services/should-not-leak';

    const res = await POST(buildRequest(JSON.stringify({ id: 'evt_1' }), {
      [SIGNATURE_HEADER]: 'signature-value-xyz',
      [TIMESTAMP_HEADER]: '123',
    }));
    const bodyText = JSON.stringify(await res.json());

    expect(bodyText).not.toContain('super-secret-value');
    expect(bodyText).not.toContain('signature-value-xyz');
    expect(bodyText).not.toContain('should-not-leak');
  });

  it('returns a 401 body that does not echo the failed signature or timestamp', async () => {
    const { POST } = await import('../route');
    verifyWebhookSignature.mockReturnValueOnce(false);

    const res = await POST(buildRequest(JSON.stringify({ id: 'evt_1' }), {
      [SIGNATURE_HEADER]: 'attacker-supplied-signature',
      [TIMESTAMP_HEADER]: '123',
    }));
    const bodyText = JSON.stringify(await res.json());

    expect(res.status).toBe(401);
    expect(bodyText).not.toContain('attacker-supplied-signature');
  });
});
