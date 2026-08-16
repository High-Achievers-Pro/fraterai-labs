import 'server-only';
import { twentyGraphQL } from './twenty-client';

export type WorkspaceMember = { id: string; userEmail: string; name: string };

const QUERY = `
  query FindWorkspaceMember($email: String!) {
    workspaceMembers(filter: { userEmail: { eq: $email } }, first: 1) {
      edges { node { id userEmail name { firstName lastName } } }
    }
  }
`;

type QueryResult = {
  workspaceMembers: {
    edges: { node: { id: string; userEmail: string; name: { firstName: string; lastName: string } } }[];
  };
};

// The bare GraphQL lookup with no error handling of its own. Split out so
// two callers below can each decide what "the query failed" should mean:
// findActiveWorkspaceMember (sign-in) must fail closed to null on ANY
// doubt, while checkActiveMembership (the already-signed-in portal
// surface's re-check, see final-review.md I1) needs to tell "Twenty said
// no such member" apart from "Twenty could not be reached at all" — those
// are not the same situation and must not produce the same UX.
const queryWorkspaceMember = async (email: string): Promise<WorkspaceMember | null> => {
  const normalized = email.trim().toLowerCase();
  const data = await twentyGraphQL<QueryResult>(QUERY, { email: normalized });
  const node = data.workspaceMembers.edges[0]?.node;
  if (!node) return null;

  return {
    id: node.id,
    userEmail: node.userEmail.toLowerCase(),
    name: [node.name.firstName, node.name.lastName].filter(Boolean).join(' '),
  };
};

export const findActiveWorkspaceMember = async (email: string): Promise<WorkspaceMember | null> => {
  try {
    return await queryWorkspaceMember(email);
  } catch (error) {
    // Fail closed: an unreachable CRM must not grant access. Logged (not
    // silently swallowed) so an operator debugging "nobody can sign in"
    // has a signal to distinguish a CRM outage from a bug in this query or
    // its field mapping — see final-review.md I3. Only the email and error
    // are logged; never a token, secret, or signature.
    console.error('[membership] failed to query workspace membership', { email, error });
    return null;
  }
};

// Used only by the portal surface's membership re-check
// (lib/server/portal-access.ts). Unlike findActiveWorkspaceMember, this
// does NOT swallow a query failure into null — it rethrows, so the caller
// can tell "Twenty was reachable and confirmed no active member" (null)
// apart from "Twenty could not be reached" (throws). Sign-in correctly
// treats both the same way (deny); an already-signed-in visitor mid-
// session should not be logged out by a transient CRM outage, only by an
// actual, confirmed loss of membership. See final-review.md I1.
export const checkActiveMembership = async (email: string): Promise<WorkspaceMember | null> =>
  queryWorkspaceMember(email);
