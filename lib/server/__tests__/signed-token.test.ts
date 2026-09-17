import { beforeEach, describe, expect, it } from 'vitest';
import { signPayload, verifyAndParse } from '../signed-token';

beforeEach(() => { process.env.SESSION_SECRET = 'test-secret-value'; });

describe('signed-token', () => {
  it('round-trips an arbitrary JSON-serializable payload', async () => {
    const token = await signPayload({ a: 1, b: 'two' });
    expect(await verifyAndParse(token)).toEqual({ a: 1, b: 'two' });
  });

  it('rejects a tampered body', async () => {
    const token = await signPayload({ a: 1 });
    const [, signature] = token.split('.');
    const forgedBody = Buffer.from(JSON.stringify({ a: 999 })).toString('base64url');
    expect(await verifyAndParse(`${forgedBody}.${signature}`)).toBeNull();
  });

  it('rejects a tampered signature', async () => {
    const token = await signPayload({ a: 1 });
    const [body] = token.split('.');
    expect(await verifyAndParse(`${body}.deadbeef`)).toBeNull();
  });

  it('rejects a token signed with a different secret', async () => {
    const token = await signPayload({ a: 1 });
    process.env.SESSION_SECRET = 'rotated-secret';
    expect(await verifyAndParse(token)).toBeNull();
  });

  it('rejects malformed input', async () => {
    expect(await verifyAndParse(undefined)).toBeNull();
    expect(await verifyAndParse('')).toBeNull();
    expect(await verifyAndParse('nodot')).toBeNull();
    expect(await verifyAndParse('a.b.c')).toBeNull();
  });

  // This module deliberately does NOT know about `purpose`, `expiresAt`,
  // or any other payload-shape concept — those belong to each caller
  // (session.ts, magic-link.ts). Pinning that it returns whatever was
  // signed, unopinionated, rather than silently enforcing a shape.
  it('does not itself enforce any payload shape (that is each caller\'s job)', async () => {
    const token = await signPayload('just a string, not an object');
    expect(await verifyAndParse(token)).toBe('just a string, not an object');
  });
});
