import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const readMagicToken = vi.fn();
vi.mock('@/lib/server/magic-link', () => ({
  readMagicToken: (...args: unknown[]) => readMagicToken(...args),
}));

const findActiveWorkspaceMember = vi.fn();
vi.mock('@/lib/server/membership', () => ({
  findActiveWorkspaceMember: (...args: unknown[]) => findActiveWorkspaceMember(...args),
}));

// Fully mocked (not via importOriginal) because the `@/` path alias is only
// configured for tsconfig/Next's bundler, not vitest's resolver — a real
// resolution of '@/lib/server/session' fails under vitest. SESSION_COOKIE_NAME
// is hardcoded here to its real value (lib/server/session.ts) rather than
// imported, so this still asserts against the actual cookie name.
const createSessionCookie = vi.fn();
vi.mock('@/lib/server/session', () => ({
  SESSION_COOKIE_NAME: 'frater_portal_session',
  createSessionCookie: (...args: unknown[]) => createSessionCookie(...args),
}));

const buildRequest = (search: string) =>
  new NextRequest(`http://portal.fraterailabs.com/api/auth/magic-link/verify${search}`);

const validPayload = { email: 'contractor@partner.test', purpose: 'magic-link' as const, expiresAt: Date.now() + 1000 };
const activeMember = { id: 'wm-1', userEmail: 'contractor@partner.test', name: 'C' };

beforeEach(() => {
  // resetAllMocks, not clearAllMocks — see the sibling request/route.test.ts
  // for why leftover mockResolvedValueOnce queues can leak across tests.
  vi.resetAllMocks();
  process.env.SESSION_SECRET = 'test-secret-value';
  readMagicToken.mockResolvedValue(validPayload);
  findActiveWorkspaceMember.mockResolvedValue(activeMember);
  createSessionCookie.mockResolvedValue('cookie-body.cookie-sig');
});

describe('GET /api/auth/magic-link/verify', () => {
  it('re-queries membership, sets a session cookie, and redirects to /portal on a valid token', async () => {
    const { GET } = await import('../route');

    const res = await GET(buildRequest('?token=abc.def'));

    expect(readMagicToken).toHaveBeenCalledWith('abc.def');
    expect(findActiveWorkspaceMember).toHaveBeenCalledWith('contractor@partner.test');
    expect(createSessionCookie).toHaveBeenCalledWith(
      { email: 'contractor@partner.test', name: 'C', workspaceMemberId: 'wm-1' },
      expect.any(Number),
    );
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/portal');
    expect(res.headers.get('location')).not.toContain('/portal/login');
    expect(res.cookies.get('frater_portal_session')?.value).toBe('cookie-body.cookie-sig');
  });

  it('redirects to link_invalid without setting a cookie when the token itself is rejected', async () => {
    const { GET } = await import('../route');
    readMagicToken.mockResolvedValueOnce(null);

    const res = await GET(buildRequest('?token=garbage'));

    expect(findActiveWorkspaceMember).not.toHaveBeenCalled();
    expect(createSessionCookie).not.toHaveBeenCalled();
    expect(res.headers.get('location')).toContain('/portal/login?error=link_invalid');
    expect(res.cookies.get('frater_portal_session')).toBeUndefined();
  });

  // The load-bearing case for immediate revocation: the token's own checks
  // (signature/expiry/purpose/allowlist, inside readMagicToken) all pass,
  // but the workspace member has since been removed from Twenty. Without
  // this re-query, an unexpired link would still grant a session.
  it('redirects to link_invalid without setting a cookie when the re-queried membership is null', async () => {
    const { GET } = await import('../route');
    findActiveWorkspaceMember.mockResolvedValueOnce(null);

    const res = await GET(buildRequest('?token=abc.def'));

    expect(readMagicToken).toHaveBeenCalledWith('abc.def');
    expect(findActiveWorkspaceMember).toHaveBeenCalledWith('contractor@partner.test');
    expect(createSessionCookie).not.toHaveBeenCalled();
    expect(res.headers.get('location')).toContain('/portal/login?error=link_invalid');
    expect(res.cookies.get('frater_portal_session')).toBeUndefined();
  });

  it('redirects to link_invalid without setting a cookie when the token query param is missing', async () => {
    const { GET } = await import('../route');
    // readMagicToken is mocked, so it has no real "falsy token -> null"
    // logic of its own (that's covered directly in magic-link.test.ts) —
    // this asserts the route reacts correctly to that null, not that the
    // token layer produces it.
    readMagicToken.mockResolvedValueOnce(null);

    const res = await GET(buildRequest(''));

    expect(readMagicToken).toHaveBeenCalledWith(undefined);
    expect(createSessionCookie).not.toHaveBeenCalled();
    expect(res.headers.get('location')).toContain('/portal/login?error=link_invalid');
  });

  it('redirects to link_invalid without setting a cookie when a downstream call throws unexpectedly', async () => {
    const { GET } = await import('../route');
    readMagicToken.mockRejectedValueOnce(new Error('boom'));

    const res = await GET(buildRequest('?token=abc.def'));

    expect(createSessionCookie).not.toHaveBeenCalled();
    expect(res.headers.get('location')).toContain('/portal/login?error=link_invalid');
    expect(res.cookies.get('frater_portal_session')).toBeUndefined();
  });
});
