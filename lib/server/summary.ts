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

// `stage` comes from twenty-app/src/objects/prospect.object.ts (field name
// `stage`, SELECT, default value SOURCED). `sentAt` comes from
// twenty-app/src/objects/outreach.object.ts (field name `sentAt`,
// DATE_TIME, nullable). Both are Plan A's deployed schema — a typo here
// produces a GraphQL error, which this module intentionally treats the
// same as an unreachable CRM (see `unavailable` below).
const QUERY = `
  query PortalSummary($since: DateTime!) {
    prospects(first: 1000) {
      totalCount
      edges { node { stage } }
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
  };
  outreaches: {
    totalCount: number;
  };
};

export const getPortalSummary = async (): Promise<PortalSummary> => {
  try {
    const since = new Date(Date.now() - SEVEN_DAYS_MS).toISOString();
    const data = await twentyGraphQL<QueryResult>(QUERY, { since });

    const byStage: Record<string, number> = {};
    for (const { node } of data.prospects.edges) {
      byStage[node.stage] = (byStage[node.stage] ?? 0) + 1;
    }

    const totalProspects = data.prospects.totalCount;
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
      outreachThisWeek: data.outreaches.totalCount,
      unavailable: false,
    };
  } catch {
    // Fail closed to a visibly "unavailable" state rather than letting a
    // CRM outage (or a bad query) take down the whole portal page.
    return UNAVAILABLE_SUMMARY;
  }
};
