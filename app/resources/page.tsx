import Link from 'next/link';

export default function Resources() {
  return (
    <main id="top">
      <section className="hero" style={{ paddingTop: '10rem', paddingBottom: '4rem', textAlign: 'center' }}>
        <div className="container reveal">
          <p className="eyebrow" style={{ marginBottom: '0.5rem', color: 'var(--muted)' }}>RESEARCH & INSIGHTS</p>
          <h1 style={{ fontSize: '4rem', marginBottom: '1.5rem', fontWeight: 600 }}>
            The <span style={{ fontFamily: "ui-serif, Georgia, Cambria, serif", fontStyle: 'italic', color: 'var(--accent)' }}>Frontier</span>
          </h1>
          <p style={{ fontSize: '1.25rem', color: 'var(--muted-2)', maxWidth: '600px', margin: '0 auto', lineHeight: 1.6 }}>
            Read our latest engineering deep-dives, strategic AI models, and deployment post-mortems.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="resources-grid">
            
            <article className="resource-card reveal">
              <div className="resource-image" style={{ background: 'linear-gradient(135deg, #111 0%, #0d2b24 100%)' }}></div>
              <div className="resource-content">
                <span className="resource-tag">Engineering</span>
                <h3>Building Resilient RAG Pipelines</h3>
                <p>How we structured a fail-safe document retrieval system scaling to millions of nodes.</p>
                <Link href="#" className="resource-link">Read Article &rarr;</Link>
              </div>
            </article>

            <article className="resource-card reveal" style={{ transitionDelay: '0.1s' }}>
              <div className="resource-image" style={{ background: 'linear-gradient(135deg, #111 0%, #1a1625 100%)' }}></div>
              <div className="resource-content">
                <span className="resource-tag">Strategy</span>
                <h3>The Cost of Context Windows</h3>
                <p>Optimizing prompt lengths and token budgets in High-Throughput environments without losing intelligence.</p>
                <Link href="#" className="resource-link">Read Article &rarr;</Link>
              </div>
            </article>

            <article className="resource-card reveal" style={{ transitionDelay: '0.2s' }}>
              <div className="resource-image" style={{ background: 'linear-gradient(135deg, #111 0%, #0c1a2c 100%)' }}></div>
              <div className="resource-content">
                <span className="resource-tag">Case Study</span>
                <h3>Agents in the Cloud</h3>
                <p>Deploying autonomous data processing clusters across Azure securely without losing human oversight.</p>
                <Link href="#" className="resource-link">Read Article &rarr;</Link>
              </div>
            </article>

          </div>
        </div>
      </section>
    </main>
  );
}
