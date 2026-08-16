import 'server-only';
import { twentyGraphQL } from './twenty-client';

// Plan D extends this type with `replyRate`, `awaitingApproval`, and
// `followUpsDue`. `unavailable` must be present on every return path
// (including the success path, where it is `false`) so a consumer built
// against this type can rely on the field always existing.
export type PortalSummary = {
  totalProspects: number;
  byStage: Record<string, number>;
  enrichmentProgress: number; // 0-1, share of prospects past SOURCED
  outreachThisWeek: number;
  unavailable: boolean; // true when Twenty could not be reached
};

const UNAVAILABLE_SUMMARY: PortalSummary = {
  totalProspects: 0,
  byStage: {},
  enrichmentProgress: 0,
  outreachThisWeek: 0,
  unavailable: true,
};

const SOURCED_STAGE = 'SOURCED';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const PAGE_SIZE = 500;

// Safety valve against a runaway pagination loop (e.g. the API reporting
// `hasNextPage: true` forever) hanging the portal page — this is NOT a
// data-size ceiling. At PAGE_SIZE=500 this allows up to 25,000 prospects,
// far beyond any volume this portal is expected to reach for the
// foreseeable future. If it's ever hit, something is wrong with the
// pagination contract itself, and getPortalSummary reports `unavailable`
// rather than return byStage/enrichmentProgress it knows are incomplete
// (see the throw at the bottom of the loop below).
export const MAX_PROSPECT_PAGES = 50;

// `stage` comes from twenty-app/src/objects/prospect.object.ts (field name
// `stage`, SELECT, default value SOURCED). `sentAt` comes from
// twenty-app/src/objects/outreach.object.ts (field name `sentAt`,
// DATE_TIME, nullable). `pageInfo { hasNextPage endCursor }` and the
// `first`/`after` connection arguments are confirmed against Twenty's
// generated schema at
// twenty-app/node_modules/twenty-client-sdk/dist/core/generated/schema.graphql
// (ProspectConnection, PageInfo, and the root Query.prospects field). Both
// object field names are Plan A's deployed schema — a typo here produces a
// GraphQL error, which this module intentionally treats the same as an
// unreachable CRM (see `unavailable` below).
//
// Reused unchanged for every page of prospects, including the first: the
// `outreaches` count is cheap (a single aggregate), so re-fetching it on
// later pages trades a little redundant work for not having to maintain a
// second query shape.
const QUERY = `
  query PortalSummary($first: Int!, $after: String, $since: DateTime!) {
    prospects(first: $first, after: $after) {
      totalCount
      edges { node { stage } }
      pageInfo { hasNextPage endCursor }
    }
    outreaches(filter: { sentAt: { gte: $since } }) {
      totalCount
    }
  }
`;

type QueryResult = {
  prospects: {
    totalCount: number;
    edges: { node: { stage: string } }[];
    // Optional: absent in some test fixtures. Treated as "no more pages"
    // via `?? false` below, rather than throwing on a missing field.
    pageInfo?: { hasNextPage: boolean; endCursor: string | null };
  };
  outreaches: {
    totalCount: number;
  };
};

const buildSummary = (
  totalProspects: number,
  byStage: Record<string, number>,
  outreachThisWeek: number,
): PortalSummary => {
  const pastSourced = Object.entries(byStage).reduce(
    (sum, [stage, count]) => (stage === SOURCED_STAGE ? sum : sum + count),
    0,
  );
  // Guard division by zero: with no prospects yet, progress is 0, not NaN.
  const enrichmentProgress = totalProspects > 0 ? pastSourced / totalProspects : 0;

  return {
    totalProspects,
    byStage,
    enrichmentProgress,
    outreachThisWeek,
    unavailable: false,
  };
};

export const getPortalSummary = async (): Promise<PortalSummary> => {
  try {
    const since = new Date(Date.now() - SEVEN_DAYS_MS).toISOString();

    const byStage: Record<string, number> = {};
    let totalProspects = 0;
    let outreachThisWeek = 0;
    let after: string | undefined;

    // `totalProspects` comes from `totalCount`, which is correct regardless
    // of pagination. `byStage` (and therefore `enrichmentProgress`) is
    // built from `edges`, which is page-limited — so this loop keeps
    // fetching pages until Twenty reports no more, rather than stopping
    // after one page and silently under-counting stages against a correct
    // total.
    for (let page = 0; page < MAX_PROSPECT_PAGES; page += 1) {
      const data = await twentyGraphQL<QueryResult>(QUERY, { first: PAGE_SIZE, after, since });

      totalProspects = data.prospects.totalCount;
      outreachThisWeek = data.outreaches.totalCount;
      for (const { node } of data.prospects.edges) {
        byStage[node.stage] = (byStage[node.stage] ?? 0) + 1;
      }

      const hasNextPage = data.prospects.pageInfo?.hasNextPage ?? false;
      if (!hasNextPage) {
        return buildSummary(totalProspects, byStage, outreachThisWeek);
      }

      const endCursor = data.prospects.pageInfo?.endCursor;
      if (!endCursor) {
        // hasNextPage is true but there's no cursor to continue with —
        // a broken pagination contract, not a legitimate completion.
        throw new Error('Twenty reported hasNextPage without an endCursor');
      }
      after = endCursor;
    }

    // Exceeded MAX_PROSPECT_PAGES without hasNextPage ever going false.
    // Returning what's been accumulated so far would silently under-report
    // byStage against a correct totalProspects — exactly the failure this
    // loop exists to prevent — so this is a hard failure instead, caught
    // below and reported as `unavailable`.
    throw new Error(`Prospect pagination did not complete within ${MAX_PROSPECT_PAGES} pages`);
  } catch (error) {
    // Fail closed to a visibly "unavailable" state rather than letting a
    // CRM outage (or a bad query, or non-terminating pagination) take down
    // the whole portal page or show data known to be incomplete. Logged
    // (not silently swallowed) so an operator can tell a CRM outage apart
    // from a broken query or a runaway-pagination bug — see
    // final-review.md I3.
    console.error('[summary] failed to load portal summary', error);
    return UNAVAILABLE_SUMMARY;
  }
};
