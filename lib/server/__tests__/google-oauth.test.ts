import { beforeEach, describe, expect, it, vi } from 'vitest';

// google-auth-library's own signature/audience verification is trusted
// (it's a maintained library, not this codebase's concern) — this test
// exists only for the two fields verifyIdToken maps BY HAND from the
// verified payload: `emailVerified: payload.email_verified === true` and
// `hostedDomain: payload.hd`. Those two are exactly what
// lib/server/auth-gate.ts's evaluateAccess trusts, and final-review.md
// named this mapping as untested. Mocking OAuth2Client.verifyIdToken lets
// this test control the payload directly rather than needing a real
// signed JWT and Google's live public keys.
const getPayload = vi.fn();
const verifyIdTokenMock = vi.fn(() => ({ getPayload }));

// OAuth2Client is invoked with `new` (lib/server/google-oauth.ts's
// client()) — an arrow function passed to vi.fn() can never be used as a
// constructor (that's a plain JS rule, not a vitest quirk: `new (() =>
// {})()` throws "is not a constructor" regardless of the mocking layer),
// so this must be a real class/function, not vi.fn(() => ({...})).
class MockOAuth2Client {
  verifyIdToken = verifyIdTokenMock;
}
vi.mock('google-auth-library', () => ({
  OAuth2Client: MockOAuth2Client,
}));

const { verifyIdToken } = await import('../google-oauth');

beforeEach(() => {
  getPayload.mockReset();
  process.env.GOOGLE_CLIENT_ID = 'client-id';
  process.env.GOOGLE_CLIENT_SECRET = 'client-secret';
  process.env.GOOGLE_REDIRECT_URI = 'https://www.fraterailabs.com/api/auth/google/callback';
});

describe('verifyIdToken field derivation', () => {
  it('maps email_verified === true to emailVerified: true', async () => {
    getPayload.mockReturnValue({ email: 'a@fraterailabs.com', email_verified: true, hd: 'fraterailabs.com' });

    const identity = await verifyIdToken('token');

    expect(identity.emailVerified).toBe(true);
  });

  it('maps a falsy or missing email_verified to emailVerified: false', async () => {
    getPayload.mockReturnValue({ email: 'a@fraterailabs.com' });
    expect((await verifyIdToken('token')).emailVerified).toBe(false);

    getPayload.mockReturnValue({ email: 'a@fraterailabs.com', email_verified: false });
    expect((await verifyIdToken('token')).emailVerified).toBe(false);
  });

  // Strict === true, not a truthy check: a string "true" (which some JWT
  // decoders could plausibly hand back for a non-boolean claim) must NOT
  // be treated as verified.
  it('does not treat a truthy non-boolean email_verified as verified', async () => {
    getPayload.mockReturnValue({ email: 'a@fraterailabs.com', email_verified: 'true' });

    expect((await verifyIdToken('token')).emailVerified).toBe(false);
  });

  it('passes through the hd claim as hostedDomain when present', async () => {
    getPayload.mockReturnValue({ email: 'a@fraterailabs.com', email_verified: true, hd: 'fraterailabs.com' });

    expect((await verifyIdToken('token')).hostedDomain).toBe('fraterailabs.com');
  });

  it('leaves hostedDomain undefined when hd is absent (e.g. a personal Gmail account)', async () => {
    getPayload.mockReturnValue({ email: 'someone@gmail.com', email_verified: true });

    expect((await verifyIdToken('token')).hostedDomain).toBeUndefined();
  });

  it('lowercases the email', async () => {
    getPayload.mockReturnValue({ email: 'A@FraterAILabs.com', email_verified: true });

    expect((await verifyIdToken('token')).email).toBe('a@fraterailabs.com');
  });

  it('falls back to the email when name is absent', async () => {
    getPayload.mockReturnValue({ email: 'a@fraterailabs.com', email_verified: true });

    expect((await verifyIdToken('token')).name).toBe('a@fraterailabs.com');
  });

  it('throws when the verified payload has no email at all', async () => {
    getPayload.mockReturnValue({ email_verified: true });

    await expect(verifyIdToken('token')).rejects.toThrow('Google token has no email');
  });
});
