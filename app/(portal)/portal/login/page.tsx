import MagicLinkForm from './magic-link-form';

type LoginPageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function PortalLoginPage({ searchParams }: LoginPageProps) {
  const { error } = await searchParams;

  // Deliberately generic regardless of the specific `error` value
  // (`not_authorized`, `invalid_state`, `sign_in_failed`, ...) — the message
  // must never reveal whether a given address exists in the workspace.
  const hasError = typeof error === 'string' && error.length > 0;

  return (
    <section className="section">
      <div className="container" style={{ maxWidth: '480px', textAlign: 'center' }}>
        <h1 className="section-title">Frater Portal</h1>
        <p className="section-tagline">Sign in with your Frater AI Labs Google account.</p>

        {hasError && (
          <p role="alert" style={{ color: '#b91c1c', marginBottom: '1.5rem' }}>
            We couldn&apos;t sign you in. Please try again, or contact an admin if this
            keeps happening.
          </p>
        )}

        <a href="/api/auth/google" className="btn btn-primary">
          Continue with Google
        </a>

        <MagicLinkForm />
      </div>
    </section>
  );
}
