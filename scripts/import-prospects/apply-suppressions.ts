import { escapeFilterValue } from './twenty-rest';
import type { TwentyClient } from './twenty-rest';

export type SuppressedCompany = { name: string; reason: string };

export type SuppressionOptions = {
  // Same meaning as ApplyOptions.dryRun in apply-plan.ts: report what would
  // happen without writing. A match is still counted in dry-run mode (it's
  // read-only information), a mark is not.
  dryRun: boolean;
};

export type SuppressionResult = {
  total: number;
  // How many suppression-list names were found among already-imported
  // companies. The real sheet has zero overlap with the 218 imported
  // companies, so this is expected to be 0 today — that is a fact about the
  // data, not a sign the step is broken.
  matched: number;
  // How many matched companies were actually PATCHed. Always 0 in dry-run
  // mode; equal to `matched` minus any per-company failures otherwise.
  marked: number;
  failures: { name: string; error: string }[];
};

// The suppression list was previously applied ad hoc (not part of the
// tested CLI), and the one time it ran against the live server it crashed on
// a comma in a company name (see escapeFilterValue in twenty-rest.ts for the
// root cause and the fix). Making it a first-class, flag-gated CLI step with
// its own tests is what turns "crashed once, never verified" into something
// that reports a clean, expected result — 50 entries, 0 matched, 0 marked —
// and exits 0 instead of throwing an opaque 400 partway through the list.
export const applySuppressions = async (
  suppressedCompanies: SuppressedCompany[],
  client: TwentyClient,
  options: SuppressionOptions,
): Promise<SuppressionResult> => {
  const result: SuppressionResult = {
    total: suppressedCompanies.length, matched: 0, marked: 0, failures: [],
  };

  for (const company of suppressedCompanies) {
    try {
      // eslint-disable-next-line no-await-in-loop -- sequential, mirrors applyPlan's per-row loop
      const existing = await client.findByFilter('companies', `name[eq]:${escapeFilterValue(company.name)}`);
      if (!existing) continue; // Not in this CRM — nothing to suppress, not a failure.

      result.matched += 1;
      if (options.dryRun) continue;

      // eslint-disable-next-line no-await-in-loop -- see above
      await client.update('companies', existing.id, {
        isSuppressed: true, suppressionReason: company.reason,
      });
      result.marked += 1;
    } catch (error) {
      // Isolated per company, same reasoning as applyPlan's per-row catch:
      // one bad name (or one escapeFilterValue refusal) must not abort the
      // other 49 lookups.
      result.failures.push({
        name: company.name,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return result;
};
