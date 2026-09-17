'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import Script from 'next/script';

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: Record<string, unknown>) => string;
      reset: (widgetId?: string) => void;
    };
  }
}

type TurnstileWidgetProps = {
  siteKey: string;
  onVerify: (token: string) => void;
  onExpire?: () => void;
};

// A Cloudflare siteverify token is single-use — the server consumes it on
// the first request that reaches it, success or failure. A consumer that
// lets a visitor retry after a failed submission (the contact form does;
// the magic-link form does not — it collapses every outcome into one
// message and never re-shows the form) must get a *fresh* token before
// that retry, or the retry silently fails "Verification failed" no matter
// what was actually wrong the first time, with no way to recover short of
// a full page reload. `reset()` is how a consumer clears the widget's
// solved state and forces Cloudflare to issue a new token on next verify.
export type TurnstileWidgetHandle = {
  reset: () => void;
};

/**
 * Cloudflare Turnstile widget. Built for the magic-link request form
 * (Task 5b) but deliberately generic — siteKey/onVerify/onExpire are the
 * only knobs — so the contact form (Task 9) can drop it in unchanged.
 *
 * `ref` is optional (via forwardRef) and additive: the magic-link form
 * renders this without a ref at all, exactly as before, and is unaffected
 * by this change.
 */
const TurnstileWidget = forwardRef<TurnstileWidgetHandle, TurnstileWidgetProps>(
  function TurnstileWidget({ siteKey, onVerify, onExpire }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const widgetIdRef = useRef<string | null>(null);
    const [scriptLoaded, setScriptLoaded] = useState(false);

    useEffect(() => {
      if (!scriptLoaded || !containerRef.current || !window.turnstile || widgetIdRef.current) return;

      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        callback: onVerify,
        'expired-callback': onExpire,
      });
    }, [scriptLoaded, siteKey, onVerify, onExpire]);

    useImperativeHandle(ref, () => ({
      reset: () => {
        if (window.turnstile && widgetIdRef.current) {
          window.turnstile.reset(widgetIdRef.current);
        }
      },
    }), []);

    return (
      <>
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js"
          strategy="afterInteractive"
          onLoad={() => setScriptLoaded(true)}
        />
        <div ref={containerRef} />
      </>
    );
  },
);

export default TurnstileWidget;
