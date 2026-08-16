import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

// lib/server/session is intentionally NOT mocked in this file — it exists
// specifically to pin the real Set-Cookie attributes at this mint site: the
// __Host- prefix and its three preconditions (Secure, Path=/, no Domain).
// See final-review.md I4. Every other dependency is mocked so this stays a
// unit test of the cookie, not an end-to-end magic-link/Twenty test.
const readMagicToken = vi.fn();
vi.mock('@/lib/server/magic-link', () => ({
  readMagicToken: (...args: unknown[]) => readMagicToken(...args),
}));

const findActiveWorkspaceMember = vi.fn();
vi.mock('@/lib/server/membership', () => ({
  findActiveWorkspaceMember: (...args: unknown[]) => findActiveWorkspaceMember(...args),
}));

const validPayload = { email: 'contractor@partner.test', purpose: 'magic-link' as const, expiresAt: Date.now() + 1000 };
const activeMember = { id: 'wm-1', userEmail: 'contractor@partner.test', name: 'C' };

beforeEach(() => {
  vi.resetAllMocks();
  process.env.SESSION_SECRET = 'test-secret-value';
  readMagicToken.mockResolvedValue(validPayload);
  findActiveWorkspaceMember.mockResolvedValue(activeMember);
});

const buildRequest = () =>
  new NextRequest('http://portal.fraterailabs.com/api/auth/magic-link/verify?token=abc.def');

describe('GET /api/auth/magic-link/verify — session cookie attributes', () => {
  it('sets the session cookie with the __Host- prefix, Secure, Path=/, and no Domain', async () => {
    const { GET } = await import('../route');
    const res = await GET(buildRequest());

    const cookie = res.cookies.get('__Host-frater_portal_session');
    expect(cookie).toBeDefined();
    expect(cookie?.secure).toBe(true);
    expect(cookie?.path).toBe('/');
    expect(cookie?.domain).toBeUndefined();
  });
});
