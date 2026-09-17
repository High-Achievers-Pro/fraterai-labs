import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { register } from '../instrumentation';

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.NODE_ENV = 'production';
  process.env.TURNSTILE_SECRET_KEY = 'secret';
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = 'site';
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
});

// Pins the post-C1 shape: the hard failure that used to live here moved to
// build time (scripts/check-deploy-env.ts, wired into `npm run build`), so
// a misconfigured deploy never ships in the first place. register() itself
// must NEVER throw — see instrumentation.ts's comment for why a boot-time
// throw here was worse than the outage it prevented (no vercel.json means
// `main` auto-deploys, so throwing would take the entire marketing site
// down over one missing key, not just the contact form). Its only
// remaining job is a loud, distinguishable runtime signal for the case a
// key is removed after a successful deploy with no new build to re-run the
// build-time check.
describe('register (Turnstile runtime guard)', () => {
  it('does not throw and logs nothing in production when both Turnstile keys are set', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(register()).resolves.toBeUndefined();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('does not throw, but logs loudly, when TURNSTILE_SECRET_KEY is missing in production', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    delete process.env.TURNSTILE_SECRET_KEY;

    await expect(register()).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('TURNSTILE_SECRET_KEY'));
  });

  it('does not throw, but logs loudly, when NEXT_PUBLIC_TURNSTILE_SITE_KEY is missing in production', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

    await expect(register()).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('NEXT_PUBLIC_TURNSTILE_SITE_KEY'));
  });

  it('logs one message per missing key when both are missing in production', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    delete process.env.TURNSTILE_SECRET_KEY;
    delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

    await expect(register()).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalledTimes(2);
  });

  it('does not throw or log outside production even with both keys unset — local dev and the test suite must keep working unchanged', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    process.env.NODE_ENV = 'development';
    delete process.env.TURNSTILE_SECRET_KEY;
    delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

    await expect(register()).resolves.toBeUndefined();
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
