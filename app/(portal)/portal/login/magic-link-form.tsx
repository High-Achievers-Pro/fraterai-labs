'use client';

import { useEffect, useState } from 'react';
import posthog from 'posthog-js';
import TurnstileWidget from '@/components/TurnstileWidget';

// Matches the request endpoint's response exactly — see
// app/api/auth/magic-link/request/route.ts's genericResponse(). Whether the
// address is allowlisted, a workspace member, or neither, the UI must show
// this same line so the endpoint's non-disclosure isn't undone by the client.
const SENT_MESSAGE = 'If that address has access, a link is on its way.';

type Status = 'idle' | 'submitting' | 'sent' | 'needs-verification';

type PortalIdentityProps = {
  workspaceMemberId: string;
  email: string;
  name: string;
};

export function PortalIdentity({ workspaceMemberId, email, name }: PortalIdentityProps) {
  useEffect(() => {
    posthog.identify(workspaceMemberId, { email, name });
  }, [workspaceMemberId, email, name]);

  return null;
}

export function SignOutButton() {
  const handleClick = () => {
    posthog.capture('portal_signed_out');
    posthog.reset();
  };

  return (
    <button type="submit" className="btn btn-ghost btn-sm" onClick={handleClick}>
      Sign out
    </button>
  );
}

export default function MagicLinkForm() {
  const [email, setEmail] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [status, setStatus] = useState<Status>('idle');

  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!turnstileToken) {
      setStatus('needs-verification');
      return;
    }

    setStatus('submitting');
    posthog.capture('magic_link_requested');
    try {
      await fetch('/api/auth/magic-link/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, turnstileToken }),
      });
    } catch {
      // The request/response body never varies by outcome, and neither
      // does this UI — a network error still resolves to the same message
      // rather than a distinguishable error state.
    }
    setStatus('sent');
  };

  if (status === 'sent') {
    return (
      <p role="status" style={{ marginTop: '2rem' }}>
        {SENT_MESSAGE}
      </p>
    );
  }

  if (!siteKey) return null;

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: '2rem', textAlign: 'left' }}>
      <div className="form-group">
        <label htmlFor="magic-link-email">Or email me a sign-in link</label>
        <input
          id="magic-link-email"
          name="email"
          type="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>

      <div style={{ margin: '1rem 0' }}>
        <TurnstileWidget siteKey={siteKey} onVerify={setTurnstileToken} onExpire={() => setTurnstileToken('')} />
      </div>

      {status === 'needs-verification' && (
        <p role="alert" style={{ color: '#b91c1c', marginBottom: '1rem' }}>
          Please complete the verification challenge first.
        </p>
      )}

      <button type="submit" className="btn btn-ghost" disabled={status === 'submitting'}>
        {status === 'submitting' ? 'Sending…' : 'Send me a sign-in link'}
      </button>
    </form>
  );
}
