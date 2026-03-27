"use client";

import { useState } from 'react';
import Link from 'next/link';
import Script from 'next/script';

export default function Contact() {
  const [activeTab, setActiveTab] = useState<'form' | 'calendar'>('form');
  const [buttonState, setButtonState] = useState({
    text: 'Send Message',
    disabled: false,
    color: '',
    borderColor: '',
    backgroundColor: ''
  });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const originalText = 'Send Message';
    setButtonState({ ...buttonState, text: 'Sending...', disabled: true });
    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') || 'Unknown User';
    const email = formData.get('email') || 'No Email';
    const company = formData.get('company') || '';
    const msg = formData.get('message') || '';

    const customSubject = `URGENT - New Client [${name}] request!`;
    const customBody = `A client named ${name} with email ${email}${company ? ` from ${company} ` : ' '}is looking for:\n\n"${msg}"`;

    const payload = new FormData();
    payload.append('_captcha', 'false');
    payload.append('_template', 'basic');
    payload.append('_subject', customSubject as string);
    payload.append('email', email as string);
    payload.append('Message_Details', customBody);

    try {
      const response = await fetch('https://formsubmit.co/sabayo507@gmail.com', {
        method: 'POST',
        body: payload,
        headers: { 'Accept': 'application/json' }
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
        setButtonState({
          text: 'Error: Owner must click "Activate Form" in inbox first.',
          disabled: false,
          color: '#ef4444',
          borderColor: '#ef4444',
          backgroundColor: 'transparent'
        });
      }
    } catch (error) {
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
                <input type="hidden" name="_captcha" value="false" />
                <input type="text" name="_honey" style={{ display: 'none' }} />
                <input type="hidden" name="_subject" value="New Lead from FraterAI Website!" />
                <input type="hidden" name="_template" value="table" />

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
