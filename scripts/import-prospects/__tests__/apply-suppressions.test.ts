import { describe, expect, it, vi } from 'vitest';
import { applySuppressions } from '../apply-suppressions';

// No network — a hand-rolled fake client, same shape as the fakeServer in
// apply-plan.test.ts but simpler since suppression only ever finds and
// updates companies, never creates.
const fakeClient = (existing: Record<string, { id: string }> = {}) => {
  const findByFilter = vi.fn(async (plural: string, filter: string) => {
    const hit = existing[`${plural}:${filter}`];
    return hit ? { id: hit.id } : null;
  });
  const update = vi.fn(async (plural: string, id: string, body: Record<string, unknown>) => ({
    data: { [plural.slice(0, -1)]: { id, ...body } },
  }));
  const create = vi.fn();
  return { findByFilter, update, create };
};

describe('applySuppressions', () => {
  it('reports zero matches cleanly against an empty/non-overlapping CRM — the real sheet\'s case', async () => {
    const client = fakeClient(); // nothing exists
    const suppressed = [
      { name: 'Harts Plumbers, Electricians & HVAC Technicians', reason: 'prior outreach' },
      { name: 'Golden Rule Plumbing, Heating, Cooling & Electrical', reason: 'prior outreach' },
    ];

    const result = await applySuppressions(suppressed, client as never, { dryRun: false });

    expect(result).toEqual({ total: 2, matched: 0, marked: 0, failures: [] });
    expect(client.update).not.toHaveBeenCalled();
  });

  it('escapes a comma in the lookup filter instead of crashing — the bug this replaces', async () => {
    const client = fakeClient();
    await applySuppressions(
      [{ name: 'Harts Plumbers, Electricians & HVAC Technicians', reason: 'prior outreach' }],
      client as never, { dryRun: false },
    );

    expect(client.findByFilter).toHaveBeenCalledWith(
      'companies', 'name[eq]:"Harts Plumbers, Electricians & HVAC Technicians"',
    );
  });

  it('marks a matched company with isSuppressed and the reason', async () => {
    const client = fakeClient({ 'companies:name[eq]:Acme Co': { id: 'c1' } });
    const result = await applySuppressions(
      [{ name: 'Acme Co', reason: 'competitor' }], client as never, { dryRun: false },
    );

    expect(result).toEqual({ total: 1, matched: 1, marked: 1, failures: [] });
    expect(client.update).toHaveBeenCalledWith('companies', 'c1', {
      isSuppressed: true, suppressionReason: 'competitor',
    });
  });

  it('counts a match but writes nothing in dry-run mode', async () => {
    const client = fakeClient({ 'companies:name[eq]:Acme Co': { id: 'c1' } });
    const result = await applySuppressions(
      [{ name: 'Acme Co', reason: 'competitor' }], client as never, { dryRun: true },
    );

    expect(result).toEqual({ total: 1, matched: 1, marked: 0, failures: [] });
    expect(client.update).not.toHaveBeenCalled();
  });

  it('isolates a per-company failure instead of aborting the rest of the list', async () => {
    const client = fakeClient({ 'companies:name[eq]:Beta Co': { id: 'c2' } });
    const result = await applySuppressions(
      [
        { name: 'Acme [East]', reason: 'unescapable name' }, // escapeFilterValue throws
        { name: 'Beta Co', reason: 'competitor' },
      ],
      client as never, { dryRun: false },
    );

    expect(result.total).toBe(2);
    expect(result.matched).toBe(1);
    expect(result.marked).toBe(1);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0].name).toBe('Acme [East]');
    expect(result.failures[0].error).toMatch(/Acme/);
    // The second entry still went through despite the first one failing.
    expect(client.update).toHaveBeenCalledWith('companies', 'c2', expect.anything());
  });

  it('isolates an update failure to its own entry', async () => {
    const client = fakeClient({
      'companies:name[eq]:Acme Co': { id: 'c1' },
      'companies:name[eq]:Beta Co': { id: 'c2' },
    });
    client.update.mockRejectedValueOnce(new Error('server exploded'));

    const result = await applySuppressions(
      [
        { name: 'Acme Co', reason: 'r1' },
        { name: 'Beta Co', reason: 'r2' },
      ],
      client as never, { dryRun: false },
    );

    expect(result.matched).toBe(2);
    expect(result.marked).toBe(1);
    expect(result.failures).toEqual([{ name: 'Acme Co', error: 'server exploded' }]);
  });

  it('reports the exact zero-overlap shape for the real 50-entry suppression list size', async () => {
    const client = fakeClient();
    const fiftyEntries = Array.from({ length: 50 }, (_, i) => ({
      name: `Suppressed Co ${i}`, reason: 'prior outreach',
    }));

    const result = await applySuppressions(fiftyEntries, client as never, { dryRun: true });

    expect(result.total).toBe(50);
    expect(result.matched).toBe(0);
    expect(result.marked).toBe(0);
    expect(result.failures).toEqual([]);
  });
});
