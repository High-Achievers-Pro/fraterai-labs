import 'server-only';
import { signPayload, verifyAndParse } from './signed-token';

// __Host- prefix: the browser enforces (not just documents) that a cookie
// with this prefix must be Secure, must have Path=/, and must NOT set a
// Domain attribute — all three already hold at both set sites
// (app/api/auth/google/callback/route.ts, app/api/auth/magic-link/verify/
// route.ts). Without it, a sibling subdomain of fraterailabs.com could set
// its own Domain=fraterailabs.com cookie of the same name, which the
// browser would then send here too (session fixation). Renamed while
// nothing is deployed yet — free now, would log out every live session
// after launch. See final-review.md I4.
export const SESSION_COOKIE_NAME = '__Host-frater_portal_session';

export type SessionPayload = {
  email: string;
  name: string;
  workspaceMemberId: string;
  purpose: 'session';
  expiresAt: number;
};

export const createSessionCookie = async (
  payload: Omit<SessionPayload, 'expiresAt' | 'purpose'>,
  ttlSeconds: number,
): Promise<string> => {
  const full: SessionPayload = {
    ...payload,
    purpose: 'session',
    expiresAt: Date.now() + ttlSeconds * 1000,
  };
  return signPayload(full);
};

export const readSessionCookie = async (cookie: string | undefined): Promise<SessionPayload | null> => {
  const parsed = await verifyAndParse(cookie);
  if (typeof parsed !== 'object' || parsed === null) return null;

  const payload = parsed as SessionPayload;
  // `purpose` separates this token type from magic-link tokens, which are
  // signed with the same SESSION_SECRET. Without this check, a magic-link
  // token would be redeemable as a session cookie and vice versa. This is
  // the ONLY thing that separates the two token types post-signature-check
  // — verifyAndParse (signed-token.ts) is generic and does not know about
  // `purpose` at all.
  if (payload.purpose !== 'session') return null;
  if (typeof payload.expiresAt !== 'number' || payload.expiresAt < Date.now()) return null;
  if (typeof payload.email !== 'string' || !payload.email) return null;
  return payload;
};
