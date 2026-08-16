import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkDeployEnv } from '../check-deploy-env';

const ROOT = join(__dirname, '..', '..');

// Pins the build-time half of the Turnstile guard (the runtime half lives
// in instrumentation.ts and its test). See check-deploy-env.ts's own
// comment for the full reasoning: this must fail an actual Vercel build —
// preview or production — when either key is missing, and must never
// touch a developer's local `npm run build` or non-Vercel CI.
describe('checkDeployEnv (build-time Turnstile guard)', () => {
  it('does nothing outside a Vercel build (VERCEL unset), even with both keys unset — local `npm run build` must keep working', () => {
    expect(() => checkDeployEnv({})).not.toThrow();
  });

  it('does nothing on a Vercel build when both keys are set', () => {
    expect(() =>
      checkDeployEnv({
        VERCEL: '1',
        NEXT_PUBLIC_TURNSTILE_SITE_KEY: 'site',
        TURNSTILE_SECRET_KEY: 'secret',
      }),
    ).not.toThrow();
  });

  it('throws on a Vercel build when NEXT_PUBLIC_TURNSTILE_SITE_KEY is missing', () => {
    expect(() =>
      checkDeployEnv({ VERCEL: '1', TURNSTILE_SECRET_KEY: 'secret' }),
    ).toThrow(/NEXT_PUBLIC_TURNSTILE_SITE_KEY/);
  });

  it('throws on a Vercel build when TURNSTILE_SECRET_KEY is missing', () => {
    expect(() =>
      checkDeployEnv({ VERCEL: '1', NEXT_PUBLIC_TURNSTILE_SITE_KEY: 'site' }),
    ).toThrow(/TURNSTILE_SECRET_KEY/);
  });

  it('throws on a Vercel build when both keys are missing, naming both in one message', () => {
    expect(() => checkDeployEnv({ VERCEL: '1' })).toThrow(
      /NEXT_PUBLIC_TURNSTILE_SITE_KEY.*TURNSTILE_SECRET_KEY/,
    );
  });

  it('applies on Vercel preview builds too, not just production — gated on VERCEL, not VERCEL_ENV', () => {
    expect(() =>
      checkDeployEnv({ VERCEL: '1', VERCEL_ENV: 'preview' }),
    ).toThrow(/NEXT_PUBLIC_TURNSTILE_SITE_KEY/);
  });

  // Guards against the exact gap the prior review flagged in
  // instrumentation.test.ts: a unit test that only imports and calls the
  // check function stays green even if the check were quietly dropped from
  // the actual build pipeline. This asserts the real wiring: package.json's
  // `build` script must invoke this script, and must do so *before*
  // `next build` runs, or a broken build would ship anyway.
  it('is wired into the `build` npm script ahead of `next build`', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    const buildScript = pkg.scripts.build;

    const checkIndex = buildScript.indexOf('check-deploy-env');
    const nextBuildIndex = buildScript.indexOf('next build');

    expect(checkIndex).toBeGreaterThan(-1);
    expect(nextBuildIndex).toBeGreaterThan(-1);
    expect(checkIndex).toBeLessThan(nextBuildIndex);
  });
});
