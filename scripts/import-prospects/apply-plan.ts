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

const upsert = async (
  client: TwentyClient, plural: string, filter: string, body: Record<string, unknown>,
  result: ApplyResult,
): Promise<string> => {
  const existing = await client.findByFilter(plural, filter);
  if (existing) {
    await client.update(plural, existing.id, body);
    result.updated[plural as keyof ApplyResult['updated']] += 1;
    return existing.id;
  }
  const created = await client.create(plural, body);
  result.created[plural as keyof ApplyResult['created']] += 1;
  return Object.values(created.data)[0].id;
};

const applyEntry = async (entry: PlanEntry, client: TwentyClient, result: ApplyResult) => {
  const companyId = await upsert(
    client, 'companies', `name[eq]:${entry.company.name}`, entry.company as never, result,
  );

  const personFilter = `name.firstName[eq]:${entry.person.name.firstName},name.lastName[eq]:${entry.person.name.lastName}`;
  const personId = await upsert(
    client, 'people', personFilter, { ...entry.person, companyId } as never, result,
  );

  const prospectId = await upsert(
    client, 'prospects', `queueId[eq]:${entry.prospect.queueId}`,
    { ...entry.prospect, companyId, personId } as never, result,
  );

  for (const outreach of entry.outreaches) {
    await upsert(
      client, 'outreaches', `title[eq]:${outreach.title}`,
      { ...outreach, prospectId } as never, result,
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

  for (const entry of plan.entries) {
    try {
      await applyEntry(entry, client, result);
    } catch (error) {
      result.failures.push({
        queueId: entry.prospect.queueId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return result;
};
