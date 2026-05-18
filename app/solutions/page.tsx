import Link from 'next/link';

export default function Solutions() {
  return (
    <main id="top">
      <section className="hero" style={{ paddingTop: '8rem', paddingBottom: '3rem', background: 'var(--bg)', textAlign: 'center', position: 'relative' }}>
        <div className="container" style={{ position: 'relative', zIndex: 1 }}>
          <p className="eyebrow" style={{ marginBottom: '0.5rem', color: 'var(--muted)' }}>TURNKEY PLATFORMS</p>
          <h1 style={{ fontSize: '3.5rem', marginBottom: '1.5rem', fontWeight: 600 }}>
            Our <span style={{ fontFamily: "ui-serif, Georgia, Cambria, 'Times New Roman', Times, serif", fontStyle: 'italic', color: 'var(--accent)' }}>Solutions</span>
          </h1>
          <p style={{ fontSize: '1.25rem', color: 'var(--muted-2)', maxWidth: '700px', margin: '0 auto', lineHeight: 1.6 }}>
            Pre-packaged, highly repeatable AI solutions engineered for common enterprise friction points. Deploy sophisticated intelligence in weeks, not months.
          </p>
        </div>
      </section>

      <section id="solutions-catalog" className="section solutions-breathing-bg">
        <div className="container relative z-10">
          <div className="cards" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2.5rem' }}>
            
            {/* 1. AI Document Processing */}
            <article className="solution-panel reveal">
              <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: '12px', height: '160px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="9" y1="9" x2="15" y2="9"></line>
                  <line x1="9" y1="13" x2="15" y2="13"></line>
                  <line x1="9" y1="17" x2="12" y2="17"></line>
                </svg>
              </div>
              <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem', fontWeight: 600 }}>AI Document Processing</h3>
              <p style={{ fontSize: '1.05rem', color: 'var(--muted)', lineHeight: 1.7, marginBottom: '1.5rem' }}>
                Automate the extraction of unstructured data from complex legal contracts, invoices, and hand-written PDFs into structured, machine-readable formats.
              </p>
              <ul style={{ listStyleType: 'none', padding: 0, margin: '0 0 1.5rem 0', color: 'var(--muted-2)', fontSize: '0.95rem' }}>
                <li style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><span style={{ color: 'var(--accent)' }}>✓</span> OCR &amp; Handwriting Recognition</li>
                <li style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><span style={{ color: 'var(--accent)' }}>✓</span> Semantic Entity Extraction</li>
                <li style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><span style={{ color: 'var(--accent)' }}>✓</span> Automated Compliance Checks</li>
              </ul>
            </article>

            {/* 2. AI-Powered Knowledge Base */}
            <article className="solution-panel reveal">
              <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: '12px', height: '160px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                  <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
                  <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
                  <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
                </svg>
              </div>
              <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem', fontWeight: 600 }}>AI-Powered Knowledge Base</h3>
              <p style={{ fontSize: '1.05rem', color: 'var(--muted)', lineHeight: 1.7, marginBottom: '1.5rem' }}>
                Deploy secure Retrieval-Augmented Generation (RAG) engines that give your workforce instant, cited answers grounded entirely in your proprietary internal documentation.
              </p>
              <ul style={{ listStyleType: 'none', padding: 0, margin: '0 0 1.5rem 0', color: 'var(--muted-2)', fontSize: '0.95rem' }}>
                <li style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><span style={{ color: 'var(--accent)' }}>✓</span> Secure SSO Integration</li>
                <li style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><span style={{ color: 'var(--accent)' }}>✓</span> Hallucination Guardrails</li>
                <li style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><span style={{ color: 'var(--accent)' }}>✓</span> Citation &amp; Source Linking</li>
              </ul>
            </article>

            {/* 3. AI-Driven Customer Experience */}
            <article className="solution-panel reveal">
              <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: '12px', height: '160px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
                </svg>
              </div>
              <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem', fontWeight: 600 }}>AI-Driven Customer Experience</h3>
              <p style={{ fontSize: '1.05rem', color: 'var(--muted)', lineHeight: 1.7, marginBottom: '1.5rem' }}>
                Implement intelligent conversational agents that securely handle tiered support routing, complex account inquiries, and instantaneous multilingual resolutions.
              </p>
              <ul style={{ listStyleType: 'none', padding: 0, margin: '0 0 1.5rem 0', color: 'var(--muted-2)', fontSize: '0.95rem' }}>
                <li style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><span style={{ color: 'var(--accent)' }}>✓</span> Omnichannel Deployment</li>
                <li style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><span style={{ color: 'var(--accent)' }}>✓</span> Seamless Human Handoff</li>
                <li style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><span style={{ color: 'var(--accent)' }}>✓</span> Sentiment Analysis</li>
              </ul>
            </article>

          </div>
        </div>
      </section>
      
      <section className="section cta" style={{ textAlign: 'center', borderTop: '1px solid var(--border)', marginTop: '4rem' }}>
        <div className="container reveal">
          <h2>Ready to deploy intelligence?</h2>
          <p>Let's map our solutions to your precise organizational bottlenecks.</p>
          <div className="hero-actions" style={{ justifyContent: 'center' }}>
            <Link href="/contact" className="btn btn-primary">Request a Demo</Link>
            <Link href="/services" className="btn btn-ghost">View Bespoke Services</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
