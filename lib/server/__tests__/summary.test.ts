import { afterEach, describe, expect, it, vi } from 'vitest';
import { getPortalSummary } from '../summary';

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
});
