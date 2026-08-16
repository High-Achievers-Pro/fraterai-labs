import 'server-only';
import { parseAllowlist } from './allowlist';
import { signPayload, verifyAndParse } from './signed-token';

export const MAGIC_LINK_TTL_SECONDS = 600;

export type MagicTokenPayload = {
  email: string;
  purpose: 'magic-link';
  expiresAt: number;
};

export const isAllowlisted = (email: string): boolean =>
  parseAllowlist().includes(email.toLowerCase());

export const createMagicToken = async (
  email: string,
  ttlSeconds: number = MAGIC_LINK_TTL_SECONDS,
): Promise<string> => {
  const payload: MagicTokenPayload = {
    email: email.trim().toLowerCase(),
    purpose: 'magic-link',
    expiresAt: Date.now() + ttlSeconds * 1000,
  };
  return signPayload(payload);
};

export const readMagicToken = async (token: string | undefined): Promise<MagicTokenPayload | null> => {
  const parsed = await verifyAndParse(token);
  if (typeof parsed !== 'object' || parsed === null) return null;

  const payload = parsed as MagicTokenPayload;
  // `purpose` separates this token type from session cookies, which are
  // signed with the same SESSION_SECRET. Without this check, a session
  // cookie would be redeemable as a magic-link token and vice versa. This
  // is the ONLY thing that separates the two token types post-signature-
  // check — verifyAndParse (signed-token.ts) is generic and does not know
  // about `purpose` at all.
  if (payload.purpose !== 'magic-link') return null;
  if (typeof payload.expiresAt !== 'number' || payload.expiresAt < Date.now()) return null;
  if (typeof payload.email !== 'string' || !payload.email) return null;
  // Re-checked at every read (not just at redemption in the route), so
  // removing an address from PORTAL_EMAIL_ALLOWLIST invalidates any token
  // already in flight, even one minted seconds earlier.
  if (!isAllowlisted(payload.email)) return null;
  return payload;
};
