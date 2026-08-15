import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyPlan } from './apply-plan';
import { applySuppressions } from './apply-suppressions';
import { buildPlan } from './build-plan';
import { parseSuppressionList, parseWorkbook } from './parse-workbook';
import { resolveOwners } from './resolve-owners';
import type { WorkspaceMember } from './resolve-owners';
import { createTwentyClient } from './twenty-rest';
import type { TwentyRecord } from './twenty-rest';

const WORKBOOK = process.env.WORKBOOK_PATH ?? 'scripts/import-prospects/fixtures/prospects.xlsx';

// `--limit N` truncates to the first N parsed rows so a rehearsal run
// (staging, a schema change, a new agent prompt) can use a small sample
// instead of all 252. Plain first-N, not a stratified sample: the sheet's
// two queue-id prefixes are not interleaved (EV-001..EV-200 then
// CMU-001..CMU-052), so any small N is EV-only — a mixed small sample would
// require picking non-contiguous rows, which conflicts with "first N" and
// would blur which warnings belong to the requested subset. A caller who
// wants CMU rows (duplicate-name warnings, the "Founder to verify" block)
// needs a larger N or a dedicated CMU-only workbook slice.
//
// Validated eagerly, before any network or file I/O: an `--apply` run with a
// silently-ignored bad limit is the worst failure mode this flag could have,
// so a malformed value must fail loudly and immediately rather than fall
// through to a full, unintended write.
export const parseLimitArg = (argv: string[]): number | undefined => {
  const eqArg = argv.find((arg) => arg.startsWith('--limit='));
  const index = argv.indexOf('--limit');
  const raw = eqArg !== undefined ? eqArg.slice('--limit='.length)
    : index === -1 ? undefined : argv[index + 1];

  if (eqArg === undefined && index === -1) return undefined;

  const value = Number(raw);
  if (raw === undefined || raw.trim() === '' || !Number.isInteger(value) || value <= 0) {
    throw new Error(
      `--limit requires a positive whole number, got ${JSON.stringify(raw ?? null)}`,
    );
  }
  return value;
};

export const applyLimit = <T>(rows: T[], limit: number | undefined): T[] => (
  limit === undefined ? rows : rows.slice(0, limit)
);

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
  // Fail fast, before the client is created or the workbook is touched — a
  // malformed value must never fall through to a full run.
  const limit = parseLimitArg(process.argv);
  const client = createTwentyClient();

  const parsedRows = await parseWorkbook(WORKBOOK);
  const rows = applyLimit(parsedRows, limit);
  const suppressed = await parseSuppressionList(WORKBOOK);
  const plan = buildPlan(rows, suppressed);

  if (limit !== undefined) {
    // Printed prominently and first: a limited run's counts will not match
    // the documented 252/218/252/756 full-import gate, and a log read later
    // must not be mistaken for a full import.
    console.log(`\n${'='.repeat(72)}`);
    console.log(`LIMIT: ${rows.length} of ${parsedRows.length} rows (subset — NOT a full import)`);
    console.log('='.repeat(72));
  }

  console.log(`\nParsed ${rows.length} rows, ${suppressed.length} suppressed companies`);

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

// Guarded so this module can be imported for unit tests (e.g. parseLimitArg,
// applyLimit) without also kicking off a real run — process.argv[1] only
// resolves to this file's path when it is the script actually invoked.
// Compared as filesystem paths, not raw URL strings: import.meta.url
// percent-encodes characters like spaces in the path (this repo lives under
// "Frater AI Labs"), which a naive `file://${process.argv[1]}` string
// comparison would never match, silently turning every invocation into a
// no-op.
const isMainModule = () => {
  try {
    return fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? '');
  } catch {
    return false;
  }
};

if (isMainModule()) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
