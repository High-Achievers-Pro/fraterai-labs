import { cookies } from 'next/headers';
import { SESSION_COOKIE_NAME, readSessionCookie } from '@/lib/server/session';
import { getPortalSummary } from '@/lib/server/summary';

export default async function PortalPage() {
  // proxy.ts already gates this route — an unauthenticated request never
  // reaches this component. Session is re-read here (not passed via headers)
  // purely to get the member's name/email for the greeting.
  const cookieStore = await cookies();
  const session = await readSessionCookie(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  const name = session?.name || session?.email || 'there';

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
