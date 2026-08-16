import { createHmac } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { verifyWebhookSignature } from '../webhook-verify';

const SECRET = 'test-webhook-secret';

// Mirrors the ASSUMED-AND-UNVERIFIED scheme documented at the top of
// ../webhook-verify.ts: HMAC-SHA256 of "<unix-seconds-timestamp>.<raw body>",
// hex-encoded, no prefix. These tests exercise that self-consistent scheme
// end to end (constant-time compare, replay window, raw-body handling) —
// they cannot and do not prove the scheme matches what a real Twenty
// instance sends, because Step 1 (capturing a real payload) could not be
// performed. See task-10-report.md.
const sign = (timestampSeconds: string, rawBody: string, secret = SECRET): string =>
  createHmac('sha256', secret).update(`${timestampSeconds}.${rawBody}`).digest('hex');

const nowSeconds = () => Math.floor(Date.now() / 1000).toString();

beforeEach(() => {
  process.env.TWENTY_WEBHOOK_SECRET = SECRET;
});

describe('verifyWebhookSignature', () => {
  it('returns true for a valid signature and a fresh timestamp', () => {
    const body = JSON.stringify({ id: 'evt_1', eventName: 'person.created' });
    const timestamp = nowSeconds();
    const signature = sign(timestamp, body);

    expect(verifyWebhookSignature(body, signature, timestamp)).toBe(true);
  });

  it('returns false when the body is tampered with after signing', () => {
    const body = JSON.stringify({ id: 'evt_1', amount: 100 });
    const timestamp = nowSeconds();
    const signature = sign(timestamp, body);

    const tamperedBody = JSON.stringify({ id: 'evt_1', amount: 100000 });

    expect(verifyWebhookSignature(tamperedBody, signature, timestamp)).toBe(false);
  });

  it('returns false when the signature is missing', () => {
    const body = JSON.stringify({ id: 'evt_1' });
    expect(verifyWebhookSignature(body, undefined, nowSeconds())).toBe(false);
  });

  it('returns false when the timestamp is missing', () => {
    const body = JSON.stringify({ id: 'evt_1' });
    const signature = sign(nowSeconds(), body);
    expect(verifyWebhookSignature(body, signature, undefined)).toBe(false);
  });

  it('returns false when the timestamp is older than five minutes (replay protection)', () => {
    const body = JSON.stringify({ id: 'evt_1' });
    const staleTimestamp = (Math.floor(Date.now() / 1000) - 6 * 60).toString();
    const signature = sign(staleTimestamp, body);

    expect(verifyWebhookSignature(body, signature, staleTimestamp)).toBe(false);
  });

  it('accepts a timestamp just inside the five-minute window', () => {
    const body = JSON.stringify({ id: 'evt_1' });
    const recentTimestamp = (Math.floor(Date.now() / 1000) - 4 * 60 - 59).toString();
    const signature = sign(recentTimestamp, body);

    expect(verifyWebhookSignature(body, signature, recentTimestamp)).toBe(true);
  });

  it('returns false when the timestamp is more than five minutes in the future', () => {
    // Decision: a future-dated timestamp is rejected symmetrically with a
    // stale one. Nothing legitimate depends on Twenty ever sending a
    // forward-dated event, and accepting a wide forward gap would let a
    // captured signature be replayed by re-presenting it with a manipulated
    // future clock, or just widen the exploitable window for no benefit to
    // any real caller. Small clock skew between us and Twenty is expected
    // to fit well inside five minutes either direction.
    const body = JSON.stringify({ id: 'evt_1' });
    const futureTimestamp = (Math.floor(Date.now() / 1000) + 6 * 60).toString();
    const signature = sign(futureTimestamp, body);

    expect(verifyWebhookSignature(body, signature, futureTimestamp)).toBe(false);
  });

  it('accepts a timestamp just inside the future side of the window', () => {
    const body = JSON.stringify({ id: 'evt_1' });
    const nearFutureTimestamp = (Math.floor(Date.now() / 1000) + 4 * 60 + 59).toString();
    const signature = sign(nearFutureTimestamp, body);

    expect(verifyWebhookSignature(body, signature, nearFutureTimestamp)).toBe(true);
  });

  it('returns false when the timestamp is not a valid number', () => {
    const body = JSON.stringify({ id: 'evt_1' });
    const signature = sign(nowSeconds(), body);
    expect(verifyWebhookSignature(body, signature, 'not-a-number')).toBe(false);
  });

  it('returns false when TWENTY_WEBHOOK_SECRET is not set (fails closed)', () => {
    delete process.env.TWENTY_WEBHOOK_SECRET;
    const body = JSON.stringify({ id: 'evt_1' });
    const timestamp = nowSeconds();
    const signature = sign(timestamp, body);

    expect(verifyWebhookSignature(body, signature, timestamp)).toBe(false);
  });

  it('returns false when the signature was produced with a different secret', () => {
    const body = JSON.stringify({ id: 'evt_1' });
    const timestamp = nowSeconds();
    const signature = sign(timestamp, body, 'wrong-secret');

    expect(verifyWebhookSignature(body, signature, timestamp)).toBe(false);
  });

  it('compares in constant time: a signature differing only in its last byte fails the same as one differing entirely', () => {
    const body = JSON.stringify({ id: 'evt_1' });
    const timestamp = nowSeconds();
    const correct = sign(timestamp, body);

    // Differ only in the very last character — an early-exit / short-circuit
    // comparison and a full constant-time comparison both reject this, but
    // this is the case a short-circuit implementation is most likely to get
    // subtly wrong (e.g. an off-by-one on the loop bound), so it is worth
    // asserting explicitly rather than only ever testing a fully-different
    // signature. Mirrors the comparison technique in lib/server/session.ts.
    const lastCharFlipped =
      correct.slice(0, -1) + (correct.at(-1) === '0' ? '1' : '0');
    expect(verifyWebhookSignature(body, lastCharFlipped, timestamp)).toBe(false);

    // A signature the same length as correct, but different throughout.
    const whollyDifferent = correct
      .split('')
      .map((char) => (char === '0' ? '1' : '0'))
      .join('');
    expect(verifyWebhookSignature(body, whollyDifferent, timestamp)).toBe(false);
  });

  it('returns false for a signature of the wrong length', () => {
    const body = JSON.stringify({ id: 'evt_1' });
    const timestamp = nowSeconds();
    expect(verifyWebhookSignature(body, 'deadbeef', timestamp)).toBe(false);
  });
});
