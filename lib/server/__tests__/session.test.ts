import { beforeEach, describe, expect, it } from 'vitest';
import { createMagicToken } from '../magic-link';
import { SESSION_COOKIE_NAME, createSessionCookie, readSessionCookie } from '../session';

const payload = {
  email: 'someone@fraterailabs.com',
  name: 'Some One',
  workspaceMemberId: 'wm-1',
};

beforeEach(() => { process.env.SESSION_SECRET = 'test-secret-value'; });

describe('session', () => {
  it('round-trips a payload', async () => {
    const cookie = await createSessionCookie(payload, 3600);
    const session = await readSessionCookie(cookie);
    expect(session?.email).toBe(payload.email);
    expect(session?.workspaceMemberId).toBe('wm-1');
  });

  it('rejects a tampered payload', async () => {
    const cookie = await createSessionCookie(payload, 3600);
    const [body, signature] = cookie.split('.');
    const forged = Buffer.from(
      JSON.stringify({ ...payload, email: 'attacker@evil.test', expiresAt: Date.now() + 3600_000 }),
    ).toString('base64url');
    expect(await readSessionCookie(`${forged}.${signature}`)).toBeNull();
    expect(await readSessionCookie(`${body}.deadbeef`)).toBeNull();
  });

  it('rejects an expired session', async () => {
    const cookie = await createSessionCookie(payload, -1);
    expect(await readSessionCookie(cookie)).toBeNull();
  });

  it('rejects malformed input', async () => {
    expect(await readSessionCookie('')).toBeNull();
    expect(await readSessionCookie('nodot')).toBeNull();
    expect(await readSessionCookie('a.b.c')).toBeNull();
  });

  it('rejects a session signed with a different secret', async () => {
    const cookie = await createSessionCookie(payload, 3600);
    process.env.SESSION_SECRET = 'rotated-secret';
    expect(await readSessionCookie(cookie)).toBeNull();
  });

  it('stamps the payload with purpose: session', async () => {
    const cookie = await createSessionCookie(payload, 3600);
    const session = await readSessionCookie(cookie);
    expect(session?.purpose).toBe('session');
  });

  it('REFUSES a magic-link token presented as a session cookie', async () => {
    const token = await createMagicToken('someone@fraterailabs.com');
    expect(await readSessionCookie(token)).toBeNull();
  });

  // Pins I4: the __Host- prefix is what makes the browser enforce Secure,
  // Path=/, and no Domain on this cookie. See session.ts's own comment.
  it('carries the __Host- prefix', () => {
    expect(SESSION_COOKIE_NAME.startsWith('__Host-')).toBe(true);
  });
});
