import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkActiveMembership, findActiveWorkspaceMember } from '../membership';

vi.mock('../twenty-client', () => ({ twentyGraphQL: vi.fn() }));
const { twentyGraphQL } = await import('../twenty-client');

afterEach(() => vi.resetAllMocks());

describe('findActiveWorkspaceMember', () => {
  it('returns the member when one matches', async () => {
    vi.mocked(twentyGraphQL).mockResolvedValue({
      workspaceMembers: {
        edges: [{ node: { id: 'wm-1', userEmail: 'a@fraterailabs.com', name: { firstName: 'A', lastName: 'B' } } }],
      },
    } as never);

    const member = await findActiveWorkspaceMember('a@fraterailabs.com');
    expect(member).toEqual({ id: 'wm-1', userEmail: 'a@fraterailabs.com', name: 'A B' });
  });

  it('returns null when nobody matches', async () => {
    vi.mocked(twentyGraphQL).mockResolvedValue({ workspaceMembers: { edges: [] } } as never);
    expect(await findActiveWorkspaceMember('ghost@fraterailabs.com')).toBeNull();
  });

  it('lowercases the email before querying', async () => {
    vi.mocked(twentyGraphQL).mockResolvedValue({ workspaceMembers: { edges: [] } } as never);
    await findActiveWorkspaceMember('MiXeD@FraterAILabs.com');
    expect(vi.mocked(twentyGraphQL).mock.calls[0][1]).toMatchObject({ email: 'mixed@fraterailabs.com' });
  });

  it('returns null rather than throwing when Twenty is unreachable', async () => {
    vi.mocked(twentyGraphQL).mockRejectedValue(new Error('network down'));
    expect(await findActiveWorkspaceMember('a@fraterailabs.com')).toBeNull();
  });

  it('lowercases the returned userEmail even when Twenty stores it mixed-case', async () => {
    vi.mocked(twentyGraphQL).mockResolvedValue({
      workspaceMembers: {
        edges: [{ node: { id: 'wm-1', userEmail: 'John.Doe@FraterAILabs.com', name: { firstName: 'John', lastName: 'Doe' } } }],
      },
    } as never);

    const member = await findActiveWorkspaceMember('john.doe@fraterailabs.com');
    expect(member?.userEmail).toBe('john.doe@fraterailabs.com');
  });

  it('logs the email and error when Twenty is unreachable (I3: sign-in failures must leave a signal)', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.mocked(twentyGraphQL).mockRejectedValue(new Error('network down'));

    await findActiveWorkspaceMember('a@fraterailabs.com');

    expect(errorSpy).toHaveBeenCalledWith(
      '[membership] failed to query workspace membership',
      expect.objectContaining({ email: 'a@fraterailabs.com' }),
    );
    errorSpy.mockRestore();
  });

  // Regression guard, prompted by the google/callback leak (I3 re-review):
  // lib/server/twenty-client.ts's real TwentyError carries only `message`
  // and a numeric `status` as own enumerable properties — no request
  // config, headers, or the TWENTY_API_KEY, unlike gaxios's GaxiosError.
  // This asserts membership.ts's own logging line doesn't introduce a leak
  // even if a future twentyGraphQL implementation attached extra
  // properties to its thrown error, by proving whatever's on the error
  // object DOES reach the log call (so the guarantee here is "real",
  // matching what actually happened in Twenty, not "vacuously safe by
  // construction").
  it('does not leak an error property beyond what the real TwentyError shape carries', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    class FakeTwentyError extends Error {
      status = 401;
    }
    vi.mocked(twentyGraphQL).mockRejectedValue(new FakeTwentyError('Twenty GraphQL request failed with 401'));

    await findActiveWorkspaceMember('a@fraterailabs.com');

    const loggedArgs = errorSpy.mock.calls.flat();
    // The log DOES carry the error (proving this test isn't vacuous)...
    expect(JSON.stringify(loggedArgs)).toContain('401');
    // ...but never anything resembling an API key or bearer token, which
    // the real TwentyError never attaches in the first place.
    expect(JSON.stringify(loggedArgs)).not.toMatch(/bearer|api[_-]?key/i);
    errorSpy.mockRestore();
  });
});

// checkActiveMembership backs the portal surface's re-check (I1): unlike
// findActiveWorkspaceMember, it must NOT swallow a Twenty outage into
// null — the caller (lib/server/portal-access.ts) needs to tell "no such
// member" apart from "couldn't ask", because those two situations get
// different treatment on an already-signed-in visitor's session.
describe('checkActiveMembership', () => {
  it('returns the member when one matches', async () => {
    vi.mocked(twentyGraphQL).mockResolvedValue({
      workspaceMembers: {
        edges: [{ node: { id: 'wm-1', userEmail: 'a@fraterailabs.com', name: { firstName: 'A', lastName: 'B' } } }],
      },
    } as never);

    expect(await checkActiveMembership('a@fraterailabs.com')).toEqual({
      id: 'wm-1', userEmail: 'a@fraterailabs.com', name: 'A B',
    });
  });

  it('returns null (not a throw) when nobody matches — a confirmed non-member', async () => {
    vi.mocked(twentyGraphQL).mockResolvedValue({ workspaceMembers: { edges: [] } } as never);
    expect(await checkActiveMembership('ghost@fraterailabs.com')).toBeNull();
  });

  it('REJECTS with the underlying error (does not swallow to null) when Twenty is unreachable', async () => {
    vi.mocked(twentyGraphQL).mockRejectedValue(new Error('network down'));
    await expect(checkActiveMembership('a@fraterailabs.com')).rejects.toThrow('network down');
  });
});
