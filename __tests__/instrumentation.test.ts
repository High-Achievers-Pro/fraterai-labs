import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { register } from '../instrumentation';

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.NODE_ENV = 'production';
  process.env.TURNSTILE_SECRET_KEY = 'secret';
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = 'site';
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

// Pins C1: a misconfigured production deploy must fail loudly at boot
// rather than silently rejecting every inbound lead and magic-link
// request. See final-review.md C1 and instrumentation.ts's own comment for
// why this lives here and why it's scoped to NODE_ENV === 'production'.
describe('register (Turnstile boot guard)', () => {
  it('does not throw in production when both Turnstile keys are set', async () => {
    await expect(register()).resolves.toBeUndefined();
  });

  it('throws in production when TURNSTILE_SECRET_KEY is missing', async () => {
    delete process.env.TURNSTILE_SECRET_KEY;
    await expect(register()).rejects.toThrow(/TURNSTILE_SECRET_KEY/);
  });

  it('throws in production when NEXT_PUBLIC_TURNSTILE_SITE_KEY is missing', async () => {
    delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    await expect(register()).rejects.toThrow(/NEXT_PUBLIC_TURNSTILE_SITE_KEY/);
  });

  it('does not throw outside production even with both keys unset — local dev and the test suite must keep working unchanged', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.TURNSTILE_SECRET_KEY;
    delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    await expect(register()).resolves.toBeUndefined();
  });
});
