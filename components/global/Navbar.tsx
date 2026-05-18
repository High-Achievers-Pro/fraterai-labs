"use client";

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';

export default function Navbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  // Close mobile menu when navigating to a new route
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
  }, [isMobileMenuOpen]);

  const toggleMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <header className="site-header">
      <div className="container">
        <Link href="/" className="brand">
          <img src="/src/assets/logo.svg" alt="FraterAI Logo" className="brand-mark" width={32} height={32} />
          <span className="brand-name">FraterAI</span>
        </Link>

        {/* Mobile Hamburger Toggle */}
        <button 
          className="mobile-toggle" 
          onClick={toggleMenu}
          aria-expanded={isMobileMenuOpen}
          aria-controls="mobile-nav"
          aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
        >
          {isMobileMenuOpen ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          )}
        </button>

        <nav id="mobile-nav" className={`nav ${isMobileMenuOpen ? 'nav-open' : ''}`}>
          <Link href="/">Home</Link>
          
          <div className="nav-item">
            <Link href="/services">Services</Link>
            <div className="mega-menu">
              <div className="mega-grid">
                <div className="mega-col">
                  <h4>Discover</h4>
                  <ul className="mega-col-list">
                    <li>
                      <Link href="/services/ai-strategy" onClick={() => setIsMobileMenuOpen(false)}>AI Strategy &amp; Roadmap</Link>
                      <p>Identify highest-impact opportunities and build business cases.</p>
                    </li>
                    <li>
                      <Link href="/services/ai-poc" onClick={() => setIsMobileMenuOpen(false)}>AI Proof of Concept</Link>
                      <p>Validate technical feasibility and de-risk core assumptions.</p>
                    </li>
                  </ul>
                </div>
                <div className="mega-col">
                  <h4>Organize</h4>
                  <ul className="mega-col-list">
                    <li>
                      <Link href="/services/data-engineering" onClick={() => setIsMobileMenuOpen(false)}>Data Engineering &amp; BI</Link>
                      <p>Architect robust data pipelines for scalable AI initiatives.</p>
                    </li>
                  </ul>
                </div>
                <div className="mega-col">
                  <h4>Develop</h4>
                  <ul className="mega-col-list">
                    <li><Link href="/services/ai-agents" onClick={() => setIsMobileMenuOpen(false)}>AI Agents &amp; Automation</Link></li>
                    <li><Link href="/services/llm-generative-ai" onClick={() => setIsMobileMenuOpen(false)}>LLM &amp; Generative AI</Link></li>
                    <li><Link href="/services/chatbot-conversational-ai" onClick={() => setIsMobileMenuOpen(false)}>Chatbot &amp; Conversational AI</Link></li>
                    <li><Link href="/services/ai-native-product" onClick={() => setIsMobileMenuOpen(false)}>AI-Native Product Eng</Link></li>
                    <li><Link href="/services/machine-learning" onClick={() => setIsMobileMenuOpen(false)}>Machine Learning &amp; CV</Link></li>
                  </ul>
                </div>
                <div className="mega-col">
                  <h4>Deploy &amp; Enable</h4>
                  <ul className="mega-col-list">
                    <li>
                      <Link href="/services/ai-integration" onClick={() => setIsMobileMenuOpen(false)}>AI Integration Services</Link>
                      <p>Embed AI securely into legacy enterprise stacks.</p>
                    </li>
                    <li>
                      <Link href="/services/ai-enablement" onClick={() => setIsMobileMenuOpen(false)}>AI Training &amp; Teams</Link>
                      <p>Inject talent bandwidth and scale internal capacity.</p>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <Link href="/process">Process</Link>
          
          <div className="nav-item">
            <Link href="/solutions">Solutions</Link>
            <div className="mega-menu">
              <div className="mega-grid">
                <div className="mega-col" style={{ flex: 2 }}>
                  <h4>Turnkey Capabilities</h4>
                  <ul className="mega-col-list" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                    <li>
                      <Link href="/solutions/document-processing" onClick={() => setIsMobileMenuOpen(false)}>AI Document Processing</Link>
                      <p>Turn unstructured PDFs and contracts into actionable internal data instantly.</p>
                    </li>
                    <li>
                      <Link href="/solutions/knowledge-base" onClick={() => setIsMobileMenuOpen(false)}>AI-Powered Knowledge Base</Link>
                      <p>Deploy secure RAG engines grounded purely in native company documentation.</p>
                    </li>
                    <li>
                      <Link href="/solutions/customer-experience" onClick={() => setIsMobileMenuOpen(false)}>AI-Driven Customer Experience</Link>
                      <p>Deploy omni-channel autonomous systems that perfectly resolve tiered support routing.</p>
                    </li>
                  </ul>
                </div>
                <div className="mega-col" style={{ flex: 1 }}>
                  <div style={{ background: 'var(--bg-2)', padding: '2rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
                    <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem', fontWeight: 600 }}>Want to see them in action?</h3>
                    <p style={{ fontSize: '0.95rem', color: 'var(--muted)', marginBottom: '1.5rem', lineHeight: 1.6 }}>Our engineering team runs weekly live demonstrations of our turnkey solutions.</p>
                    <Link href="/contact" className="btn btn-primary btn-sm" onClick={() => setIsMobileMenuOpen(false)}>Request a Demo</Link>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <Link href="/resources">Resources</Link>
          <Link href="/about">About</Link>
          <Link href="/contact" className="btn btn-primary btn-sm mobile-cta">Start a conversation</Link>
        </nav>
      </div>
    </header>
  );
}
