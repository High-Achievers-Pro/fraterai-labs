"use client";

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

const SOLUTION_DATA: Record<string, { title: string; iconPath: string; description: string; benefits: string[] }> = {
  'document-processing': {
    title: 'AI Document Processing',
    iconPath: 'M3 3h18v18H3z M9 9h6 M9 13h6 M9 17h3',
    description: 'Automate the extraction of unstructured data from complex legal contracts, invoices, and hand-written PDFs into structured, machine-readable formats. Instantly turn documents into accessible knowledge pipelines.',
    benefits: ['Optical Character Recognition (OCR)', 'Semantic Entity Extraction', 'Handwriting Recognition Models', 'Automated Compliance & Redaction']
  },
  'knowledge-base': {
    title: 'AI-Powered Knowledge Base',
    iconPath: 'M12 2a9 3 0 1 0 0 6 9 3 0 1 0 0-6z M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5 M21 12c0 1.66-4 3-9 3s-9-1.34-9-3',
    description: 'Deploy secure Retrieval-Augmented Generation (RAG) engines that give your workforce instant, cited answers grounded entirely in your proprietary internal documentation, completely insulated from open internet hallucination.',
    benefits: ['Direct Citation & Source Linking', 'Secure RBAC & SSO Integration', 'Zero-Hallucination Guardrails', 'Multi-format Ingestion (Confluence, Jira, Word)']
  },
  'customer-experience': {
    title: 'AI-Driven Customer Experience',
    iconPath: 'M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z',
    description: 'Implement intelligent conversational agents that securely handle tiered support routing, complex account inquiries, and instantaneous multilingual resolutions, reducing expensive L1 queue bottlenecks.',
    benefits: ['Omnichannel Platform Deployment', 'Sentiment Analysis & Escalation', 'Seamless Human Agent Handoff', 'Automated Ticketing Resolution']
  }
};

export default function SolutionDetailRoute() {
  const params = useParams();
  const slug = params.slug as string;
  const data = SOLUTION_DATA[slug];

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!data) {
    return (
      <main className="section" style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="container" style={{ textAlign: 'center' }}>
          <h1>Solution Not Found</h1>
          <p style={{ color: 'var(--muted)', marginTop: '1rem' }}>The requested packaged solution does not exist.</p>
          <Link href="/solutions" className="btn btn-primary" style={{ marginTop: '2rem' }}>View All Solutions</Link>
        </div>
      </main>
    );
  }

  return (
    <main id="top" style={{ minHeight: '100vh', background: 'var(--bg)', position: 'relative', overflow: 'hidden' }}>
      
      {/* Ambient Radial Glow */}
      <div style={{ position: 'absolute', top: '-10%', left: '50%', transform: 'translateX(-50%)', width: '100vw', height: '100vw', borderRadius: '50%', background: 'radial-gradient(circle, rgba(37,99,235,0.06) 0%, rgba(0,0,0,0) 60%)', zIndex: 0, pointerEvents: 'none' }} />

      <section style={{ paddingTop: '10rem', paddingBottom: '8rem', position: 'relative', zIndex: 1 }}>
        <div className="container">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4rem', alignItems: 'center' }}>
            
            {/* Massive Hero Header */}
            <div style={{ textAlign: 'center', maxWidth: '1000px', opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(20px)', transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1)' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 1.25rem', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: '99px', marginBottom: '2.5rem', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 12px var(--accent)' }} className="pulse" />
                <span style={{ fontSize: '0.85rem', fontWeight: 600, letterSpacing: '0.1em', color: 'var(--muted)', textTransform: 'uppercase' }}>Turnkey Capability</span>
              </div>
              <h1 style={{ fontSize: 'clamp(3.5rem, 6vw, 5.5rem)', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.05, marginBottom: '2rem', color: 'var(--text)' }}>
                {data.title}
              </h1>
              <p style={{ fontSize: '1.35rem', color: 'var(--muted-2)', lineHeight: 1.7, maxWidth: '800px', margin: '0 auto', fontWeight: 400 }}>
                {data.description}
              </p>
            </div>

            {/* Immersive Bento Grid for Features */}
            <div style={{ width: '100%', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '2rem', marginTop: '3rem' }}>
              {data.benefits.map((benefit, idx) => (
                <div key={idx} style={{ 
                    background: 'rgba(255, 255, 255, 0.65)', backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)', 
                    border: '1px solid rgba(0,0,0,0.05)', borderRadius: '24px', padding: '3.5rem 2.5rem', position: 'relative', 
                    overflow: 'hidden', display: 'flex', flexDirection: 'column', 
                    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.02)',
                    opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(20px)', 
                    transition: `all 0.8s cubic-bezier(0.16, 1, 0.3, 1) ${0.1 + (idx * 0.1)}s` 
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-10px)'; e.currentTarget.style.boxShadow = '0 30px 60px rgba(0,0,0,0.06)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 20px 40px rgba(0,0,0,0.02)'; }}
                >
                  
                  {/* Subtle Top Gradient Line */}
                  <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '4px', background: 'linear-gradient(90deg, var(--accent), transparent)' }} />

                  <div style={{ width: '64px', height: '64px', borderRadius: '20px', background: 'var(--bg)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '2.5rem', boxShadow: '0 8px 16px rgba(0,0,0,0.04)' }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5">
                       <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                       <polyline points="22 4 12 14.01 9 11.01"></polyline>
                    </svg>
                  </div>
                  
                  <h3 style={{ fontSize: '1.65rem', fontWeight: 600, marginBottom: '1.25rem', color: 'var(--text)', lineHeight: 1.2 }}>{benefit}</h3>
                  <p style={{ color: 'var(--muted)', lineHeight: 1.7, fontSize: '1.1rem', marginTop: 'auto' }}>
                    Enterprise-grade {benefit.toLowerCase()} engineered specifically to eliminate friction natively inside your workflow.
                  </p>
                </div>
              ))}
            </div>

          </div>
        </div>
      </section>

      {/* Premium Deployment Bar */}
      <section style={{ borderTop: '1px solid rgba(0,0,0,0.05)', background: 'rgba(250, 250, 250, 0.8)', backdropFilter: 'blur(20px)', position: 'relative' }}>
         <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5rem 0', flexWrap: 'wrap', gap: '3rem' }}>
            <div style={{ flex: '1 1 500px' }}>
              <h2 style={{ fontSize: '3rem', fontWeight: 600, marginBottom: '1rem', letterSpacing: '-0.02em' }}>Deploy in Weeks, Not Months.</h2>
              <p style={{ fontSize: '1.2rem', color: 'var(--muted-2)' }}>Our dedicated architects will securely integrate the {data.title} ecosystem directly into your infrastructure with zero downtime.</p>
            </div>
            <Link href="/contact" className="btn btn-primary" style={{ padding: '1.3rem 3.5rem', fontSize: '1.15rem', borderRadius: '99px', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}>
               Initiate Deployment Assessment
            </Link>
         </div>
      </section>
    </main>
  );
}
