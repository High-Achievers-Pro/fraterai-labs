import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const checkPortalAccess = vi.fn();
vi.mock('@/lib/server/portal-access', () => ({
  checkPortalAccess: (...args: unknown[]) => checkPortalAccess(...args),
}));

const getPortalSummary = vi.fn();
vi.mock('@/lib/server/summary', () => ({
  getPortalSummary: (...args: unknown[]) => getPortalSummary(...args),
}));

const session = { email: 'a@fraterailabs.com', name: 'A B', workspaceMemberId: 'wm-1' };
const summary = { totalProspects: 252, byStage: {}, enrichmentProgress: 0.5, outreachThisWeek: 3, unavailable: false };

const buildRequest = () =>
  new NextRequest('https://www.fraterailabs.com/api/portal/summary', {
    headers: { cookie: '__Host-frater_portal_session=cookie-body.cookie-sig' },
  });

beforeEach(() => vi.resetAllMocks());

describe('GET /api/portal/summary', () => {
  it('returns the summary when access is ok', async () => {
    checkPortalAccess.mockResolvedValue({ status: 'ok', session });
    getPortalSummary.mockResolvedValue(summary);
    const { GET } = await import('../route');

    const res = await GET(buildRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual(summary);
  });

  it('returns 401 without calling getPortalSummary when access is denied', async () => {
    checkPortalAccess.mockResolvedValue({ status: 'denied' });
    const { GET } = await import('../route');

    const res = await GET(buildRequest());

    expect(res.status).toBe(401);
    expect(getPortalSummary).not.toHaveBeenCalled();
  });

  // Pins I1's outage decision at this call site: a Twenty outage during the
  // membership re-check must not read as "unauthorized" — it degrades to
  // whatever getPortalSummary itself reports for the same outage.
  it('does NOT return 401 when Twenty is unreachable during the re-check — falls back to session trust', async () => {
    checkPortalAccess.mockResolvedValue({ status: 'unavailable', session });
    getPortalSummary.mockResolvedValue({ totalProspects: 0, byStage: {}, enrichmentProgress: 0, outreachThisWeek: 0, unavailable: true });
    const { GET } = await import('../route');

    const res = await GET(buildRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.unavailable).toBe(true);
  });
});
