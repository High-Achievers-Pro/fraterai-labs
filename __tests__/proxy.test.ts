import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const readSessionCookie = vi.fn();
vi.mock('@/lib/server/session', () => ({
  SESSION_COOKIE_NAME: '__Host-frater_portal_session',
  readSessionCookie: (...args: unknown[]) => readSessionCookie(...args),
}));

const buildRequest = (path: string, cookie?: string) =>
  new NextRequest(`https://www.fraterailabs.com${path}`, {
    headers: cookie ? { cookie: `__Host-frater_portal_session=${cookie}` } : {},
  });

beforeEach(() => vi.resetAllMocks());

// Pins the three properties final-review.md's Security Boundary Assessment
// names as the ones worth guarding: /portal itself is gated (not just its
// children), the /portal/login bypass is an exact match (not a prefix that
// could unprotect other paths), and a throw from readSessionCookie fails
// closed to a redirect rather than an unhandled 500. proxy.ts previously
// had no test at all — a matcher edit here could silently unprotect the
// launchpad.
describe('proxy', () => {
  it('gates /portal itself (no trailing segment), not just its children', async () => {
    readSessionCookie.mockResolvedValue(null);
    const { proxy } = await import('../proxy');

    const res = await proxy(buildRequest('/portal'));

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/portal/login');
  });

  it('bypasses exactly /portal/login without requiring a session', async () => {
    readSessionCookie.mockResolvedValue(null);
    const { proxy } = await import('../proxy');

    const res = await proxy(buildRequest('/portal/login'));

    // NextResponse.next() carries no location header and is not a redirect.
    expect(res.headers.get('location')).toBeNull();
  });

  it('does NOT bypass /portal/loginX — the bypass is an exact match, not a prefix', async () => {
    readSessionCookie.mockResolvedValue(null);
    const { proxy } = await import('../proxy');

    const res = await proxy(buildRequest('/portal/loginX'));

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/portal/login');
  });

  it('allows the request through when the session cookie is valid', async () => {
    readSessionCookie.mockResolvedValue({ email: 'a@fraterailabs.com', name: 'A', workspaceMemberId: 'wm-1', purpose: 'session', expiresAt: Date.now() + 1000 });
    const { proxy } = await import('../proxy');

    const res = await proxy(buildRequest('/portal', 'valid'));

    expect(res.headers.get('location')).toBeNull();
  });

  it('returns a 401 JSON response (not a redirect) for an unauthenticated /api/portal/* request', async () => {
    readSessionCookie.mockResolvedValue(null);
    const { proxy } = await import('../proxy');

    const res = await proxy(buildRequest('/api/portal/summary'));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body).toEqual({ error: 'Unauthorized' });
  });

  it('fails closed to a redirect, not a 500, when readSessionCookie throws', async () => {
    readSessionCookie.mockRejectedValue(new Error('SESSION_SECRET missing'));
    const { proxy } = await import('../proxy');

    const res = await proxy(buildRequest('/portal'));

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/portal/login');
  });

  it('fails closed to a 401 JSON, not a 500, when readSessionCookie throws on an /api/portal/* request', async () => {
    readSessionCookie.mockRejectedValue(new Error('SESSION_SECRET missing'));
    const { proxy } = await import('../proxy');

    const res = await proxy(buildRequest('/api/portal/summary'));

    expect(res.status).toBe(401);
  });
});
