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
    const summary = await getPortalSummary();
    expect(summary.totalProspects).toBe(0);
    expect(summary.unavailable).toBe(true);
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

    const summary = await getPortalSummary();

    expect(summary.unavailable).toBe(true);
    expect(summary.totalProspects).toBe(0);
    expect(twentyGraphQL).toHaveBeenCalledTimes(MAX_PROSPECT_PAGES);
  });
});
