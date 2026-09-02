"use client";

import React, { useEffect } from 'react';
import Script from 'next/script';
import { useCalendly } from './CalendlyContext';

export default function CalendlyModal() {
  const { isOpen, closeCalendly, calendlyUrl, prefill } = useCalendly();

  // Prevent background scrolling when modal is active
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Construct full embed URL with query params
  const buildEmbedUrl = () => {
    const urlObj = new URL(calendlyUrl);
    urlObj.searchParams.set('hide_landing_page_details', '1');
    urlObj.searchParams.set('hide_gdpr_banner', '1');
    urlObj.searchParams.set('background_color', '0b0f17');
    urlObj.searchParams.set('text_color', 'ffffff');
    urlObj.searchParams.set('primary_color', '10b981');

    if (prefill.name) urlObj.searchParams.set('name', prefill.name);
    if (prefill.email) urlObj.searchParams.set('email', prefill.email);
    if (prefill.company) urlObj.searchParams.set('a1', prefill.company);

    return urlObj.toString();
  };

  const finalUrl = buildEmbedUrl();

  return (
    <div
      className="calendly-modal-overlay"
      onClick={closeCalendly}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(5, 8, 14, 0.85)',
        backdropFilter: 'blur(12px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        animation: 'fadeIn 0.25s ease-out forwards',
      }}
    >
      <div
        className="calendly-modal-container"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '900px',
          height: '90vh',
          maxHeight: '750px',
          backgroundColor: '#0b0f17',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 30px rgba(16, 185, 129, 0.15)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '1.25rem 1.75rem',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block', boxShadow: '0 0 10px #10b981' }}></span>
            <span style={{ color: '#ffffff', fontWeight: 600, fontSize: '1.1rem', letterSpacing: '-0.01em' }}>
              Schedule a Consultation &mdash; FraterAI
            </span>
          </div>

          <button
            onClick={closeCalendly}
            aria-label="Close modal"
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: 'rgba(255, 255, 255, 0.7)',
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.2rem',
              transition: 'all 0.2s ease',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.15)';
              e.currentTarget.style.color = '#ffffff';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
              e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)';
            }}
          >
            &times;
          </button>
        </div>

        {/* Modal Iframe Body */}
        <div style={{ flex: 1, width: '100%', position: 'relative', overflow: 'hidden' }}>
          <iframe
            src={finalUrl}
            width="100%"
            height="100%"
            frameBorder="0"
            title="Select a Date & Time - Calendly"
            style={{ border: 'none', width: '100%', height: '100%' }}
          ></iframe>
        </div>
      </div>
      <Script type="text/javascript" src="https://assets.calendly.com/assets/external/widget.js" strategy="lazyOnload" />
    </div>
  );
}
