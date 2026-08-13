import { describe, expect, it, vi } from 'vitest';
import { applyPlan } from '../apply-plan';
import { buildPlan } from '../build-plan';
import type { ParsedRow } from '../types';

const row = (over: Partial<ParsedRow> = {}): ParsedRow => ({
  queueId: 'EV-001', leadStatus: '', country: 'USA', region: 'GA', segment: 'Bev',
  company: 'Acme Co', website: 'https://acme.test/', leadPerson: 'Ada Lovelace',
  leadTitle: 'CEO', school: 'Emory', alumniPath: 'Decision-maker alumni',
  evidenceUrl: 'https://e.test/a', evidenceSummary: 'CEO', headcount: '',
  headcountStatus: 'Needs headcount verification', qualificationStatus: 'ok',
  directEmail: '', directEmailStatus: 'Enrichment required',
  companyLinkedInLookup: 'https://www.google.com/search?q=acme',
  alumniEvidenceSearch: '', targetPersonSearch: '', targetRole: 'CEO',
  recommendedAiWorkflow: 'triage', linkedInConnectionNote: 'Hi',
  connectionNoteCharacters: '2', linkedInFollowUp: '', coldEmailSubject: '',
  coldEmail: '', owner: 'Seth', status: 'Not Contacted', notes: '', ...over,
});

// Stateful fake: keyed by `${plural}:${filter}` so it can represent "company
// A exists, company B does not" within one run, rather than one verdict per
// plural. `existing` still accepts the old plural-only seed shape (any
// filter for that plural resolves to the seeded record) for backward
// compatibility with tests that don't care about a specific filter. `create`
// and `update` register the record under the most recently queried filter
// for that plural, so a later findByFilter call with the *same* filter finds
// it — this is what lets a test assert "the server itself would still find
// this on a second lookup" as distinct from the applyPlan-level cache.
const fakeClient = (existing: Record<string, { id: string } | null> = {}) => {
  const store = new Map<string, { id: string }>();
  const pendingFilter = new Map<string, string>();

  for (const [plural, record] of Object.entries(existing)) {
    if (record) store.set(`${plural}:*`, record);
  }

  const findByFilter = vi.fn(async (plural: string, filter: string) => {
    pendingFilter.set(plural, filter);
    return store.get(`${plural}:${filter}`) ?? store.get(`${plural}:*`) ?? null;
  });

  const create = vi.fn(async (plural: string) => {
    const record = { id: `new-${plural}` };
    const filter = pendingFilter.get(plural);
    if (filter) store.set(`${plural}:${filter}`, record);
    return { data: { [plural.slice(0, -1)]: record } };
  });

  const update = vi.fn(async (plural: string) => {
    const record = { id: `upd-${plural}` };
    const filter = pendingFilter.get(plural);
    if (filter) store.set(`${plural}:${filter}`, record);
    return { data: { [plural.slice(0, -1)]: record } };
  });

  return { findByFilter, create, update };
};

describe('applyPlan', () => {
  it('writes nothing in dry-run mode', async () => {
    const client = fakeClient();
    const result = await applyPlan(buildPlan([row()], []), client as never, { dryRun: true });
    expect(client.create).not.toHaveBeenCalled();
    expect(client.update).not.toHaveBeenCalled();
    expect(result.wouldCreate.prospects).toBe(1);
  });

  it('creates records when nothing exists', async () => {
    const client = fakeClient();
    await applyPlan(buildPlan([row()], []), client as never, { dryRun: false });
    const created = client.create.mock.calls.map((c) => c[0]);
    expect(created).toContain('companies');
    expect(created).toContain('people');
    expect(created).toContain('prospects');
  });

  it('updates instead of duplicating when the prospect already exists', async () => {
    const client = fakeClient({ prospects: { id: 'p1' }, companies: { id: 'c1' }, people: { id: 'pe1' } });
    await applyPlan(buildPlan([row()], []), client as never, { dryRun: false });
    expect(client.create).not.toHaveBeenCalledWith('prospects', expect.anything());
    expect(client.update).toHaveBeenCalledWith('prospects', 'p1', expect.anything());
  });

  it('reports per-row failures without aborting the run', async () => {
    const client = fakeClient();
    client.create.mockRejectedValueOnce(new Error('boom'));
    const result = await applyPlan(buildPlan([row(), row({ queueId: 'EV-002' })], []), client as never, { dryRun: false });
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0].queueId).toBe('EV-001');
  });

  it('dedupes a company shared by two rows within one run', async () => {
    const client = fakeClient();
    const result = await applyPlan(
      buildPlan([row(), row({ queueId: 'EV-002' })], []), client as never, { dryRun: false },
    );

    const companyCreates = client.create.mock.calls.filter((call) => call[0] === 'companies');
    const prospectCreates = client.create.mock.calls.filter((call) => call[0] === 'prospects');

    expect(companyCreates).toHaveLength(1);
    expect(prospectCreates).toHaveLength(2);
    expect(result.created.companies).toBe(1);
    expect(result.created.prospects).toBe(2);
  });

  it('dedupes a shared company even when the server never reports it as existing', async () => {
    // Simulates a non-read-your-writes-consistent server: every findByFilter
    // call returns null, even immediately after a create. If dedup relied on
    // the server seeing its own writes, this would create the company twice.
    const client = {
      findByFilter: vi.fn(async () => null),
      create: vi.fn(async (plural: string) => ({ data: { [plural.slice(0, -1)]: { id: `new-${plural}` } } })),
      update: vi.fn(async (plural: string) => ({ data: { [plural.slice(0, -1)]: { id: `upd-${plural}` } } })),
    };

    await applyPlan(buildPlan([row(), row({ queueId: 'EV-002' })], []), client as never, { dryRun: false });

    const companyCreates = client.create.mock.calls.filter((call) => call[0] === 'companies');
    expect(companyCreates).toHaveLength(1);
  });
});
