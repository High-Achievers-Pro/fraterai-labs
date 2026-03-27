import Link from 'next/link';
import Image from 'next/image';

export default function Process() {
  return (
    <main id="top">
      <section className="hero" style={{ paddingTop: '8rem', paddingBottom: '2rem', background: 'var(--bg)', textAlign: 'center' }}>
        <div className="container">
          <h1 style={{ fontSize: '3rem', marginBottom: '1rem', fontWeight: 600 }}>
            Our <span style={{ fontFamily: "ui-serif, Georgia, Cambria, 'Times New Roman', Times, serif", fontStyle: 'italic', color: 'var(--accent)' }}>Process</span>
          </h1>
        </div>
      </section>

      <section id="process" className="section process" style={{ display: 'flex', justifyContent: 'center' }}>
        <div className="container" style={{ maxWidth: '800px', textAlign: 'center' }}>
          <p className="eyebrow" style={{ marginBottom: '0.5rem' }}>OUR PROCESS</p>
          <h2 className="section-title reveal" style={{ marginBottom: '3rem' }}>From Onboarding to Success</h2>

          <div className="process-side-grid">
            
            <div className="process-side-row reveal">
              <div className="process-side-video-wrapper">
                <img src="/src/assets/engineers_working.png" alt="Engineers collaborating" className="process-side-image" />
              </div>
              <div className="process-side-text">
                <span className="process-side-numeral">01</span>
                <h3 style={{ fontSize: '2rem', marginBottom: '1rem' }}>Discovery</h3>
                <p style={{ fontSize: '1.15rem', color: 'var(--muted-2)', lineHeight: 1.7 }}>Initial consultation to define goals, requirements, constraints, and your current workflow reality.</p>
              </div>
            </div>

            <div className="process-side-row reveal">
              <div className="process-side-video-wrapper">
                <img src="/src/assets/strategy_meeting.png" alt="Tech strategy meeting" className="process-side-image" />
              </div>
              <div className="process-side-text">
                <span className="process-side-numeral">02</span>
                <h3 style={{ fontSize: '2rem', marginBottom: '1rem' }}>Organize</h3>
                <p style={{ fontSize: '1.15rem', color: 'var(--muted-2)', lineHeight: 1.7 }}>Developing a tailored implementation strategy, roadmap, data pipelines, and a concrete project timeline.</p>
              </div>
            </div>

            <div className="process-side-row reveal">
              <div className="process-side-video-wrapper">
                <img src="/src/assets/developing_code.png" alt="Developer hands typing code" className="process-side-image" />
              </div>
              <div className="process-side-text">
                <span className="process-side-numeral">03</span>
                <h3 style={{ fontSize: '2rem', marginBottom: '1rem' }}>Develop</h3>
                <p style={{ fontSize: '1.15rem', color: 'var(--muted-2)', lineHeight: 1.7 }}>Setting up your environment, training models, crafting intelligent agents, and integrating foundational tools.</p>
              </div>
            </div>

            <div className="process-side-row reveal">
              <div className="process-side-video-wrapper">
                <img src="/src/assets/deploying_servers.png" alt="Modern server room" className="process-side-image" />
              </div>
              <div className="process-side-text">
                <span className="process-side-numeral">04</span>
                <h3 style={{ fontSize: '2rem', marginBottom: '1rem' }}>Deploy</h3>
                <p style={{ fontSize: '1.15rem', color: 'var(--muted-2)', lineHeight: 1.7 }}>Safely pushing agents and models into the workflow. Integrating with identity, access, and observability platforms.</p>
              </div>
            </div>

            <div className="process-side-row reveal">
              <div className="process-side-video-wrapper">
                <img src="/src/assets/people_presenting.png" alt="Team presentation" className="process-side-image" />
              </div>
              <div className="process-side-text">
                <span className="process-side-numeral">05</span>
                <h3 style={{ fontSize: '2rem', marginBottom: '1rem' }}>Solutions</h3>
                <p style={{ fontSize: '1.15rem', color: 'var(--muted-2)', lineHeight: 1.7 }}>Comprehensive team rollout of document processing lines, knowledge bases, and conversational channels.</p>
              </div>
            </div>

            <div className="process-side-row reveal">
              <div className="process-side-video-wrapper">
                <img src="/src/assets/team_enablement.png" alt="Team laughing at laptop" className="process-side-image" />
              </div>
              <div className="process-side-text">
                <span className="process-side-numeral">06</span>
                <h3 style={{ fontSize: '2rem', marginBottom: '1rem' }}>Enablement</h3>
                <p style={{ fontSize: '1.15rem', color: 'var(--muted-2)', lineHeight: 1.7 }}>Ongoing support, human-in-the-loop oversight, training, and audits for continuous improvement.</p>
              </div>
            </div>

          </div>
        </div>
      </section>
    </main>
  );
}
