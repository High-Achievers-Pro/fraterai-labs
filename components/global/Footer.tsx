import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-grid-bg" aria-hidden="true" />

      <div className="container footer-main">
        {/* Brand column */}
        <div className="footer-brand">
          <Link href="/" className="footer-logo">
            <img src="/src/assets/logo.svg" alt="FraterAI Logo" width={36} height={36} />
            <span>FraterAI</span>
          </Link>
          <p className="footer-tagline">
            Intelligent agent architectures tailored to your deepest workflows.
          </p>
        </div>

        {/* Services column */}
        <div className="footer-col">
          <h4 className="footer-col-heading">Services</h4>
          <ul className="footer-links">
            <li><Link href="/services/ai-strategy">AI Strategy &amp; Roadmap</Link></li>
            <li><Link href="/services/ai-poc">AI Proof of Concept</Link></li>
            <li><Link href="/services/data-engineering">Data Engineering &amp; BI</Link></li>
            <li><Link href="/services/ai-agents">AI Agents &amp; Automation</Link></li>
            <li><Link href="/services/llm-generative-ai">LLM &amp; Generative AI</Link></li>
            <li><Link href="/services/machine-learning">Machine Learning &amp; CV</Link></li>
          </ul>
        </div>

        {/* Solutions column */}
        <div className="footer-col">
          <h4 className="footer-col-heading">Solutions</h4>
          <ul className="footer-links">
            <li><Link href="/solutions/document-processing">AI Document Processing</Link></li>
            <li><Link href="/solutions/knowledge-base">AI-Powered Knowledge Base</Link></li>
            <li><Link href="/solutions/customer-experience">AI-Driven Customer Experience</Link></li>
          </ul>
        </div>

        {/* Company column */}
        <div className="footer-col">
          <h4 className="footer-col-heading">Company</h4>
          <ul className="footer-links">
            <li><Link href="/about">About</Link></li>
            <li><Link href="/process">Our Process</Link></li>
            <li><Link href="/resources">Resources</Link></li>
            <li><Link href="/contact">Contact</Link></li>
          </ul>
        </div>

        {/* Contact column */}
        <div className="footer-col">
          <h4 className="footer-col-heading">Connect</h4>
          <ul className="footer-links">
            <li>
              <a href="https://www.linkedin.com/company/fraterai" target="_blank" rel="noopener noreferrer">
                LinkedIn
              </a>
            </li>
            <li>
              <a href="https://twitter.com/fraterai" target="_blank" rel="noopener noreferrer">
                Twitter / X
              </a>
            </li>
            <li>
              <a href="mailto:hello@fraterailabs.com">hello@fraterailabs.com</a>
            </li>
            <li>
              <Link href="/contact">Start a Conversation</Link>
            </li>
          </ul>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="footer-bottom">
        <div className="container footer-bottom-inner">
          <p className="footer-copyright">&copy; {new Date().getFullYear()} FraterAI. All rights reserved.</p>
          <div className="footer-legal">
            <Link href="/privacy">Privacy Policy</Link>
            <Link href="/terms">Terms of Service</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
