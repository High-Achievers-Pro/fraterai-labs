import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

// lib/server/session is intentionally NOT mocked in this file — it exists
// specifically to pin the real Set-Cookie attributes at this mint site: the
// __Host- prefix and its three preconditions (Secure, Path=/, no Domain).
// See final-review.md I4. Every other dependency is mocked so this stays a
// unit test of the cookie, not an end-to-end OAuth/Twenty test.
const evaluateAccess = vi.fn();
vi.mock('@/lib/server/auth-gate', () => ({
  evaluateAccess: (...args: unknown[]) => evaluateAccess(...args),
}));

const exchangeCodeForIdToken = vi.fn();
const verifyIdToken = vi.fn();
vi.mock('@/lib/server/google-oauth', () => ({
  exchangeCodeForIdToken: (...args: unknown[]) => exchangeCodeForIdToken(...args),
  verifyIdToken: (...args: unknown[]) => verifyIdToken(...args),
}));

const findActiveWorkspaceMember = vi.fn();
vi.mock('@/lib/server/membership', () => ({
  findActiveWorkspaceMember: (...args: unknown[]) => findActiveWorkspaceMember(...args),
}));

const identity = {
  email: 'a@fraterailabs.com', name: 'A B', hostedDomain: 'fraterailabs.com', emailVerified: true,
};
const member = { id: 'wm-1', userEmail: 'a@fraterailabs.com', name: 'A B' };

beforeEach(() => {
  vi.resetAllMocks();
  process.env.SESSION_SECRET = 'test-secret-value';
  exchangeCodeForIdToken.mockResolvedValue('id-token');
  verifyIdToken.mockResolvedValue(identity);
  findActiveWorkspaceMember.mockResolvedValue(member);
  evaluateAccess.mockReturnValue({ allowed: true, member });
});

const buildRequest = () =>
  new NextRequest('https://www.fraterailabs.com/api/auth/google/callback?code=abc&state=xyz', {
    headers: { cookie: 'frater_oauth_state=xyz' },
  });

describe('GET /api/auth/google/callback — session cookie attributes', () => {
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

// I3: the catch-all around the OAuth exchange previously swallowed every
// failure with zero signal. An operator debugging "nobody can sign in"
// needs to be able to tell a Google-side failure apart from a Twenty
// outage or a bug here.
describe('GET /api/auth/google/callback — error logging (I3)', () => {
  it('logs the error message and redirects to sign_in_failed when the downstream flow throws', async () => {
    verifyIdToken.mockRejectedValueOnce(new Error('Google verification failed'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { GET } = await import('../route');

    const res = await GET(buildRequest());

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/portal/login?error=sign_in_failed');
    expect(errorSpy).toHaveBeenCalledWith('[auth/google] callback failed', 'Google verification failed');
    errorSpy.mockRestore();
  });

  // Regression guard: exchangeCodeForIdToken/verifyIdToken can throw a
  // gaxios GaxiosError, whose `config`/`response` are own enumerable
  // properties carrying the single-use OAuth authorization `code` and the
  // full token-exchange request/response — none of which gaxios's own
  // errorRedactor strips (it only redacts client_secret/grant_type).
  // Logging the error OBJECT (not just its message) would have printed
  // that code to server logs on every token-exchange failure. This
  // reproduces that shape and asserts the logged call carries only the
  // message string, never the sensitive fields.
  it('never logs the authorization code or token-exchange request/response, even from a gaxios-shaped error', async () => {
    class FakeGaxiosError extends Error {
      config = {
        data: { code: 'live-single-use-auth-code-xyz', client_secret: 'should-also-not-leak' },
      };
      response = {
        data: { access_token: 'leaked-access-token-should-not-appear' },
      };
    }
    verifyIdToken.mockRejectedValueOnce(new FakeGaxiosError('invalid_grant'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { GET } = await import('../route');

    await GET(buildRequest());

    expect(errorSpy).toHaveBeenCalledWith('[auth/google] callback failed', 'invalid_grant');
    const loggedArgs = errorSpy.mock.calls.flat();
    expect(JSON.stringify(loggedArgs)).not.toContain('live-single-use-auth-code-xyz');
    expect(JSON.stringify(loggedArgs)).not.toContain('leaked-access-token-should-not-appear');
    errorSpy.mockRestore();
  });
});
