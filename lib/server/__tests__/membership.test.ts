import { afterEach, describe, expect, it, vi } from 'vitest';
import { findActiveWorkspaceMember } from '../membership';

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
});
