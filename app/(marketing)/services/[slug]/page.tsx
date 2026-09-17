"use client";

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

const SERVICE_DATA: Record<string, { title: string; subtitle: string; description: string; benefits: string[] }> = {
  'ai-strategy': {
    title: 'AI Strategy & Roadmap',
    subtitle: 'Discover',
    description: 'We partner with enterprise leaders to identify the highest-impact opportunities for AI across your entire value chain. We deliver actionable, de-risked business cases and multi-year investment roadmaps.',
    benefits: ['Executive Alignment Workshops', 'ROI & Feasibility Modeling', 'Data Readiness Assessments', 'Make vs. Buy Analyses']
  },
  'ai-poc': {
    title: 'AI Proof of Concept',
    subtitle: 'Discover',
    description: 'Rapidly validate technical feasibility. We build fully-functional, time-boxed prototypes to prove that your most critical AI assumptions hold true before committing to large-scale development.',
    benefits: ['4-6 Week Delivery Cycles', 'Core Assumption Validation', 'Technology Stack Down-selection', 'Stakeholder Buy-in Tools']
  },
  'data-engineering': {
    title: 'Data Engineering & BI',
    subtitle: 'Organize',
    description: 'Models are only as good as the pipelines that feed them. We architect the robust, scalable data lakes and ETL systems required for AI initiatives to succeed unconditionally.',
    benefits: ['Scalable Data Lakes & Warehouses', 'Real-time ETL Pipelines', 'Data Governance Frameworks', 'Advanced BI Dashboards']
  },
  'ai-agents': {
    title: 'AI Agents & Automation',
    subtitle: 'Develop',
    description: 'Deploy sophisticated, autonomous multi-agent systems capable of chaining complex, iterative reasoning tasks together to completely automate expensive internal workflows.',
    benefits: ['Multi-Agent Orchestration', 'Workflow Automation Engine', 'API Orchestration', 'Recursive Reasoning Loops']
  },
  'llm-generative-ai': {
    title: 'LLM & Generative AI',
    subtitle: 'Develop',
    description: 'Fine-tuning, prompt engineering, and secure integration of state-of-the-art Large Language Models against your proprietary corporate data.',
    benefits: ['Custom Model Fine-tuning', 'Vector Database Deployments', 'Secure RAG Architectures', 'Prompt Engineering Factories']
  },
  'chatbot-conversational-ai': {
    title: 'Chatbot & Conversational AI',
    subtitle: 'Develop',
    description: 'Build deeply contextual, intent-driven conversational interfaces for internal logistics, human resources operations, and external customer support.',
    benefits: ['Omni-channel Integrations', 'Dynamic Entity Recognition', 'Human-in-the-loop Handoff', 'Multi-lingual Support']
  },
  'ai-native-product': {
    title: 'AI-Native Product Engineering',
    subtitle: 'Develop',
    description: 'We do not just bolt APIs onto legacy software. We engineer ground-up Full Stack web applications where native artificial intelligence is an integrated fabric of the software.',
    benefits: ['Full Stack Web Development', 'React / Next.js Architecture', 'Serverless Scalability', 'Generative UI Systems']
  },
  'machine-learning': {
    title: 'Machine Learning & Computer Vision',
    subtitle: 'Develop',
    description: 'Train bespoke predictive models, anomaly detection algorithms, and advanced optical character recognition pipelines to parse images, videos, and unstructured environments.',
    benefits: ['Predictive Maintenance', 'Deep Neural Networks', 'Real-time Object Detection', 'Optical Character Recognition']
  },
  'ai-integration': {
    title: 'AI Integration Services',
    subtitle: 'Deploy',
    description: 'Embed artificial intelligence reliably into live production systems, legacy technology stacks, and existing enterprise CI/CD pipelines without disrupting ongoing business.',
    benefits: ['Zero-downtime Deployments', 'Secure API Gateways', 'Legacy System Bridge Building', 'Performance Monitoring']
  },
  'ai-enablement': {
    title: 'AI Training & Teams',
    subtitle: 'Enablement',
    description: 'We do not just hand over code. We inject talent bandwidth and train your internal developers to inherit, manage, and scale the artificial intelligence systems we build.',
    benefits: ['Codebase Custody Transfer', 'Developer Workshops', 'MLOps Best Practices', 'Post-launch retainers']
  }
};

