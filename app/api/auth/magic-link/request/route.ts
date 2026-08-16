import { NextResponse, type NextRequest } from 'next/server';
import { sendMagicLinkEmail } from '@/lib/server/email';
import { createMagicToken, isAllowlisted } from '@/lib/server/magic-link';
import { findActiveWorkspaceMember } from '@/lib/server/membership';
import { verifyTurnstileToken } from '@/lib/server/turnstile';

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Both "allowlisted + active member" and "everyone else" (bad email shape,
// failed Turnstile, not allowlisted, not an active workspace member) return
// this exact same response. Any divergence in status, body, or which fields
// are present would turn this endpoint into an oracle an attacker could use
// to enumerate workspace membership. See task-5b-report.md for the one
// intentional exception (network-call timing) and why it was accepted.
const genericResponse = () =>
  NextResponse.json({ message: 'If that address has access, a link is on its way.' }, { status: 200 });

const readStringField = (body: unknown, key: string): string | undefined => {
  if (typeof body !== 'object' || body === null) return undefined;
  const value = (body as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : undefined;
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

  if (isAllowlisted(email)) {
    const member = await findActiveWorkspaceMember(email);
    if (member) {
      const token = await createMagicToken(email);
      const verifyUrl = new URL('/api/auth/magic-link/verify', request.url);
      verifyUrl.searchParams.set('token', token);
      // Best-effort: a delivery failure must not change the response shape
      // (still would leak membership), and there is nothing actionable the
      // caller could do with a delivery error anyway.
      await sendMagicLinkEmail(email, verifyUrl.toString()).catch(() => undefined);
    }
  }

  return genericResponse();
};
