import type { ImportPlan, PlanEntry } from './types';
import type { TwentyClient } from './twenty-rest';

export type ApplyOptions = { dryRun: boolean };

export type ApplyResult = {
  wouldCreate: { companies: number; people: number; prospects: number; outreaches: number };
  created: { companies: number; people: number; prospects: number; outreaches: number };
  updated: { companies: number; people: number; prospects: number; outreaches: number };
  failures: { queueId: string; error: string }[];
  warnings: string[];
};

const emptyCounts = () => ({ companies: 0, people: 0, prospects: 0, outreaches: 0 });

// Per-run cache so repeated lookups for the same company/person (and, for
// consistency, prospect/outreach) within a single applyPlan() call never
// depend on the Twenty REST API being read-your-writes consistent
// immediately after a create. Without this, a company created while
// processing an earlier row might not yet be visible to a later row's
// findByFilter (replica lag, index lag, eventual consistency, etc.),
// silently producing duplicate companies/people even though queueId-based
// prospect identity is unaffected. The cache key is normalized (trimmed +
// lowercased) so trivial casing/whitespace differences between rows still
// collapse to one entry; the filter string sent to the server is left
// untouched.
type UpsertCache = Map<string, string>;

const cacheKey = (plural: string, rawKey: string) => `${plural}:${rawKey.trim().toLowerCase()}`;

const upsert = async (
  client: TwentyClient, plural: string, filter: string, body: Record<string, unknown>,
  result: ApplyResult, cache: UpsertCache, rawCacheKey: string,
): Promise<string> => {
  const key = cacheKey(plural, rawCacheKey);
  const cached = cache.get(key);
  if (cached) return cached;

  const existing = await client.findByFilter(plural, filter);
  if (existing) {
    await client.update(plural, existing.id, body);
    result.updated[plural as keyof ApplyResult['updated']] += 1;
    cache.set(key, existing.id);
    return existing.id;
  }
  const created = await client.create(plural, body);
  result.created[plural as keyof ApplyResult['created']] += 1;
  const id = Object.values(created.data)[0].id;
  cache.set(key, id);
  return id;
};

const applyEntry = async (
  entry: PlanEntry, client: TwentyClient, result: ApplyResult, cache: UpsertCache,
) => {
  const companyId = await upsert(
    client, 'companies', `name[eq]:${entry.company.name}`, entry.company as never, result,
    cache, entry.company.name,
  );

  const personFilter = `name.firstName[eq]:${entry.person.name.firstName},name.lastName[eq]:${entry.person.name.lastName}`;
  const personId = await upsert(
    client, 'people', personFilter, { ...entry.person, companyId } as never, result,
    cache, `${entry.person.name.firstName} ${entry.person.name.lastName}`,
  );

  const prospectId = await upsert(
    client, 'prospects', `queueId[eq]:${entry.prospect.queueId}`,
    { ...entry.prospect, companyId, personId } as never, result,
    cache, entry.prospect.queueId,
  );

  for (const outreach of entry.outreaches) {
    await upsert(
      client, 'outreaches', `title[eq]:${outreach.title}`,
      { ...outreach, prospectId } as never, result,
      cache, outreach.title,
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

  for (const entry of plan.entries) {
    try {
      await applyEntry(entry, client, result, cache);
    } catch (error) {
      result.failures.push({
        queueId: entry.prospect.queueId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return result;
};
