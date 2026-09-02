"use client";

import React, { useState } from 'react';
import Script from 'next/script';
import { useCalendly, CalendlyPrefill } from './CalendlyContext';

interface CalendlyInlineProps {
  url?: string;
  height?: string;
  prefillOverride?: CalendlyPrefill;
}

export default function CalendlyInline({ url, height = '750px', prefillOverride }: CalendlyInlineProps) {
  const { calendlyUrl, prefill: contextPrefill } = useCalendly();
  const [isLoading, setIsLoading] = useState(true);

  const activeUrl = url || calendlyUrl;
  const activePrefill = { ...contextPrefill, ...prefillOverride };

  const buildEmbedUrl = () => {
    try {
      const urlObj = new URL(activeUrl);
      urlObj.searchParams.set('hide_landing_page_details', '1');
      urlObj.searchParams.set('hide_gdpr_banner', '1');
      urlObj.searchParams.set('background_color', '0b0f17');
      urlObj.searchParams.set('text_color', 'ffffff');
      urlObj.searchParams.set('primary_color', '10b981');

      if (activePrefill.name) urlObj.searchParams.set('name', activePrefill.name);
      if (activePrefill.email) urlObj.searchParams.set('email', activePrefill.email);
      if (activePrefill.subject || activePrefill.company) {
        const customText = [activePrefill.subject, activePrefill.company].filter(Boolean).join(' - ');
        urlObj.searchParams.set('a1', customText);
      }

      return urlObj.toString();
    } catch {
      return activeUrl;
    }
  };

  const embedUrl = buildEmbedUrl();

  return (
    <div
      className="calendly-inline-wrapper"
      style={{
        position: 'relative',
        width: '100%',
        height: height,
        borderRadius: '16px',
        overflow: 'hidden',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        background: '#0b0f17',
      }}
    >
      {isLoading && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#0b0f17',
            color: 'rgba(255, 255, 255, 0.7)',
            zIndex: 1,
            gap: '1rem',
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              border: '3px solid rgba(255, 255, 255, 0.1)',
              borderTopColor: '#10b981',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }}
          ></div>
          <span style={{ fontSize: '0.9rem', letterSpacing: '0.05em' }}>Loading Booking Calendar...</span>
        </div>
      )}

      <iframe
        src={embedUrl}
        width="100%"
        height="100%"
        frameBorder="0"
        title="Schedule a Call - Calendly"
        onLoad={() => setIsLoading(false)}
        style={{ border: 'none', width: '100%', height: '100%', minWidth: '320px' }}
      ></iframe>

      <Script type="text/javascript" src="https://assets.calendly.com/assets/external/widget.js" strategy="lazyOnload" />

      <style jsx global>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
