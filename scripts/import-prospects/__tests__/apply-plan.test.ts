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

type Stored = { id: string; plural: string; fields: Record<string, unknown> };

// Stateful fake Twenty server.
//
// Records are stored under the *exact filter string* that failed to find them,
// and a lookup only hits when the importer sends that identical string. An
// earlier fake seeded records under `plural:*` so any filter resolved — which
// meant the suite passed with a syntactically broken filter, and is how a
// company-blind person filter survived review.
//
// The store survives across applyPlan() calls, so a test can run the importer
// twice, and can edit a record in between to stand in for work a human did
// inside the CRM.
const fakeServer = (
  seed: Record<string, { id: string; fields?: Record<string, unknown> }> = {},
) => {
  const byFilter = new Map<string, Stored>();
  const pendingFilter = new Map<string, string>();
  let nextId = 0;

  for (const [key, { id, fields }] of Object.entries(seed)) {
    byFilter.set(key, { id, plural: key.slice(0, key.indexOf(':')), fields: { ...fields } });
  }

  const findByFilter = vi.fn(async (plural: string, filter: string) => {
    pendingFilter.set(plural, filter);
    const hit = byFilter.get(`${plural}:${filter}`);
    return hit ? { id: hit.id } : null;
  });

  const create = vi.fn(async (plural: string, body: Record<string, unknown>) => {
    const filter = pendingFilter.get(plural);
    if (!filter) throw new Error(`create(${plural}) with no preceding lookup`);
    nextId += 1;
    const record: Stored = { id: `${plural}-${nextId}`, plural, fields: { ...body } };
    byFilter.set(`${plural}:${filter}`, record);
    return { data: { [plural.slice(0, -1)]: { id: record.id } } };
  });

  const update = vi.fn(async (plural: string, id: string, body: Record<string, unknown>) => {
    const record = [...byFilter.values()].find((r) => r.id === id);
    if (!record) throw new Error(`update of unknown ${plural} ${id}`);
    Object.assign(record.fields, body);
    return { data: { [plural.slice(0, -1)]: { id } } };
  });

  const all = (plural: string) => [...byFilter.values()].filter((r) => r.plural === plural);
  const only = (plural: string) => {
    const records = all(plural);
    expect(records).toHaveLength(1);
    return records[0];
  };

  return { findByFilter, create, update, all, only };
};

const createBodies = (client: ReturnType<typeof fakeServer>, plural: string) =>
  client.create.mock.calls.filter((c) => c[0] === plural).map((c) => c[1] as Record<string, unknown>);

const updateBodies = (client: ReturnType<typeof fakeServer>, plural: string) =>
  client.update.mock.calls.filter((c) => c[0] === plural).map((c) => c[2] as Record<string, unknown>);

