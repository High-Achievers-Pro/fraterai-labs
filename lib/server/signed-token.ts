import 'server-only';
import { constantTimeEqual } from './constant-time';
import { requireEnv } from './env';

// Shared HMAC sign / verify-and-parse primitives, extracted from what were
// two verbatim copies (session.ts's session cookie, magic-link.ts's
// magic-link token) guarding two different doors with the same
// SESSION_SECRET. See final-review.md I5: the risk was a hardening applied
// to one copy and forgotten in the other, silently weakening whichever door
// didn't get the fix.
//
// Deliberately narrow: this module only proves "the bytes are exactly what
// was signed with SESSION_SECRET, and the JSON parses." It does NOT check
// `purpose`, `expiresAt`, `email`, or any other field — those differ by
// payload shape and are each caller's responsibility, layered on top of
// `verifyAndParse`'s result. A caller that skips its own `purpose` check
// would accept the other token type; that check lives in session.ts and
// magic-link.ts, not here, on purpose.
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

// Signs an arbitrary JSON-serializable payload and returns
// "<base64url body>.<base64url signature>".
export const signPayload = async (payload: unknown): Promise<string> => {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${await sign(body)}`;
};

// Verifies the signature on `token` and returns the parsed JSON payload —
// or `null` if the token is missing, malformed, signed with a different
// secret, or not valid JSON once decoded. Never throws.
export const verifyAndParse = async (token: string | undefined): Promise<unknown | null> => {
  if (!token) return null;

  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [body, signature] = parts;

  const expected = await sign(body);
  if (expected.length !== signature.length) return null;
  if (!constantTimeEqual(expected, signature)) return null;

  try {
    return JSON.parse(Buffer.from(body, 'base64url').toString());
  } catch {
    return null;
  }
};
