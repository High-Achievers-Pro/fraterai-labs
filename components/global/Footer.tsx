import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, EnvelopeSimple } from "@phosphor-icons/react/dist/ssr";

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-main">
        <div className="footer-brand">
          <Link href="/" className="brand">
            <Image
              src="/brand/fraterai-logo.svg"
              alt="FraterAI"
              width={200}
              height={42}
              className="brand-logo"
            />
          </Link>
          <p>
            Intelligent agent architectures tailored to your deepest workflows.
          </p>
          <span className="small-rule" />
        </div>
        <div className="footer-col">
          <h2>Services</h2>
          <Link href="/services/ai-strategy">AI Strategy & Roadmap</Link>
          <Link href="/services/ai-poc">AI Proof of Concept</Link>
          <Link href="/services/data-engineering">Data Engineering & BI</Link>
          <Link href="/services/ai-agents">AI Agents & Automation</Link>
          <Link href="/services/llm-generative-ai">LLM & Generative AI</Link>
          <Link href="/services/machine-learning">Machine Learning & CV</Link>
        </div>
        <div className="footer-col">
          <h2>Solutions</h2>
          <Link href="/solutions/document-processing">
            AI Document Processing
          </Link>
          <Link href="/solutions/knowledge-base">
            AI-Powered Knowledge Base
          </Link>
          <Link href="/solutions/customer-experience">
            AI-Driven Customer Experience
          </Link>
        </div>
        <div className="footer-col">
          <h2>Company</h2>
          <Link href="/about">About</Link>
          <Link href="/process">Our Process</Link>
          <Link href="/resources">Resources</Link>
          <Link href="/contact">Contact</Link>
        </div>
        <div className="footer-col">
          <h2>Connect</h2>
          <a
            href="https://www.linkedin.com/company/fraterai"
            target="_blank"
            rel="noopener noreferrer"
          >
            LinkedIn <ArrowUpRight size={14} />
          </a>
          <a
            href="https://twitter.com/fraterai"
            target="_blank"
            rel="noopener noreferrer"
          >
            Twitter / X <ArrowUpRight size={14} />
          </a>
          <a href="mailto:fraterai@fraterailabs.com">
            <EnvelopeSimple size={17} />
            fraterai@fraterailabs.com
          </a>
        </div>
      </div>
      <div className="container footer-bottom">
        <p>© {new Date().getFullYear()} FraterAI. All rights reserved.</p>
        <div className="footer-legal">
          <Link href="/privacy">Privacy Policy</Link>
          <Link href="/terms">Terms of Service</Link>
        </div>
        <p>AI for real operators.</p>
      </div>
    </footer>
  );
}
