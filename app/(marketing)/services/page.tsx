import Link from 'next/link';

export default function Services() {
  return (
    <main id="top">
      <section className="hero" style={{ paddingTop: '8rem', paddingBottom: '2rem', background: 'var(--bg)', textAlign: 'center' }}>
        <div className="container">
          <h1 style={{ fontSize: '3rem', marginBottom: '1rem', fontWeight: 600 }}>
            Our <span style={{ fontFamily: "ui-serif, Georgia, Cambria, 'Times New Roman', Times, serif", fontStyle: 'italic', color: 'var(--accent)' }}>Services</span>
          </h1>
        </div>
      </section>

      <section id="services" className="section services">
        <div className="container">
          <h2 className="section-title reveal" style={{ textAlign: 'center' }}>Services We Offer</h2>
          <p className="section-tagline reveal" style={{ textAlign: 'center', marginLeft: 'auto', marginRight: 'auto' }}>
            Powerful solutions for streamlined operations and growth
          </p>

          <div className="cards">
            <article className="interactive-service-card reveal">
              <div className="icon-glow">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                </svg>
              </div>
              <h3 style={{ fontSize: '1.4rem', marginBottom: '0.5rem', fontWeight: 600 }}>Start with a strategy</h3>
              <p style={{ fontSize: '1rem', color: 'var(--muted-2)' }}>Clarify what’s worth doing, why now, and how to get there. We build AI Strategies & Roadmaps, PoCs, and foundational Data Engineering.</p>
              <Link href="/contact" className="learn-more-link">Learn More <span className="arrow">&rarr;</span></Link>
            </article>

            <article className="interactive-service-card reveal">
              <div className="icon-glow">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                  <line x1="8" y1="21" x2="16" y2="21"></line>
                  <line x1="12" y1="17" x2="12" y2="21"></line>
                </svg>
              </div>
              <h3 style={{ fontSize: '1.4rem', marginBottom: '0.5rem', fontWeight: 600 }}>Build something new</h3>
              <p style={{ fontSize: '1rem', color: 'var(--muted-2)' }}>Design and ship products, agents, and experiences that fit how people work. Delivering LLM interfaces and AI-Native properties.</p>
              <Link href="/contact" className="learn-more-link">Explore Solutions <span className="arrow">&rarr;</span></Link>
            </article>

            <article className="interactive-service-card reveal" style={{ marginTop: '2rem' }}>
              <div className="icon-glow">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                </svg>
              </div>
              <h3 style={{ fontSize: '1.4rem', marginBottom: '0.5rem', fontWeight: 600 }}>Make it work in production</h3>
              <p style={{ fontSize: '1rem', color: 'var(--muted-2)' }}>Integrate safely with your stack, add guardrails, and ensure compliance. We provide monitoring, evaluation frameworks and controls.</p>
              <Link href="/contact" className="learn-more-link">Learn More <span className="arrow">&rarr;</span></Link>
            </article>

            <article className="interactive-service-card reveal" style={{ marginTop: '2rem' }}>
              <div className="icon-glow">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
              </div>
              <h3 style={{ fontSize: '1.4rem', marginBottom: '0.5rem', fontWeight: 600 }}>Scale people and skills</h3>
              <p style={{ fontSize: '1rem', color: 'var(--muted-2)' }}>Help your team understand what’s possible and build lasting internal capability with bespoke training, enablement and playbooks.</p>
              <Link href="/contact" className="learn-more-link">See Enablement <span className="arrow">&rarr;</span></Link>
            </article>
          </div>
        </div>
      </section>
    </main>
  );
}
