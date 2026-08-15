import { applyPlan } from './apply-plan';
import { applySuppressions } from './apply-suppressions';
import { buildPlan } from './build-plan';
import { parseSuppressionList, parseWorkbook } from './parse-workbook';
import { resolveOwners } from './resolve-owners';
import type { WorkspaceMember } from './resolve-owners';
import { createTwentyClient } from './twenty-rest';
import type { TwentyRecord } from './twenty-rest';

const WORKBOOK = process.env.WORKBOOK_PATH ?? 'scripts/import-prospects/fixtures/prospects.xlsx';

// Twenty's workspaceMember records carry a composite `name` field, the same
// shape Person uses elsewhere in this importer. Anything missing falls back
// to an empty string rather than throwing — a malformed member record should
// degrade to "did not match", not crash the whole import.
const toWorkspaceMember = (record: TwentyRecord): WorkspaceMember => {
  const name = (record.name ?? {}) as { firstName?: unknown; lastName?: unknown };
  return {
    id: String(record.id),
    name: {
      firstName: typeof name.firstName === 'string' ? name.firstName : '',
      lastName: typeof name.lastName === 'string' ? name.lastName : '',
    },
  };
};

const main = async () => {
  const dryRun = !process.argv.includes('--apply');
  // Opt-in: the base import never touched the suppression list until this
  // step existed, and that stays the default. Pass --suppress to also run
  // it. Like the rest of the CLI, writing still requires --apply — without
  // it, --suppress reports matches without marking anything.
  const suppress = process.argv.includes('--suppress');
  const client = createTwentyClient();

  const rows = await parseWorkbook(WORKBOOK);
  const suppressed = await parseSuppressionList(WORKBOOK);
  const plan = buildPlan(rows, suppressed);

  console.log(`Parsed ${rows.length} rows, ${suppressed.length} suppressed companies`);

  // Read-only: fetches the workspace member list so the sheet's free-text
  // Owner column can be resolved to a real prospect.owner relation before
  // anything is written. See resolve-owners.ts for the matching rules.
  const memberRecords = await client.list('workspaceMembers');
  const members = memberRecords.map(toWorkspaceMember);
  const owners = resolveOwners(rows.map((row) => row.owner), members);

  console.log(
    `\nOwner resolution: ${owners.ownerIdByOwnerText.size} distinct owner string(s) found `
    + `across ${members.length} workspace member(s)`,
  );
  for (const line of owners.lines) console.log(line);

  if (plan.warnings.length > 0) {
    console.log(`\n${plan.warnings.length} warnings:`);
    for (const warning of plan.warnings) console.log(`  - ${warning}`);
  }

  if (owners.warnings.length > 0) {
    console.log(`\n${owners.warnings.length} owner warning(s):`);
    for (const warning of owners.warnings) console.log(`  - ${warning}`);
  }

  const result = await applyPlan(plan, client, {
    dryRun, ownerIdByOwnerText: owners.ownerIdByOwnerText,
  });

  if (dryRun) {
    console.log('\nDRY RUN — nothing written. Would create:');
    console.log(result.wouldCreate);
  } else {
    console.log('\nCreated:', result.created);
    console.log('Updated:', result.updated);

    if (result.failures.length > 0) {
      console.log(`\n${result.failures.length} failures:`);
      for (const failure of result.failures) console.log(`  - ${failure.queueId}: ${failure.error}`);
      process.exitCode = 1;
    }
  }

  // First-class, flag-gated step (previously ad hoc — the one time it ran
  // against the live server it crashed on a comma in a suppression-list
  // company name; see escapeFilterValue in twenty-rest.ts). Runs after the
  // main import so it can look up already-imported companies by name.
  if (suppress) {
    const suppression = await applySuppressions(plan.suppressedCompanies, client, { dryRun });
    const label = dryRun ? 'Suppression (dry run — nothing written)' : 'Suppression';
    console.log(
      `\n${label}: ${suppression.total} entries, ${suppression.matched} matched, `
      + `${suppression.marked} marked`,
    );

    if (suppression.failures.length > 0) {
      console.log(`\n${suppression.failures.length} suppression failure(s):`);
      for (const failure of suppression.failures) console.log(`  - ${failure.name}: ${failure.error}`);
      process.exitCode = 1;
    }
  }

  if (dryRun) console.log('\nRe-run with --apply to write.');
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
