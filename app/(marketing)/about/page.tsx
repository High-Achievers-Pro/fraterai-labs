import Link from 'next/link';

export default function About() {
  return (
    <main id="top">
      <section className="hero" style={{ paddingTop: '8rem', paddingBottom: '2rem', background: 'var(--bg)', textAlign: 'center', position: 'relative' }}>
        <div className="container" style={{ position: 'relative', zIndex: 1 }}>
          <h1 style={{ fontSize: '3.5rem', marginBottom: '1rem', fontWeight: 600 }}>
            About <span style={{ fontFamily: "ui-serif, Georgia, Cambria, 'Times New Roman', Times, serif", fontStyle: 'italic', color: 'var(--accent)' }}>Us</span>
          </h1>
        </div>
      </section>

      <section id="about" className="section">
        <div className="container">
          <h2 className="section-title reveal" style={{ textAlign: 'center' }}>Who We Are</h2>
          <p className="section-tagline reveal" style={{ textAlign: 'center', marginLeft: 'auto', marginRight: 'auto' }}>
            Built by a team of leading engineers and scientists from top technology and enterprise companies.
          </p>

          <div className="cards" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginTop: '3rem' }}>
            <article className="card reveal" style={{ gridColumn: 'span 1', padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(37,99,235,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', marginBottom: '1.5rem', color: 'var(--accent)' }}>
                📦
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.35rem' }}>Software & ML Engineer</h3>
              <span style={{ display: 'inline-block', padding: '0.2rem 0.75rem', background: 'var(--surface-2)', borderRadius: '99px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--muted)', marginBottom: '1.25rem' }}>Amazon</span>
              <p style={{ fontSize: '0.95rem', lineHeight: 1.6 }}>Bringing deep expertise in scaling machine learning infrastructure and building resilient, high-volume backend architectures.</p>
            </article>

            <article className="card reveal" style={{ gridColumn: 'span 1', padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(37,99,235,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', marginBottom: '1.5rem', color: 'var(--accent)' }}>
                ✈️
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.35rem' }}>ML Scientist</h3>
              <span style={{ display: 'inline-block', padding: '0.2rem 0.75rem', background: 'var(--surface-2)', borderRadius: '99px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--muted)', marginBottom: '1.25rem' }}>Expedia</span>
              <p style={{ fontSize: '0.95rem', lineHeight: 1.6 }}>Specializing in predictive modeling, personalization algorithms, and transforming massive consumer datasets into actionable intelligence.</p>
            </article>

            <article className="card reveal" style={{ gridColumn: 'span 1', padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(37,99,235,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', marginBottom: '1.5rem', color: 'var(--accent)' }}>
                ⚡
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.35rem' }}>Senior Data Scientist</h3>
              <span style={{ display: 'inline-block', padding: '0.2rem 0.75rem', background: 'var(--surface-2)', borderRadius: '99px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--muted)', marginBottom: '1.25rem' }}>Wesco</span>
              <p style={{ fontSize: '0.95rem', lineHeight: 1.6 }}>Focused on enterprise analytics, supply chain optimization, and driving critical operational efficiency through applied statistical models.</p>
            </article>
          </div>
        </div>
      </section>

      <section id="stories" className="section">
        <div className="container">
          <h2 className="section-title reveal">Stories, not just features</h2>
          <p className="section-tagline reveal">A few examples of how work with us can feel.</p>
          <div className="cards">
            <article className="card reveal">
              <h3>From scattered docs to “I can finally find things”</h3>
              <p>A growing team drowning in shared drives and wikis. Together we shipped a knowledge assistant that surfaces the right page, not ten tabs.</p>
              <ul className="bullets">
                <li>Phases: Discover → Organize → Develop → Solutions</li>
                <li>Outcome: faster onboarding, fewer “where is that doc?” pings</li>
              </ul>
            </article>
            <article className="card reveal">
              <h3>From manual ops to a calm agentic workflow</h3>
              <p>Operations leads were copy-pasting between tools every day. We co-designed an agent workflow that handles the busywork and asks for help when needed.</p>
              <ul className="bullets">
                <li>Phases: Discover → Develop → Deploy</li>
                <li>Outcome: more time for edge cases and judgment calls</li>
              </ul>
            </article>
          </div>
        </div>
      </section>
    </main>
  );
}
