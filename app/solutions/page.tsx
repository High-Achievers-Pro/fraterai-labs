import Link from 'next/link';

export default function Solutions() {
  return (
    <main id="top">
      <section className="hero" style={{ paddingTop: '8rem', paddingBottom: '2rem', background: 'var(--bg)', textAlign: 'center', position: 'relative' }}>
        <div className="container" style={{ position: 'relative', zIndex: 1 }}>
          <h1 style={{ fontSize: '3.5rem', marginBottom: '1rem', fontWeight: 600 }}>
            Our <span style={{ fontFamily: "ui-serif, Georgia, Cambria, 'Times New Roman', Times, serif", fontStyle: 'italic', color: 'var(--accent)' }}>Solutions</span>
          </h1>
        </div>
      </section>

      <section id="solutions" className="section solutions-breathing-bg">
        <div className="container relative z-10">
          <h2 className="section-title reveal">Solutions you can see yourself in</h2>
          <p className="section-tagline reveal">A few concrete ways teams typically work with us.</p>
          <div className="cards" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: '2rem' }}>
            <article className="solution-panel reveal">
              <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: '12px', height: '160px', marginBottom: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--text)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="9" y1="9" x2="15" y2="9"></line>
                  <line x1="9" y1="13" x2="15" y2="13"></line>
                  <line x1="9" y1="17" x2="12" y2="17"></line>
                </svg>
              </div>
              <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>AI Document Processing</h3>
              <p style={{ fontSize: '1.05rem', color: 'var(--muted-2)', lineHeight: 1.7 }}>Turn contracts, forms, and PDFs into structured, searchable data without asking people to change how they work overnight.</p>
            </article>

            <article className="solution-panel reveal">
              <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: '12px', height: '160px', marginBottom: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--text)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                  <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
                  <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
                  <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
                </svg>
              </div>
              <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Centralized Knowledge</h3>
              <p style={{ fontSize: '1.05rem', color: 'var(--muted-2)', lineHeight: 1.7 }}>Give your team or customers trustworthy answers grounded in your own docs, not the open internet.</p>
            </article>

            <article className="solution-panel reveal">
              <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: '12px', height: '160px', marginBottom: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--text)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
                </svg>
              </div>
              <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Automated Experience</h3>
              <p style={{ fontSize: '1.05rem', color: 'var(--muted-2)', lineHeight: 1.7 }}>Reduce wait times and hand repetitive questions to assistants that know when to involve a human.</p>
            </article>
          </div>
        </div>
      </section>
    </main>
  );
}
