import { after, NextResponse, type NextRequest } from 'next/server';
import { requireEnv } from '@/lib/server/env';
import { sendMagicLinkEmail } from '@/lib/server/email';
import { createMagicToken, isAllowlisted } from '@/lib/server/magic-link';
import { findActiveWorkspaceMember } from '@/lib/server/membership';
import { verifyTurnstileToken } from '@/lib/server/turnstile';

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Both "allowlisted + active member" and "everyone else" (bad email shape,
// failed Turnstile, not allowlisted, not an active workspace member) return
// this exact same response. Any divergence in status, body, or which fields
// are present would turn this endpoint into an oracle an attacker could use
// to enumerate workspace membership. See task-5b-report.md for how the
// timing side of this is handled (after(), below).
const genericResponse = () =>
  NextResponse.json({ message: 'If that address has access, a link is on its way.' }, { status: 200 });

const readStringField = (body: unknown, key: string): string | undefined => {
  if (typeof body !== 'object' || body === null) return undefined;
  const value = (body as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : undefined;
};

// The network-bound part of this endpoint: a Twenty GraphQL lookup and a
// full SMTP handshake, both only paid by "allowlisted + active member"
// requests. Split out from POST so after() (below) can schedule it to run
// once the response has already been sent, and so it's testable on its own.
//
// Errors are caught and logged, never rethrown: this runs after the
// response, so nothing can react to a thrown error, and an uncaught
// rejection here must not become an unhandled-rejection crash. Logging
// (rather than swallowing silently) is what fix Important-3 is about — a
// total SMTP outage must be visible to whoever watches the logs, even
// though the requester's response is deliberately uninformative.
export const deliverMagicLinkIfEligible = async (email: string): Promise<void> => {
  try {
    if (!isAllowlisted(email)) return;

    const member = await findActiveWorkspaceMember(email);
    if (!member) return;

    const token = await createMagicToken(email);
    // SERVER_URL, not request.url: Route Handlers get no origin allowlist
    // (unlike Server Actions' serverActions.allowedOrigins), and a client
    // can set X-Forwarded-Host so request.url resolves to a host of their
    // choosing. This link goes out in an email to a third party — not a
    // redirect back to the browser that supplied the header — so a
    // poisoned origin here would mean a genuine email, from the genuine
    // sender, containing a valid token pointed at an attacker's server.
    // requireEnv (not optionalEnv): a misconfigured origin must throw
    // (and get logged, below) rather than silently emit a wrong link.
    const verifyUrl = new URL('/api/auth/magic-link/verify', requireEnv('SERVER_URL'));
    verifyUrl.searchParams.set('token', token);

    await sendMagicLinkEmail(email, verifyUrl.toString());
  } catch (error) {
    console.error('[magic-link] failed to deliver sign-in email', { email, error });
  }
};

export const POST = async (request: NextRequest) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return genericResponse();
  }

  // request.json() has no compile-time guarantee about shape — it's parsed
  // from an untrusted request body — so each field is checked to actually be
  // a string before use rather than trusted from a destructure.
  const turnstileToken = readStringField(body, 'turnstileToken');
  const emailInput = readStringField(body, 'email');

  // Verify Turnstile before any work that costs something: before the email
  // shape check, before the membership lookup, before minting a token, and
  // certainly before sending mail.
  const remoteIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const turnstileOk = await verifyTurnstileToken(turnstileToken, remoteIp);
  if (!turnstileOk) return genericResponse();

  if (!emailInput || !EMAIL_SHAPE.test(emailInput)) return genericResponse();

  const email = emailInput.trim().toLowerCase();

  // The membership lookup and the email send are network calls whose
  // latency differs sharply between "allowlisted active member" (a Twenty
  // GraphQL round trip plus a full SMTP handshake) and everyone else
  // (returns almost immediately). Awaiting them inline — as an earlier
  // version of this route did — would leak that difference through
  // response *timing* even though the response *body* never varies,
  // turning the endpoint into a membership oracle by a different route.
  // after() defers this work until after the response has already been
  // sent, so every request that reaches this point returns the identical
  // response at the identical point, before any of that work starts.
  after(() => deliverMagicLinkIfEligible(email));

  return genericResponse();
};
