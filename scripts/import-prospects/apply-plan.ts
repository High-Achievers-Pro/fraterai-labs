import type { ImportPlan, PlanEntry } from './types';
import type { TwentyClient } from './twenty-rest';

export type ApplyOptions = {
  dryRun: boolean;
  // Resolved from the sheet's free-text Owner column to a workspaceMember id
  // by import.ts's owner-resolution step (see resolve-owners.ts), keyed on
  // the owner text exactly as trimmed from the row. Absent, or a row whose
  // trimmed owner text has no entry, means the prospect is written without
  // an owner rather than failing the row — an unassigned prospect is
  // recoverable, a failed import is not.
  ownerIdByOwnerText?: Map<string, string | undefined>;
};

export type ApplyResult = {
  wouldCreate: { companies: number; people: number; prospects: number; outreaches: number };
  created: { companies: number; people: number; prospects: number; outreaches: number };
  updated: { companies: number; people: number; prospects: number; outreaches: number };
  failures: { queueId: string; error: string }[];
  warnings: string[];
};

const emptyCounts = () => ({ companies: 0, people: 0, prospects: 0, outreaches: 0 });

// A 252-row live run issues ~10 requests per row and, under retry/backoff for
// a rate limit, can run for many minutes. A silent process is indistinguishable
// from a hung one, so progress prints periodically — often enough to reassure,
// rare enough not to flood the terminal on a run this size.
const PROGRESS_INTERVAL = 25;

// Per-run cache so repeated lookups for the same company/person (and, for
// consistency, prospect/outreach) within a single applyPlan() call never
// depend on the Twenty REST API being read-your-writes consistent
// immediately after a create. Without this, a company created while
// processing an earlier row might not yet be visible to a later row's
// findByFilter (replica lag, index lag, eventual consistency, etc.),
// silently producing duplicate companies/people even though queueId-based
// prospect identity is unaffected.
//
// The key is the filter string itself, so the cache and the server are asked
// the exact same identity question. An earlier version lowercased the cache
// key while sending the filter verbatim: within a run "Acme Co" and "acme co"
// collapsed to one record, but across runs the case-sensitive server filter
// would miss and create a duplicate. One definition of identity, used in both
// places, is better than two that disagree.
type UpsertCache = Map<string, string>;

// Fields that carry pipeline state rather than spreadsheet content. The sheet
// has no column that can advance them — buildPlan hardcodes SOURCED / DRAFT /
// HUMAN and derives directEmailStatus from a permanently empty column — so
// re-sending them on update would drag work done inside the CRM backwards: a
// prospect advanced to CONTACTED reset to SOURCED, an outreach marked SENT
// reset to DRAFT while keeping its sentAt. They are written once, at create.
//
// prospects.ownerId belongs here for the same reason, even though the sheet
// *does* have an Owner column: resolveOwners() re-derives the same member id
// from that column's text deterministically on every run, so leaving ownerId
// updatable would silently drag a prospect a human reassigned inside the
// Twenty UI back to the sheet's owner on the next import. The sheet asserts
// ownership once, at creation; reassignment afterward is the CRM's job, not
// the importer's.
const CREATE_ONLY_FIELDS: Record<string, readonly string[]> = {
  companies: ['headcountStatus'],
  people: ['directEmailStatus'],
  prospects: ['stage', 'ownerId'],
  outreaches: ['status', 'generatedBy', 'model'],
};

// Keys whose value is `undefined` are dropped explicitly, not left to
// JSON.stringify: an optional the sheet does not supply (no direct email, no
// real website) must never blank out a value a human filled in in the CRM.
const bodyFor = (
  plural: string, body: Record<string, unknown>, mode: 'create' | 'update',
): Record<string, unknown> => {
  const createOnly = CREATE_ONLY_FIELDS[plural] ?? [];
  return Object.fromEntries(
    Object.entries(body).filter(([key, value]) => (
      value !== undefined && (mode === 'create' || !createOnly.includes(key))
    )),
  );
};

