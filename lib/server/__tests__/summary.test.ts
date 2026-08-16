import { afterEach, describe, expect, it, vi } from 'vitest';
import { getPortalSummary, MAX_PROSPECT_PAGES } from '../summary';

vi.mock('../twenty-client', () => ({ twentyGraphQL: vi.fn() }));
const { twentyGraphQL } = await import('../twenty-client');

afterEach(() => vi.resetAllMocks());

describe('getPortalSummary', () => {
  it('summarises prospects by stage', async () => {
    vi.mocked(twentyGraphQL).mockResolvedValue({
      prospects: {
        totalCount: 252,
        edges: [
          { node: { stage: 'SOURCED' } },
          { node: { stage: 'SOURCED' } },
          { node: { stage: 'ENRICHED' } },
        ],
      },
      outreaches: { totalCount: 5 },
    } as never);

    const summary = await getPortalSummary();
    expect(summary.totalProspects).toBe(252);
    expect(summary.byStage.SOURCED).toBe(2);
    expect(summary.byStage.ENRICHED).toBe(1);
  });

  it('reports zeroes rather than throwing when Twenty is unreachable', async () => {
    vi.mocked(twentyGraphQL).mockRejectedValue(new Error('down'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const summary = await getPortalSummary();
    expect(summary.totalProspects).toBe(0);
    expect(summary.unavailable).toBe(true);

    // I3: an operator debugging "the portal shows no data" needs a signal
    // distinguishing a CRM outage from a broken query.
    expect(errorSpy).toHaveBeenCalledWith('[summary] failed to load portal summary', expect.any(Error));
    errorSpy.mockRestore();
  });

  // Regression guard, prompted by the google/callback leak (I3 re-review):
  // lib/server/twenty-client.ts's real TwentyError carries only `message`
  // and a numeric `status` as own enumerable properties — no request
  // config, headers, or the TWENTY_API_KEY, unlike gaxios's GaxiosError.
  // Proves the logged error DOES carry status (so this isn't vacuous) but
  // never anything resembling a bearer token or API key.
  it('does not leak an error property beyond what the real TwentyError shape carries', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    class FakeTwentyError extends Error {
      status = 401;
    }
    vi.mocked(twentyGraphQL).mockRejectedValue(new FakeTwentyError('Twenty GraphQL request failed with 401'));

    await getPortalSummary();

    const loggedArgs = errorSpy.mock.calls.flat();
    expect(JSON.stringify(loggedArgs)).toContain('401');
    expect(JSON.stringify(loggedArgs)).not.toMatch(/bearer|api[_-]?key/i);
    errorSpy.mockRestore();
  });

  it('paginates past the first page rather than silently under-counting byStage against totalCount', async () => {
    vi.mocked(twentyGraphQL)
      .mockResolvedValueOnce({
        prospects: {
          totalCount: 3,
          edges: [{ node: { stage: 'SOURCED' } }],
          pageInfo: { hasNextPage: true, endCursor: 'cursor-1' },
        },
        outreaches: { totalCount: 0 },
      } as never)
      .mockResolvedValueOnce({
        prospects: {
          totalCount: 3,
          edges: [{ node: { stage: 'SOURCED' } }, { node: { stage: 'ENRICHED' } }],
          pageInfo: { hasNextPage: false, endCursor: null },
        },
        outreaches: { totalCount: 0 },
      } as never);

    const summary = await getPortalSummary();

    expect(summary.unavailable).toBe(false);
    expect(summary.totalProspects).toBe(3);
    expect(summary.byStage.SOURCED).toBe(2);
    expect(summary.byStage.ENRICHED).toBe(1);
    expect(twentyGraphQL).toHaveBeenCalledTimes(2);
    expect(vi.mocked(twentyGraphQL).mock.calls[1][1]).toMatchObject({ after: 'cursor-1' });
  });

  it('reports unavailable rather than returning a truncated read when pagination never terminates', async () => {
    vi.mocked(twentyGraphQL).mockResolvedValue({
      prospects: {
        totalCount: 999999,
        edges: [{ node: { stage: 'SOURCED' } }],
        pageInfo: { hasNextPage: true, endCursor: 'always-more' },
      },
      outreaches: { totalCount: 0 },
    } as never);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const summary = await getPortalSummary();
    errorSpy.mockRestore();

    expect(summary.unavailable).toBe(true);
    expect(summary.totalProspects).toBe(0);
    expect(twentyGraphQL).toHaveBeenCalledTimes(MAX_PROSPECT_PAGES);
  });
});
