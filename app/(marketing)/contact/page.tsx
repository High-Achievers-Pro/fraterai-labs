"use client";

import { useRef, useState } from 'react';
import Link from 'next/link';
import Script from 'next/script';
import TurnstileWidget, { type TurnstileWidgetHandle } from '@/components/TurnstileWidget';
// Imported from lib/lead-form-fields.ts, not the route handler itself: the
// route transitively imports 'server-only' (via lib/server/leads.ts,
// hubspot-mirror.ts, turnstile.ts), and Next.js refuses to bundle anything
// that imports 'server-only' into a Client Component. The route re-exports
// these same constants for anyone reading app/api/leads/inbound/route.ts,
// but this file must import the dependency-free source directly.
import {
  HONEYPOT_FIELD_NAME,
  PAGE_URI_FIELD_NAME,
  TURNSTILE_TOKEN_FIELD_NAME,
} from '@/lib/lead-form-fields';

export default function Contact() {
  const [activeTab, setActiveTab] = useState<'form' | 'calendar'>('form');
  const [turnstileToken, setTurnstileToken] = useState('');
  // Cloudflare siteverify tokens are single-use. Without this, a visitor
  // who fixes a validation error and retries (or retries after a
  // transient 500) resubmits the same, already-consumed token and gets
  // "Verification failed" instead of the real, now-corrected outcome —
  // with no recovery short of a full page reload. Every failure branch
  // below clears turnstileToken and calls turnstileRef.current?.reset()
  // so a retry gets a fresh token.
  const turnstileRef = useRef<TurnstileWidgetHandle>(null);
  const [buttonState, setButtonState] = useState({
    text: 'Send Message',
    disabled: false,
    color: '',
    borderColor: '',
    backgroundColor: ''
  });

  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const originalText = 'Send Message';
    setButtonState({ ...buttonState, text: 'Sending...', disabled: true });
    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') || '';
    const email = formData.get('email') || '';
    const company = formData.get('company') || '';
    const msg = formData.get('message') || '';
    const website = formData.get(HONEYPOT_FIELD_NAME) || '';

    const payload = {
      name,
      email,
      company,
      message: msg,
      [HONEYPOT_FIELD_NAME]: website,
      [PAGE_URI_FIELD_NAME]: window.location.href,
      [TURNSTILE_TOKEN_FIELD_NAME]: turnstileToken,
    };

    try {
      const response = await fetch('/api/leads/inbound', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        setButtonState({
          text: '✓ Message Sent! We will get in touch soon.',
          disabled: false,
          color: '#10B981',
          borderColor: '#10B981',
          backgroundColor: 'transparent'
        });
        (e.target as HTMLFormElement).reset();
      } else {
        // The Turnstile token the route just rejected (or ignored on the
        // way to a 500) is single-use and already consumed. Clearing it
        // and resetting the widget means the retry this error state
        // invites actually gets a fresh token instead of repeating the
        // same "Verification failed" regardless of what the visitor fixes.
        setTurnstileToken('');
        turnstileRef.current?.reset();
        setButtonState({
          text: 'Error submitting form. Please try again.',
          disabled: false,
          color: '#ef4444',
          borderColor: '#ef4444',
          backgroundColor: 'transparent'
        });
      }
    } catch (error) {
      // Same reasoning as the non-ok branch above: a request that reached
      // the network layer may still have reached and consumed the token
      // at the server before the client-visible failure (e.g. the
      // response failed to come back), so reset defensively here too.
      setTurnstileToken('');
      turnstileRef.current?.reset();
      setButtonState({
        ...buttonState,
        text: 'Network error sending message.',
        disabled: false
      });
    } finally {
      setTimeout(() => {
        setButtonState({
          text: originalText,
          disabled: false,
          color: '',
          borderColor: '',
          backgroundColor: ''
        });
      }, 6000);
    }
  };

  return (
    <main id="top">
      <section className="section">
        <div className="container split-contact reveal">
          <div className="contact-left">
            <h1 style={{ fontSize: '3.5rem', marginBottom: '1.5rem', fontWeight: 600 }}>
              Let's build something <span style={{ fontFamily: "ui-serif, Georgia, Cambria, 'Times New Roman', Times, serif", fontStyle: 'italic', color: 'var(--accent)' }}>extraordinary.</span>
            </h1>
            <p>Whether you need a custom document-processing pipeline, an army of intelligent agents, or an enterprise-wide model rollout, our engineering team is ready to help you push boundaries.</p>
            <div style={{ marginTop: '3rem' }}>
              <p style={{ fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)', marginBottom: '0.5rem' }}>DIRECT EMAIL</p>
              <p><a href="mailto:hello@highachievers.ai" style={{ color: '#fff', textDecoration: 'none', fontSize: '1.25rem' }}>hello@highachievers.ai</a></p>
            </div>
          </div>

          <div className="contact-right">
            <div className="contact-tabs">
              <button 
                className={`contact-tab ${activeTab === 'form' ? 'active' : ''}`} 
                onClick={() => setActiveTab('form')}
              >
                Send Message
              </button>
              <button 
                className={`contact-tab ${activeTab === 'calendar' ? 'active' : ''}`} 
                onClick={() => setActiveTab('calendar')}
              >
                Book a Call
              </button>
            </div>

            <div id="contact-form-view" style={{ display: activeTab === 'form' ? 'block' : 'none' }}>
              <form id="cinematic-contact-form" onSubmit={handleSubmit} className="cinematic-form">

                <div className="form-group">
                  <label htmlFor="name">Name</label>
                  <input type="text" id="name" name="name" placeholder="Jane Doe" required />
                </div>
                <div className="form-group">
                  <label htmlFor="email">Work Email</label>
                  <input type="email" id="email" name="email" placeholder="jane@company.com" required />
                </div>
                <div className="form-group">
                  <label htmlFor="company">Company</label>
                  <input type="text" id="company" name="company" placeholder="Acme Corp" />
                </div>
                <div className="form-group">
                  <label htmlFor="message">How can we help?</label>
                  <textarea id="message" name="message" rows={5} placeholder="Tell us about your context and goals..." required></textarea>
                </div>
                <div
                  aria-hidden="true"
                  style={{ position: 'absolute', left: '-9999px', top: 'auto', width: '1px', height: '1px', overflow: 'hidden' }}
                >
                  <input
                    type="text"
                    name={HONEYPOT_FIELD_NAME}
                    tabIndex={-1}
                    autoComplete="off"
                  />
                </div>
                {siteKey && (
                  <div style={{ margin: '1rem 0' }}>
                    <TurnstileWidget ref={turnstileRef} siteKey={siteKey} onVerify={setTurnstileToken} onExpire={() => setTurnstileToken('')} />
                  </div>
                )}
                <button
                  type="submit" 
                  disabled={buttonState.disabled}
                  className="btn btn-primary btn-block" 
                  style={{ 
                    width: '100%', 
                    justifyContent: 'center', 
                    transition: 'all 0.3s ease',
                    color: buttonState.color || undefined,
                    borderColor: buttonState.borderColor || undefined,
                    backgroundColor: buttonState.backgroundColor || undefined 
                  }}
                >
                  {buttonState.text}
                </button>
              </form>
            </div>

            <div id="contact-calendar-view" className="cinematic-form" style={{ display: activeTab === 'calendar' ? 'block' : 'none', padding: 0, overflow: 'hidden', border: 'none', background: 'transparent', boxShadow: 'none' }}>
              <div className="calendly-inline-widget" data-url="https://calendly.com/sabayo507" style={{ minWidth: '320px', height: '750px' }}></div>
              <Script type="text/javascript" src="https://assets.calendly.com/assets/external/widget.js" strategy="lazyOnload" />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
