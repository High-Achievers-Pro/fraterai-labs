import 'server-only';
import { createHmac } from 'node:crypto';
import { constantTimeEqual } from './constant-time';
import { optionalEnv } from './env';

// ============================================================================
// ASSUMED AND UNVERIFIED — Twenty's webhook signature scheme
// ============================================================================
//
// Task 10's brief (Step 1) called for creating a test webhook in a live
// Twenty instance, pointing it at a request-capture endpoint, and
// implementing against the headers actually observed. That could not be
// done: Twenty's API keys are mid-rotation after a credential leak, no live
// instance was available, and nothing in this repo documents the scheme —
// see task-10-report.md for the exact search performed (a grep of every
// file under `twenty-app/node_modules/` for signature/HMAC/webhook-header
// patterns, and a read of `docs/runbooks/twenty-railway.md`, both empty).
//
// Every value below is therefore a *guess*, chosen because it matches a
// common webhook-signing convention (this exact "<seconds>.<raw body>"
// HMAC-SHA256-hex construction is Slack's; Stripe's is nearly identical),
// not because it has been confirmed against Twenty. Getting any of these
// wrong makes every signature fail to match, which fails CLOSED — every
// real webhook gets a 401 instead of being silently trusted. Safe, but it
// means this receiver will reject every genuine delivery from Twenty until
// these are confirmed and corrected against real traffic.
//
// TO CONFIRM, once credentials are available: create a test webhook in
// Twenty (Settings → Webhooks) pointed at a request-capture endpoint (e.g.
// https://webhook.site), trigger an event, and compare the actual request
// against the values below. Update this block — and only this block, per
// the design decision recorded in task-10-report.md — to match. Also
// record the observed headers and payload format in
// docs/runbooks/portal-env.md, per the original Step 1 instruction.
//
// Header names Twenty is assumed to send:
export const SIGNATURE_HEADER = 'x-twenty-signature';
export const TIMESTAMP_HEADER = 'x-twenty-timestamp';
// Hash algorithm assumed for the HMAC. Real webhook providers vary here —
// SHA-1 and SHA-512 both see real use alongside SHA-256 — so this is a
// guess like everything else in this block, not a safe default.
const HMAC_ALGORITHM = 'sha256';
// Digest encoding of the signature header's value: assumed hex, not base64.
const DIGEST_ENCODING = 'hex' as const;
// Assumed there is no "sha256=" (or similar) prefix on the signature value
// — it is presumed to be the bare digest. If Twenty does prefix it, that
// prefix must be stripped before the comparison below.
//
// Assumed signed-bytes format: "<timestamp>.<raw body>", where <timestamp>
// is the exact string from the timestamp header (not re-formatted) and
// <raw body> is the exact request body bytes, decoded as UTF-8 text.
const buildSignedPayload = (timestamp: string, rawBody: string): string => `${timestamp}.${rawBody}`;
// Assumed the timestamp header carries Unix time in *seconds* (not
// milliseconds, not ISO 8601).
const parseTimestampSeconds = (timestamp: string): number | null => {
  const seconds = Number(timestamp);
  return Number.isFinite(seconds) ? seconds : null;
};
// ============================================================================
// End of assumed scheme. Everything below is independent of these choices
// and does not need to change when they are corrected.
// ============================================================================

// Replay window: a timestamp more than five minutes old is rejected, per
// the brief. A timestamp more than five minutes in the *future* is
// rejected too — see the corresponding test in webhook-verify.test.ts for
// the reasoning (nothing legitimate depends on a forward-dated event, and
// accepting one only widens the window a captured signature could be
// replayed in).
const REPLAY_WINDOW_MS = 5 * 60 * 1000;

// constantTimeEqual itself now lives in constant-time.ts, shared with the
// session/magic-link token signatures (see final-review.md I5). This
// module signs different bytes (a "<timestamp>.<raw body>" string) with a
// different secret (TWENTY_WEBHOOK_SECRET, not SESSION_SECRET) and a
// different digest encoding (hex, via node:crypto, not base64url via
// crypto.subtle) — nothing about the *signing* is shared with signed-
// token.ts, only the constant-time comparison at the end is common ground.

/**
 * Verifies a Twenty webhook signature against `TWENTY_WEBHOOK_SECRET`.
 *
 * `rawBody` must be the exact request body text, read before any JSON
 * parsing — parsing and re-serialising changes the bytes and breaks the
 * signature. Fails closed: a missing signature, a missing timestamp, a
 * missing secret, an unparseable timestamp, a timestamp outside the
 * five-minute replay window, or a mismatched signature all resolve to
 * `false`. Never throws.
 */
export const verifyWebhookSignature = (
  rawBody: string,
  signature: string | undefined,
  timestamp: string | undefined,
): boolean => {
  if (!signature || !timestamp) return false;

  const secret = optionalEnv('TWENTY_WEBHOOK_SECRET');
  if (!secret) return false;

  const timestampSeconds = parseTimestampSeconds(timestamp);
  if (timestampSeconds === null) return false;

  const ageMs = Date.now() - timestampSeconds * 1000;
  if (Math.abs(ageMs) > REPLAY_WINDOW_MS) return false;

  const expected = createHmac(HMAC_ALGORITHM, secret)
    .update(buildSignedPayload(timestamp, rawBody))
    .digest(DIGEST_ENCODING);

  return constantTimeEqual(expected, signature);
};
