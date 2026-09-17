import { beforeEach, describe, expect, it } from 'vitest';
import { createMagicToken, readMagicToken } from '../magic-link';
import { createSessionCookie } from '../session';

beforeEach(() => {
  process.env.SESSION_SECRET = 'test-secret-value';
  process.env.PORTAL_EMAIL_ALLOWLIST = 'contractor@partner.test';
});

describe('magic link tokens', () => {
  it('round-trips the email', async () => {
    const t = await createMagicToken('contractor@partner.test');
    expect((await readMagicToken(t))?.email).toBe('contractor@partner.test');
  });

  it('normalises the email to lowercase', async () => {
    const t = await createMagicToken('Contractor@Partner.test');
    expect((await readMagicToken(t))?.email).toBe('contractor@partner.test');
  });

  it('rejects a tampered payload', async () => {
    const t = await createMagicToken('contractor@partner.test');
    const [body, sig] = t.split('.');
    const forged = Buffer.from(JSON.stringify({
      email: 'attacker@evil.test', purpose: 'magic-link', expiresAt: Date.now() + 60000,
    })).toString('base64url');
    expect(await readMagicToken(`${forged}.${sig}`)).toBeNull();
  });

  it('rejects an expired token', async () => {
    const t = await createMagicToken('contractor@partner.test', -1);
    expect(await readMagicToken(t)).toBeNull();
  });

  it('REFUSES a session cookie presented as a magic token', async () => {
    const session = await createSessionCookie(
      { email: 'contractor@partner.test', name: 'C', workspaceMemberId: 'wm-1' }, 3600,
    );
    expect(await readMagicToken(session)).toBeNull();
  });

  it('rejects a token for an address no longer on the allowlist', async () => {
    const t = await createMagicToken('contractor@partner.test');
    process.env.PORTAL_EMAIL_ALLOWLIST = '';
    expect(await readMagicToken(t)).toBeNull();
  });

  it('rejects malformed input', async () => {
    expect(await readMagicToken('')).toBeNull();
    expect(await readMagicToken('nodot')).toBeNull();
  });
});
