import 'server-only';
import { requireEnv } from './env';

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

const encoder = new TextEncoder();

const importKey = async () =>
  crypto.subtle.importKey(
    'raw', encoder.encode(requireEnv('SESSION_SECRET')),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'],
  );

const toBase64Url = (bytes: ArrayBuffer | Uint8Array): string =>
  Buffer.from(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)).toString('base64url');

const sign = async (body: string): Promise<string> =>
  toBase64Url(await crypto.subtle.sign('HMAC', await importKey(), encoder.encode(body)));

export const createSessionCookie = async (
  payload: Omit<SessionPayload, 'expiresAt' | 'purpose'>,
  ttlSeconds: number,
): Promise<string> => {
  const full: SessionPayload = {
    ...payload,
    purpose: 'session',
    expiresAt: Date.now() + ttlSeconds * 1000,
  };
  const body = Buffer.from(JSON.stringify(full)).toString('base64url');
  return `${body}.${await sign(body)}`;
};

export const readSessionCookie = async (cookie: string | undefined): Promise<SessionPayload | null> => {
  if (!cookie) return null;

  const parts = cookie.split('.');
  if (parts.length !== 2) return null;

  const [body, signature] = parts;

  const expected = await sign(body);
  if (expected.length !== signature.length) return null;

  // Constant-time comparison — a length-only or early-exit check leaks the signature.
  let mismatch = 0;
  for (let i = 0; i < expected.length; i += 1) {
    mismatch |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  if (mismatch !== 0) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as SessionPayload;
    // `purpose` separates this token type from magic-link tokens, which are
    // signed with the same SESSION_SECRET. Without this check, a magic-link
    // token would be redeemable as a session cookie and vice versa.
    if (payload.purpose !== 'session') return null;
    if (typeof payload.expiresAt !== 'number' || payload.expiresAt < Date.now()) return null;
    if (typeof payload.email !== 'string' || !payload.email) return null;
    return payload;
  } catch {
    return null;
  }
};
