import 'server-only';
import { optionalEnv, requireEnv } from './env';

export const MAGIC_LINK_TTL_SECONDS = 600;

export type MagicTokenPayload = {
  email: string;
  purpose: 'magic-link';
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

// Mirrors auth-gate.ts's parseAllowlist() semantics exactly (comma-split,
// trim, lowercase, drop blanks) so the two allowlist checks in the app never
// drift apart. auth-gate.ts doesn't export its parser, so this is a small
// duplication rather than a shared import — the alternative (importing
// auth-gate.ts here) would pull in ALLOWED_GOOGLE_DOMAIN and GoogleIdentity
// concerns that don't apply to magic links.
export const isAllowlisted = (email: string): boolean =>
  (optionalEnv('PORTAL_EMAIL_ALLOWLIST') ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.toLowerCase());

export const createMagicToken = async (
  email: string,
  ttlSeconds: number = MAGIC_LINK_TTL_SECONDS,
): Promise<string> => {
  const payload: MagicTokenPayload = {
    email: email.trim().toLowerCase(),
    purpose: 'magic-link',
    expiresAt: Date.now() + ttlSeconds * 1000,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${await sign(body)}`;
};

export const readMagicToken = async (token: string | undefined): Promise<MagicTokenPayload | null> => {
  if (!token) return null;

  const parts = token.split('.');
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
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as MagicTokenPayload;
    // `purpose` separates this token type from session cookies, which are
    // signed with the same SESSION_SECRET. Without this check, a session
    // cookie would be redeemable as a magic-link token and vice versa.
    if (payload.purpose !== 'magic-link') return null;
    if (typeof payload.expiresAt !== 'number' || payload.expiresAt < Date.now()) return null;
    if (typeof payload.email !== 'string' || !payload.email) return null;
    // Re-checked at every read (not just at redemption in the route), so
    // removing an address from PORTAL_EMAIL_ALLOWLIST invalidates any token
    // already in flight, even one minted seconds earlier.
    if (!isAllowlisted(payload.email)) return null;
    return payload;
  } catch {
    return null;
  }
};
