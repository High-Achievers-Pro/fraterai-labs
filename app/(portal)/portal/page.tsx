import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE_NAME } from '@/lib/server/session';
import { checkPortalAccess } from '@/lib/server/portal-access';
import { getPortalSummary } from '@/lib/server/summary';

export default async function PortalPage() {
  // proxy.ts already gates this route on a validly-signed, unexpired
  // session cookie — an unauthenticated request never reaches this
  // component. checkPortalAccess additionally re-confirms the session's
  // member is STILL an active Twenty workspace member (proxy.ts and the
  // cookie alone can't catch someone removed mid-session — see
  // final-review.md I1). `denied` here means Twenty was reachable and said
  // no; `unavailable` means Twenty couldn't be reached at all, in which
  // case access proceeds on the trust already established at sign-in
  // (see lib/server/portal-access.ts for the full reasoning) — the summary
  // fetch below will show its own "unavailable" state for the same outage.
  const cookieStore = await cookies();
  const access = await checkPortalAccess(cookieStore.get(SESSION_COOKIE_NAME)?.value);

  if (access.status === 'denied') {
    redirect('/portal/login?error=not_authorized');
  }

  const { session } = access;
  const name = session.name || session.email || 'there';

  // Fetched directly here (not via a request to /api/portal/summary) — this
  // is already a server component, so calling our own HTTP endpoint would be
  // a needless network round trip. The API route exists for any future
  // client-side fetch (e.g. a refresh button), not for this page.
  const summary = await getPortalSummary();

  return (
    <section className="section">
      <div className="container">
        <h1 className="section-title">Welcome, {name}</h1>
        <p className="section-tagline">This is your Frater AI Labs portal.</p>

        <a
          href="https://crm.fraterailabs.com"
          className="btn btn-primary"
          target="_blank"
          rel="noopener noreferrer"
        >
          Open CRM
        </a>

        <div style={{ marginTop: '3rem' }}>
          {summary.unavailable ? (
            <p className="section-tagline" role="status">
              CRM data is unavailable right now — the pipeline numbers below could not be
              loaded. Try again shortly.
            </p>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '1.5rem',
              }}
            >
              <div>
                <strong style={{ display: 'block', fontSize: '2rem', letterSpacing: '-0.02em' }}>
                  {summary.totalProspects}
                </strong>
                <span style={{ color: 'var(--muted)', fontSize: '0.95rem' }}>Total prospects</span>
              </div>

              <div>
                <strong style={{ display: 'block', fontSize: '2rem', letterSpacing: '-0.02em' }}>
                  {Math.round(summary.enrichmentProgress * 100)}%
                </strong>
                <span style={{ color: 'var(--muted)', fontSize: '0.95rem' }}>Past sourced</span>
              </div>

              <div>
                <strong style={{ display: 'block', fontSize: '2rem', letterSpacing: '-0.02em' }}>
                  {summary.outreachThisWeek}
                </strong>
                <span style={{ color: 'var(--muted)', fontSize: '0.95rem' }}>Outreach this week</span>
              </div>
            </div>
          )}
        </div>

        <form action="/api/auth/logout" method="POST" style={{ marginTop: '3rem' }}>
          <button type="submit" className="btn btn-ghost btn-sm">
            Sign out
          </button>
        </form>
      </div>
    </section>
  );
}
