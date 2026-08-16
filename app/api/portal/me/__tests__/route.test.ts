import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const checkPortalAccess = vi.fn();
vi.mock('@/lib/server/portal-access', () => ({
  checkPortalAccess: (...args: unknown[]) => checkPortalAccess(...args),
}));

const session = { email: 'a@fraterailabs.com', name: 'A B', workspaceMemberId: 'wm-1' };

const buildRequest = () =>
  new NextRequest('https://www.fraterailabs.com/api/portal/me', {
    headers: { cookie: '__Host-frater_portal_session=cookie-body.cookie-sig' },
  });

beforeEach(() => vi.resetAllMocks());

describe('GET /api/portal/me', () => {
  it('returns the session fields when access is ok', async () => {
    checkPortalAccess.mockResolvedValue({ status: 'ok', session });
    const { GET } = await import('../route');

    const res = await GET(buildRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual(session);
  });

  it('returns 401 when access is denied', async () => {
    checkPortalAccess.mockResolvedValue({ status: 'denied' });
    const { GET } = await import('../route');

    const res = await GET(buildRequest());

    expect(res.status).toBe(401);
  });

  // Pins I1's outage decision at this call site: a Twenty outage during
  // the membership re-check must not read as "unauthorized" to a visitor
  // whose session is otherwise valid.
  it('does NOT return 401 when Twenty is unreachable during the re-check — falls back to session trust', async () => {
    checkPortalAccess.mockResolvedValue({ status: 'unavailable', session });
    const { GET } = await import('../route');

    const res = await GET(buildRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual(session);
  });
});
