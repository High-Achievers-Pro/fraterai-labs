import { beforeEach, describe, expect, it, vi } from 'vitest';

const checkActiveMembership = vi.fn();
vi.mock('../membership', () => ({
  checkActiveMembership: (...args: unknown[]) => checkActiveMembership(...args),
}));

const readSessionCookie = vi.fn();
vi.mock('../session', () => ({
  readSessionCookie: (...args: unknown[]) => readSessionCookie(...args),
}));

const { checkPortalAccess } = await import('../portal-access');

const session = { email: 'a@fraterailabs.com', name: 'A B', workspaceMemberId: 'wm-1', purpose: 'session' as const, expiresAt: Date.now() + 1000 };
const member = { id: 'wm-1', userEmail: 'a@fraterailabs.com', name: 'A B' };

beforeEach(() => {
  vi.resetAllMocks();
});

// Pins I1: the portal surface re-checks Twenty workspace membership on
// every request, so removing someone from the workspace takes effect
// without waiting out the session's TTL — and a Twenty outage during that
// re-check must not be indistinguishable from a revoked member.
describe('checkPortalAccess', () => {
  it('denies when there is no valid session cookie at all', async () => {
    readSessionCookie.mockResolvedValue(null);

    const result = await checkPortalAccess('garbage');

    expect(result).toEqual({ status: 'denied' });
    expect(checkActiveMembership).not.toHaveBeenCalled();
  });

  it('is ok when the session is valid and Twenty confirms an active member', async () => {
    readSessionCookie.mockResolvedValue(session);
    checkActiveMembership.mockResolvedValue(member);

    const result = await checkPortalAccess('valid-cookie');

    expect(checkActiveMembership).toHaveBeenCalledWith('a@fraterailabs.com');
    expect(result).toEqual({ status: 'ok', session });
  });

  it('denies when the session is validly signed but Twenty confirms the member is no longer active — the case an 8-hour TTL alone cannot catch', async () => {
    readSessionCookie.mockResolvedValue(session);
    checkActiveMembership.mockResolvedValue(null);

    const result = await checkPortalAccess('valid-cookie-revoked-member');

    expect(result).toEqual({ status: 'denied' });
  });

  it('falls back to session trust — does NOT deny — when Twenty is unreachable during the re-check', async () => {
    readSessionCookie.mockResolvedValue(session);
    checkActiveMembership.mockRejectedValue(new Error('network down'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const result = await checkPortalAccess('valid-cookie-crm-down');

    expect(result).toEqual({ status: 'unavailable', session });
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
