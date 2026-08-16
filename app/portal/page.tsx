import { cookies } from 'next/headers';
import { SESSION_COOKIE_NAME, readSessionCookie } from '@/lib/server/session';

export default async function PortalPage() {
  // proxy.ts already gates this route — an unauthenticated request never
  // reaches this component. Session is re-read here (not passed via headers)
  // purely to get the member's name/email for the greeting.
  const cookieStore = await cookies();
  const session = await readSessionCookie(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  const name = session?.name || session?.email || 'there';

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

        {/* Task 7 fills this in with portal summary tiles. */}
        <div style={{ marginTop: '3rem' }} />

        <form action="/api/auth/logout" method="POST" style={{ marginTop: '3rem' }}>
          <button type="submit" className="btn btn-ghost btn-sm">
            Sign out
          </button>
        </form>
      </div>
    </section>
  );
}
