import Link from 'next/link';

export default function Home() {
  return (
    <main id="top">
      <section className="hero" style={{ paddingTop: '6rem', paddingBottom: '6rem', position: 'relative', overflow: 'hidden' }}>
        <video autoPlay loop muted playsInline style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: -2 }}>
          <source src="/src/assets/hero.mp4" type="video/mp4" />
        </video>
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'linear-gradient(135deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.5) 100%)', zIndex: -1 }}></div>
        
        <div className="container hero-grid" style={{ position: 'relative', zIndex: 1 }}>
          <div className="hero-copy reveal">
            <p className="eyebrow" style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 600, letterSpacing: '0.05em' }}>For mid-market operators</p>
            <h1 style={{ color: '#ffffff' }}>Production AI, shipped in a fiscal year &mdash; not a strategy deck.</h1>
            <p className="hero-tagline" style={{ marginLeft: 'auto', marginRight: 'auto', maxWidth: '600px', fontSize: '1.25rem', color: 'rgba(255,255,255,0.9)' }}>
              We pair strategic clarity and operator-level expertise with disciplined ML engineering to turn AI investment into operating efficiency and durable competitive advantage.
            </p>
            <div className="hero-actions" style={{ marginTop: '2.5rem' }}>
              <Link href="/contact" className="btn btn-primary" style={{ background: '#ffffff', color: 'var(--primary)', border: '1px solid #ffffff' }}>Start a conversation</Link>
              <Link href="/services" className="btn btn-ghost" style={{ color: '#ffffff', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)' }}>Explore services</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="principles">
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
            <h2 className="section-title reveal" style={{ fontSize: '3.25rem', marginBottom: '1rem', letterSpacing: '-0.02em' }}>Platform <span style={{ fontFamily: "ui-serif, Georgia, Cambria, 'Times New Roman', Times, serif", fontStyle: 'italic', color: 'var(--accent)' }}>Principles</span></h2>
            <p className="section-tagline reveal" style={{ maxWidth: '600px', margin: '0 auto' }}>Our architectural philosophy is rooted in building intuitive, resilient, and inherently human experiences.</p>
          </div>

          <div className="principles-grid reveal">
            <div className="principle-card">
              <div className="principle-glow glow-1"></div>
              <div className="principle-content">
                <span className="principle-number">01</span>
                <h3>Experience Orchestration</h3>
                <p>Flows feel guided, responsive, and intentional. We prioritize the user's cognitive load over raw feature counts.</p>
              </div>
            </div>
            <div className="principle-card">
              <div className="principle-glow glow-2"></div>
              <div className="principle-content">
                <span className="principle-number">02</span>
                <h3>Knowledge Layer</h3>
                <p>Context appears exactly when and where it matters most, creating a deeply connected and frictionless workspace.</p>
              </div>
            </div>
            <div className="principle-card">
              <div className="principle-glow glow-3"></div>
              <div className="principle-content">
                <span className="principle-number">03</span>
                <h3>Interaction Philosophy</h3>
                <p>Thoughtful digital products feel considered, useful, and quietly memorable. Design is not just visual—it is structural.</p>
              </div>
            </div>
            <div className="principle-card">
              <div className="principle-glow glow-4"></div>
              <div className="principle-content">
                <span className="principle-number">04</span>
                <h3>Modern Composition</h3>
                <p>A harmonious interface rhythm achieved through precise spacing, balanced contrast, and elegant typography.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section" style={{ textAlign: 'center', background: 'var(--bg)', paddingTop: '4rem', paddingBottom: '4rem' }}>
        <div className="container">
          <h2 className="section-title reveal" style={{ fontSize: '2.5rem', letterSpacing: '-0.02em' }}>Comprehensive Expertise</h2>
          <p className="section-tagline reveal" style={{ maxWidth: '600px', margin: '0 auto 3rem' }}>From initial strategy to full-scale deployment, our specialized team ensures your enterprise workflows are seamless, resilient, and intelligent.</p>
          <div className="hero-actions" style={{ justifyContent: 'center' }}>
            <Link href="/services" className="btn btn-primary">Our Services</Link>
            <Link href="/about" className="btn btn-ghost">Meet the Team</Link>
          </div>
        </div>
      </section>

      <section id="contact" className="section cta">
        <div className="container cta-content reveal">
          <h2>Tell us what you’re trying to improve.</h2>
          <p>One or two paragraphs about your team, your context, and where you’d like to be six months from now is enough to start.</p>
          <div className="hero-actions">
            <Link href="/contact" className="btn btn-primary">Start a conversation</Link>
            <Link href="/services" className="btn btn-ghost">View services</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
