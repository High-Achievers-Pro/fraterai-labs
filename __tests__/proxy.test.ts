import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { pathToRegexp } from 'next/dist/compiled/path-to-regexp';

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
// had no test at all.
//
// IMPORTANT: none of the tests in THIS describe block ever import or
// assert against `config.matcher` — they all call `proxy(request)`
// directly. Next never runs the matcher inside a unit test; it's Next's
// own router, outside this codebase, that decides whether a given request
// reaches `proxy` at all in production. So changing '/portal/:path*' to
// '/portal/:path+' (which would stop matching '/portal' itself), or
// deleting '/api/portal/:path*' from the array entirely (which would stop
// routing /api/portal/* through this file at all), leaves every test
// below green while silently unprotecting the launchpad. The separate
// 'proxy matcher' describe block below is what actually closes that gap.
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

// Closes the gap the block above cannot: it exercises the ACTUAL
// `config.matcher` array proxy.ts exports, compiled with Next's own
// bundled path-to-regexp (the same library Next's router uses to decide
// whether a request reaches this file at all), and asserts real matching
// behaviour against it — not just that the array equals a literal.
// The literal-equality assertion alone would catch a typo but not a
// semantically-different-but-differently-typed matcher; the pathToRegexp
// assertions below catch a matcher that LOOKS plausible but stops
// covering /portal itself or /api/portal/* — which is exactly the class
// of change the describe block above cannot see, since none of those
// tests ever touch `config.matcher`.
describe('proxy matcher (config.matcher, not just proxy() behaviour)', () => {
  it('is exactly the two patterns this app relies on', async () => {
    const { config } = await import('../proxy');

    expect(config.matcher).toEqual(['/portal/:path*', '/api/portal/:path*']);
  });

  it('the /portal/:path* pattern covers /portal itself and its children, and nothing else', async () => {
    const { config } = await import('../proxy');
    const portalPattern = config.matcher[0];
    const regexp = pathToRegexp(portalPattern);

    expect(regexp.test('/portal')).toBe(true);
    expect(regexp.test('/portal/login')).toBe(true);
    expect(regexp.test('/portal/anything/deeper')).toBe(true);
    expect(regexp.test('/portalX')).toBe(false);
    expect(regexp.test('/about')).toBe(false);
  });

  it('the /api/portal/:path* pattern covers /api/portal itself and its children, and nothing else', async () => {
    const { config } = await import('../proxy');
    const apiPortalPattern = config.matcher[1];
    const regexp = pathToRegexp(apiPortalPattern);

    expect(regexp.test('/api/portal')).toBe(true);
    expect(regexp.test('/api/portal/summary')).toBe(true);
    expect(regexp.test('/api/portal/me')).toBe(true);
    expect(regexp.test('/api/leads/inbound')).toBe(false);
    expect(regexp.test('/api/webhooks/twenty')).toBe(false);
  });
});
