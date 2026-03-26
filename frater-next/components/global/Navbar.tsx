import Link from 'next/link';
import Image from 'next/image';

export default function Navbar() {
  return (
    <header className="site-header">
      <div className="container">
        <Link href="/" className="brand">
          {/* We use standard img for SVGs to avoid Next.js Image optimizing complexity for basic UI elements */}
          <img src="/src/assets/logo.svg" alt="FraterAI Logo" className="brand-mark" width={32} height={32} />
          <span className="brand-name">FraterAI</span>
        </Link>
        <nav className="nav">
          <Link href="/">Home</Link>
          <Link href="/services">Services</Link>
          <Link href="/process">Process</Link>
          <Link href="/solutions">Solutions</Link>
          <Link href="/resources">Resources</Link>
          <Link href="/about">About</Link>
          <Link href="/contact" className="btn btn-primary btn-sm">Start a conversation</Link>
        </nav>
      </div>
    </header>
  );
}
