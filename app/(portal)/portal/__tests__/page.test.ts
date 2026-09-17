import { beforeEach, describe, expect, it, vi } from 'vitest';

const checkPortalAccess = vi.fn();
vi.mock('@/lib/server/portal-access', () => ({
  checkPortalAccess: (...args: unknown[]) => checkPortalAccess(...args),
}));

const getPortalSummary = vi.fn();
vi.mock('@/lib/server/summary', () => ({
  getPortalSummary: (...args: unknown[]) => getPortalSummary(...args),
}));

const cookieGet = vi.fn();
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: cookieGet }),
}));

class RedirectSignal extends Error {
  constructor(readonly destination: string) {
    super('NEXT_REDIRECT');
  }
}
const redirect = vi.fn((destination: string) => {
  throw new RedirectSignal(destination);
});
vi.mock('next/navigation', () => ({
  redirect: (...args: [string]) => redirect(...args),
}));

const session = { email: 'a@fraterailabs.com', name: 'A B', workspaceMemberId: 'wm-1' };
const summary = { totalProspects: 252, byStage: {}, enrichmentProgress: 0.5, outreachThisWeek: 3, unavailable: false };

beforeEach(() => {
  vi.resetAllMocks();
  cookieGet.mockReturnValue({ value: 'cookie-body.cookie-sig' });
});

// Pins I1 on the portal page itself: a denied membership re-check must
// redirect to login (not silently render), and an unreachable-CRM
// re-check must NOT redirect — the visitor keeps the access their session
// already established, degrading via the summary's own unavailable state
// instead of being logged out.
describe('PortalPage — membership re-check (I1)', () => {
  it('redirects to /portal/login?error=not_authorized when access is denied', async () => {
    checkPortalAccess.mockResolvedValue({ status: 'denied' });
    const { default: PortalPage } = await import('../page');

    await expect(PortalPage()).rejects.toThrow('NEXT_REDIRECT');
    expect(redirect).toHaveBeenCalledWith('/portal/login?error=not_authorized');
    expect(getPortalSummary).not.toHaveBeenCalled();
  });

  it('does not redirect and renders when access is ok', async () => {
    checkPortalAccess.mockResolvedValue({ status: 'ok', session });
    getPortalSummary.mockResolvedValue(summary);
    const { default: PortalPage } = await import('../page');

    const element = await PortalPage();

    expect(redirect).not.toHaveBeenCalled();
    expect(element).toBeTruthy();
  });

  it('does not redirect when Twenty is unreachable during the re-check (falls back to session trust)', async () => {
    checkPortalAccess.mockResolvedValue({ status: 'unavailable', session });
    getPortalSummary.mockResolvedValue({ ...summary, unavailable: true });
    const { default: PortalPage } = await import('../page');

    const element = await PortalPage();

    expect(redirect).not.toHaveBeenCalled();
    expect(element).toBeTruthy();
  });
});