export default function ServiceDetailRoute() {
  const params = useParams();
  const slug = params.slug as string;
  const data = SERVICE_DATA[slug];

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!data) {
    return (
      <main className="section" style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="container" style={{ textAlign: 'center' }}>
          <h1>Service Not Found</h1>
          <p style={{ color: 'var(--muted)', marginTop: '1rem' }}>The requested capability does not exist in our matrix.</p>
          <Link href="/services" className="btn btn-primary" style={{ marginTop: '2rem' }}>Return to Services</Link>
        </div>
      </main>
    );
  }

  return (
    <main id="top" style={{ minHeight: '100vh', background: 'var(--bg)', position: 'relative' }}>
      
      {/* Structural Wireframe Grid Background (Ultra Premium Consulting Vibe) */}
      <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundImage: 'linear-gradient(rgba(0,0,0,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.03) 1px, transparent 1px)', backgroundSize: '100px 100px', pointerEvents: 'none', zIndex: 0 }} />

      <section style={{ paddingTop: '12rem', paddingBottom: '8rem', position: 'relative', zIndex: 1 }}>
        
        <div className="container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '6rem', alignItems: 'flex-start' }}>
          
          {/* Left Column: Asymmetrical Sticky Context */}
          <div style={{ position: 'sticky', top: '150px', opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(20px)', transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1)' }}>
            <p style={{ color: 'var(--accent)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.9rem' }}>
               <span style={{ width: '40px', height: '2px', background: 'var(--accent)' }} /> 
               {data.subtitle} Phase Requirements
            </p>
            <h1 style={{ fontSize: 'clamp(3rem, 5vw, 4.5rem)', fontWeight: 700, lineHeight: 1.1, marginBottom: '2rem', color: 'var(--text)', letterSpacing: '-0.02em' }}>
              {data.title}
            </h1>
            <p style={{ fontSize: '1.35rem', color: 'var(--muted-2)', lineHeight: 1.7, marginBottom: '3.5rem' }}>
              {data.description}
            </p>
            
            <div style={{ display: 'flex', gap: '1.5rem' }}>
              <Link href="/contact" className="btn btn-primary" style={{ padding: '1.25rem 2.5rem', fontSize: '1.1rem', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}>Request Engineering Support</Link>
            </div>
          </div>

          {/* Right Column: Glassmorphic Cascading Feature Panels */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
             {data.benefits.map((benefit, idx) => (
                <div key={idx} style={{ 
                  background: 'rgba(255, 255, 255, 0.65)', 
                  backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)', 
                  border: '1px solid rgba(0,0,0,0.05)', 
                  padding: '3.5rem 3rem', 
                  borderRadius: '24px', 
                  boxShadow: '0 30px 60px rgba(0,0,0,0.04)',
                  position: 'relative',
                  overflow: 'hidden',
                  opacity: mounted ? 1 : 0,
                  transform: mounted ? 'translateY(0)' : 'translateY(40px)',
                  transition: `all 0.8s cubic-bezier(0.16, 1, 0.3, 1) ${0.2 + (idx * 0.15)}s`
                }}>
                   {/* Delicate Geometric Overlay */}
                   <div style={{ position: 'absolute', top: '-10px', right: '-10px', width: '100px', height: '100px', border: '1px solid rgba(0,0,0,0.05)', borderRadius: '50%', pointerEvents: 'none' }} />
                   <div style={{ position: 'absolute', top: '10px', right: '10px', width: '60px', height: '60px', border: '1px solid rgba(0,0,0,0.05)', borderRadius: '50%', pointerEvents: 'none' }} />

                   <div style={{ fontSize: '3rem', fontWeight: 300, color: 'var(--muted)', opacity: 0.2, marginBottom: '1.5rem', lineHeight: 1, fontFamily: "ui-serif, Georgia, serif", fontStyle: 'italic' }}>
                     0{idx + 1}.
                   </div>
                   
                   <h3 style={{ fontSize: '1.8rem', fontWeight: 600, marginBottom: '1.25rem', letterSpacing: '-0.01em' }}>{benefit}</h3>
                   <p style={{ color: 'var(--muted)', fontSize: '1.15rem', lineHeight: 1.7 }}>
                     We deploy top-tier architectural rigor for {benefit.toLowerCase()}, ensuring that theoretical capabilities translate predictably into enterprise production value without compromise.
                   </p>
                </div>
             ))}
          </div>

        </div>
      </section>
    </main>
  );
}