describe('applyPlan', () => {
  it('writes nothing in dry-run mode', async () => {
    const client = fakeServer();
    const result = await applyPlan(buildPlan([row()], []), client as never, { dryRun: true });
    expect(client.create).not.toHaveBeenCalled();
    expect(client.update).not.toHaveBeenCalled();
    expect(result.wouldCreate.prospects).toBe(1);
  });

  it('creates records when nothing exists', async () => {
    const client = fakeServer();
    await applyPlan(buildPlan([row()], []), client as never, { dryRun: false });
    const created = client.create.mock.calls.map((c) => c[0]);
    expect(created).toContain('companies');
    expect(created).toContain('people');
    expect(created).toContain('prospects');
  });

  it('updates instead of duplicating when the prospect already exists', async () => {
    const client = fakeServer({
      'companies:name[eq]:Acme Co': { id: 'c1' },
      'prospects:queueId[eq]:EV-001': { id: 'p1' },
    });
    await applyPlan(buildPlan([row()], []), client as never, { dryRun: false });
    expect(client.create).not.toHaveBeenCalledWith('prospects', expect.anything());
    expect(client.update).toHaveBeenCalledWith('prospects', 'p1', expect.anything());
  });

  it('reports per-row failures without aborting the run', async () => {
    const client = fakeServer();
    client.create.mockRejectedValueOnce(new Error('boom'));
    const result = await applyPlan(
      buildPlan([row(), row({ queueId: 'EV-002' })], []), client as never, { dryRun: false },
    );

    expect(result.failures).toHaveLength(1);
    expect(result.failures[0].queueId).toBe('EV-001');

    // The point of isolation: the *second* row still went through. Without
    // this, a regression that stopped at the first failure would still pass.
    expect(createBodies(client, 'prospects').map((b) => b.queueId)).toEqual(['EV-002']);
    expect(result.created.prospects).toBe(1);
  });

  it('dedupes a company shared by two rows within one run', async () => {
    const client = fakeServer();
    const result = await applyPlan(
      buildPlan([row(), row({ queueId: 'EV-002' })], []), client as never, { dryRun: false },
    );

    expect(createBodies(client, 'companies')).toHaveLength(1);
    expect(createBodies(client, 'prospects')).toHaveLength(2);
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

  it('creates a separate person per company when two companies share a lead name', async () => {
    // The real sheet has one name across ten companies. Keyed on name alone,
    // rows 2..N are cached away: never written, their title and evidence lost,
    // and their prospects linked to another company's employee.
    const client = fakeServer();
    const plan = buildPlan([
      row({ queueId: 'CMU-033', leadPerson: 'Founder Name', company: 'Alpha Inc', leadTitle: 'CEO' }),
      row({ queueId: 'CMU-034', leadPerson: 'Founder Name', company: 'Beta Inc', leadTitle: 'CTO' }),
    ], []);

    await applyPlan(plan, client as never, { dryRun: false });

    const people = createBodies(client, 'people');
    expect(people).toHaveLength(2);
    expect(people.map((p) => p.jobTitle)).toEqual(['CEO', 'CTO']);
    // Each person is attached to its own company, and each prospect to its own person.
    expect(new Set(people.map((p) => p.companyId)).size).toBe(2);
    const prospects = createBodies(client, 'prospects');
    expect(prospects[0].personId).not.toBe(prospects[1].personId);
    expect(prospects[0].companyId).toBe(people[0].companyId);
    expect(prospects[1].companyId).toBe(people[1].companyId);
  });

  describe('running the importer a second time', () => {
    const rows = [row(), row({ queueId: 'EV-002' }), row({ queueId: 'EV-003', company: 'Other Co' })];

    it('updates in place instead of duplicating everything', async () => {
      const client = fakeServer();
      const first = await applyPlan(buildPlan(rows, []), client as never, { dryRun: false });
      expect(first.created.prospects).toBe(3);

      const second = await applyPlan(buildPlan(rows, []), client as never, { dryRun: false });

      expect(second.created).toEqual({ companies: 0, people: 0, prospects: 0, outreaches: 0 });
      expect(second.updated.prospects).toBe(3);
      expect(second.failures).toEqual([]);
      // The server holds one record per prospect, not two.
      expect(client.all('prospects')).toHaveLength(3);
      expect(client.all('companies')).toHaveLength(2);
    });

    it('leaves pipeline state advanced inside the CRM alone', async () => {
      const client = fakeServer();
      await applyPlan(buildPlan([row()], []), client as never, { dryRun: false });

      // Stand in for the team working the record between runs.
      const prospect = client.only('prospects');
      const outreach = client.only('outreaches');
      const person = client.only('people');
      const company = client.only('companies');
      prospect.fields.stage = 'CONTACTED';
      outreach.fields.status = 'SENT';
      outreach.fields.sentAt = '2026-08-01T00:00:00Z';
      person.fields.directEmailStatus = 'FOUND';
      company.fields.headcountStatus = 'VERIFIED_IN_ICP';

      await applyPlan(buildPlan([row()], []), client as never, { dryRun: false });

      expect(prospect.fields.stage).toBe('CONTACTED');
      expect(outreach.fields.status).toBe('SENT');
      expect(outreach.fields.generatedBy).toBe('HUMAN');
      expect(person.fields.directEmailStatus).toBe('FOUND');
      expect(company.fields.headcountStatus).toBe('VERIFIED_IN_ICP');

      // State fields are absent from the update bodies entirely...
      expect(updateBodies(client, 'prospects')[0]).not.toHaveProperty('stage');
      expect(updateBodies(client, 'outreaches')[0]).not.toHaveProperty('status');
      expect(updateBodies(client, 'outreaches')[0]).not.toHaveProperty('generatedBy');
      expect(updateBodies(client, 'outreaches')[0]).not.toHaveProperty('model');
      expect(updateBodies(client, 'people')[0]).not.toHaveProperty('directEmailStatus');
      expect(updateBodies(client, 'companies')[0]).not.toHaveProperty('headcountStatus');

      // ...while sheet content is still refreshed.
      expect(updateBodies(client, 'people')[0].jobTitle).toBe('CEO');
      expect(updateBodies(client, 'prospects')[0].queueId).toBe('EV-001');
      expect(updateBodies(client, 'companies')[0].segment).toBe('Bev');
      expect(updateBodies(client, 'outreaches')[0].body).toBe('Hi');
    });

    it('sends the state fields on create', async () => {
      const client = fakeServer();
      await applyPlan(buildPlan([row()], []), client as never, { dryRun: false });
      expect(createBodies(client, 'prospects')[0].stage).toBe('SOURCED');
      expect(createBodies(client, 'people')[0].directEmailStatus).toBe('ENRICHMENT_REQUIRED');
      expect(createBodies(client, 'companies')[0].headcountStatus).toBe('NEEDS_VERIFICATION');
      expect(createBodies(client, 'outreaches')[0].status).toBe('DRAFT');
    });
  });

  it('uses one definition of identity for the cache and the server', async () => {
    // The cache short-circuits the lookup, so it has to key on exactly the
    // filter the server is asked. Lowercasing the cache key while sending the
    // filter verbatim makes the two disagree: within a run two casings of a
    // company collapse to one record, but the case-sensitive server filter
    // misses on the next run and creates the duplicate anyway — the worst of
    // both, and the in-run collapse hides it.
    const client = fakeServer();
    const rows = [row(), row({ queueId: 'EV-002', company: 'acme co' })];

    const first = await applyPlan(buildPlan(rows, []), client as never, { dryRun: false });
    expect(client.findByFilter.mock.calls.filter((c) => c[0] === 'companies').map((c) => c[1]))
      .toEqual(['name[eq]:Acme Co', 'name[eq]:acme co']);
    expect(first.created.companies).toBe(2);

    const second = await applyPlan(buildPlan(rows, []), client as never, { dryRun: false });
    expect(second.created.companies).toBe(0);
    expect(client.all('companies')).toHaveLength(2);
  });

  it('omits absent optionals rather than sending them as undefined', async () => {
    // Explicit, not a side effect of JSON.stringify: an empty Direct Email
    // column must not blank an address a human added in the CRM.
    const client = fakeServer();
    await applyPlan(
      buildPlan([row({ website: 'https://www.google.com/search?q=acme' })], []),
      client as never, { dryRun: false },
    );
    expect(createBodies(client, 'people')[0]).not.toHaveProperty('emails');
    expect(createBodies(client, 'companies')[0]).not.toHaveProperty('domainName');
  });

  it('sets ownerId on the prospect body when the owner resolves', async () => {
    const client = fakeServer();
    const ownerIdByOwnerText = new Map([['Seth', 'wm-1']]);
    await applyPlan(
      buildPlan([row()], []), client as never, { dryRun: false, ownerIdByOwnerText },
    );
    expect(createBodies(client, 'prospects')[0].ownerId).toBe('wm-1');
  });

  it('omits ownerId rather than sending undefined when the owner does not resolve', async () => {
    const client = fakeServer();
    const ownerIdByOwnerText = new Map<string, string | undefined>([['Seth', undefined]]);
    await applyPlan(
      buildPlan([row()], []), client as never, { dryRun: false, ownerIdByOwnerText },
    );
    expect(createBodies(client, 'prospects')[0]).not.toHaveProperty('ownerId');
  });

  it('omits ownerId when no owner map is passed at all', async () => {
    const client = fakeServer();
    await applyPlan(buildPlan([row()], []), client as never, { dryRun: false });
    expect(createBodies(client, 'prospects')[0]).not.toHaveProperty('ownerId');
  });

  it('fails the row when a create response carries no usable record id', async () => {
    // `{ data: { id } }` instead of `{ data: { company: { id } } }` used to
    // yield undefined, and the person was then created with an undefined
    // companyId: silently unlinked, no error.
    const client = fakeServer();
    client.create.mockImplementationOnce(async () => ({ data: { id: 'not-nested' } } as never));

    const result = await applyPlan(buildPlan([row()], []), client as never, { dryRun: false });

    expect(result.failures).toHaveLength(1);
    expect(result.failures[0].error).toMatch(/no usable record id/);
    expect(client.create).not.toHaveBeenCalledWith('people', expect.anything());
  });
});
