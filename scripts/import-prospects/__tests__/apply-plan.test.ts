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

const fakeClient = (existing: Record<string, { id: string } | null> = {}) => ({
  findByFilter: vi.fn(async (plural: string) => existing[plural] ?? null),
  create: vi.fn(async (plural: string) => ({ data: { [plural.slice(0, -1)]: { id: `new-${plural}` } } })),
  update: vi.fn(async (plural: string) => ({ data: { [plural.slice(0, -1)]: { id: `upd-${plural}` } } })),
});

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
});
