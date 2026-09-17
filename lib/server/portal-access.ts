import 'server-only';
import { checkActiveMembership } from './membership';
import { readSessionCookie, type SessionPayload } from './session';

export type PortalAccessResult =
  | { status: 'ok'; session: SessionPayload }
  | { status: 'denied' }
  | { status: 'unavailable'; session: SessionPayload };

// Re-checks Twenty workspace membership for an already-minted session, on
// every request to the portal surface, so removing someone from the
// workspace takes effect without waiting out the session's up-to-8-hour
// TTL (see final-review.md I1 — proxy.ts and readSessionCookie alone never
// revisit Twenty, so without this the "membership required always" Global
// Constraint only held at mint time). Cheap for this deployment: two
// workspace members, a low-traffic internal portal, one extra GraphQL
// round trip per portal page load / API call.
//
// A Twenty outage during this re-check is deliberately NOT treated the
// same as "removed from the workspace": checkActiveMembership rethrows on
// a query failure rather than returning null (unlike
// findActiveWorkspaceMember, used at sign-in, which must deny on any
// doubt — see membership.ts). Locking out both current members of a two-
// person portal because the CRM briefly is unreachable would compound
// Twenty's own outage with a confusing, self-inflicted one on top of it.
// So: a confirmed "not an active member" denies; an unreachable CRM falls
// back to the trust already established when the session was minted
// (`status: 'unavailable'`, session still returned) — callers that also
// fetch CRM data (e.g. the portal page's summary) will show their own
// "unavailable" state regardless, since the same outage affects them too.
export const checkPortalAccess = async (
  cookieValue: string | undefined,
): Promise<PortalAccessResult> => {
  const session = await readSessionCookie(cookieValue);
  if (!session) return { status: 'denied' };

  try {
    const member = await checkActiveMembership(session.email);
    if (!member) return { status: 'denied' };
    return { status: 'ok', session };
  } catch (error) {
    console.error('[portal-access] membership re-check failed; falling back to session trust', {
      email: session.email,
      error,
    });
    return { status: 'unavailable', session };
  }
};
