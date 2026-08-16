import { NextResponse, type NextRequest } from 'next/server';
import { checkPortalAccess } from '@/lib/server/portal-access';
import { SESSION_COOKIE_NAME } from '@/lib/server/session';
import { getPortalSummary } from '@/lib/server/summary';

// proxy.ts already guards /api/portal/* against an unauthenticated
// request; checkPortalAccess additionally re-confirms the session's member
// is still active in Twenty rather than trusting a mint-time check that
// may be hours stale (see final-review.md I1). An unreachable Twenty
// during that re-check does not 401 here — see lib/server/portal-access.ts
// for why a CRM outage must not look identical to a revoked member. (If
// Twenty really is down, getPortalSummary below will independently report
// `unavailable: true` for the same reason.)
export const GET = async (request: NextRequest) => {
  const access = await checkPortalAccess(request.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (access.status === 'denied') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json(await getPortalSummary());
};
