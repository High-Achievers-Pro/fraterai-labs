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

export const findActiveWorkspaceMember = async (email: string): Promise<WorkspaceMember | null> => {
  const normalized = email.trim().toLowerCase();

  try {
    const data = await twentyGraphQL<QueryResult>(QUERY, { email: normalized });
    const node = data.workspaceMembers.edges[0]?.node;
    if (!node) return null;

    return {
      id: node.id,
      userEmail: node.userEmail,
      name: [node.name.firstName, node.name.lastName].filter(Boolean).join(' '),
    };
  } catch {
    // Fail closed: an unreachable CRM must not grant access.
    return null;
  }
};