const createdRecordId = (plural: string, created: { data: unknown }): string => {
  const data = created?.data;
  const record = data && typeof data === 'object'
    ? (Object.values(data as Record<string, unknown>)[0] as { id?: unknown } | undefined)
    : undefined;
  const id = record && typeof record === 'object' ? record.id : undefined;
  if (typeof id !== 'string' || id === '') {
    // Returning undefined here would create the dependent person/prospect with
    // an undefined relation id: silently unlinked records, no error.
    const keys = data && typeof data === 'object' ? Object.keys(data as object).join(', ') : '';
    throw new Error(
      `Twenty create ${plural} returned no usable record id (data keys: ${keys || 'none'})`,
    );
  }
  return id;
};

const upsert = async (
  client: TwentyClient, plural: string, filter: string, body: Record<string, unknown>,
  result: ApplyResult, cache: UpsertCache,
): Promise<string> => {
  const key = `${plural}:${filter}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const existing = await client.findByFilter(plural, filter);
  if (existing) {
    await client.update(plural, existing.id, bodyFor(plural, body, 'update'));
    result.updated[plural as keyof ApplyResult['updated']] += 1;
    cache.set(key, existing.id);
    return existing.id;
  }
  const created = await client.create(plural, bodyFor(plural, body, 'create'));
  result.created[plural as keyof ApplyResult['created']] += 1;
  const id = createdRecordId(plural, created);
  cache.set(key, id);
  return id;
};

const applyEntry = async (
  entry: PlanEntry, client: TwentyClient, result: ApplyResult, cache: UpsertCache,
  ownerIdByOwnerText?: Map<string, string | undefined>,
) => {
  const companyId = await upsert(
    client, 'companies', `name[eq]:${entry.company.name}`,
    entry.company, result, cache,
  );

  // Person identity is scoped to the company. Name alone merges different
  // people who happen to share a name (the real sheet has one name spanning
  // ten companies), linking a prospect to someone else's employee and
  // discarding the later rows' title and evidence.
  const personFilter = `name.firstName[eq]:${entry.person.name.firstName},name.lastName[eq]:${entry.person.name.lastName},companyId[eq]:${companyId}`;
  const personId = await upsert(
    client, 'people', personFilter,
    { ...entry.person, companyId }, result, cache,
  );

  const ownerId = ownerIdByOwnerText?.get(entry.row.owner.trim());
  const prospectId = await upsert(
    client, 'prospects', `queueId[eq]:${entry.prospect.queueId}`,
    { ...entry.prospect, companyId, personId, ownerId }, result, cache,
  );

  for (const outreach of entry.outreaches) {
    await upsert(
      client, 'outreaches', `title[eq]:${outreach.title}`,
      { ...outreach, prospectId }, result, cache,
    );
  }
};

export const applyPlan = async (
  plan: ImportPlan, client: TwentyClient, options: ApplyOptions,
): Promise<ApplyResult> => {
  const result: ApplyResult = {
    wouldCreate: emptyCounts(), created: emptyCounts(), updated: emptyCounts(),
    failures: [], warnings: plan.warnings,
  };

  if (options.dryRun) {
    result.wouldCreate.companies = new Set(plan.entries.map((e) => e.company.name)).size;
    result.wouldCreate.people = plan.entries.length;
    result.wouldCreate.prospects = plan.entries.length;
    result.wouldCreate.outreaches = plan.entries.reduce((sum, e) => sum + e.outreaches.length, 0);
    return result;
  }

  const cache: UpsertCache = new Map();
  const startedAt = Date.now();

  for (let i = 0; i < plan.entries.length; i += 1) {
    const entry = plan.entries[i];
    try {
      await applyEntry(entry, client, result, cache, options.ownerIdByOwnerText);
    } catch (error) {
      result.failures.push({
        queueId: entry.prospect.queueId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    const processed = i + 1;
    if (processed % PROGRESS_INTERVAL === 0 || processed === plan.entries.length) {
      const elapsedSec = Math.round((Date.now() - startedAt) / 1000);
      console.log(
        `  ...${processed}/${plan.entries.length} prospects processed (${elapsedSec}s elapsed) `
        + `— created ${result.created.prospects}, updated ${result.updated.prospects}, `
        + `failed ${result.failures.length}`,
      );
    }
  }

  return result;
};
