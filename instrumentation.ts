import 'server-only';
import { optionalEnv } from './lib/server/env';

// Next.js calls `register()` once when a new server instance is initiated,
// and it must complete before the server accepts any request
// (node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/
// instrumentation.md). This used to be where a misconfigured deploy was
// caught, by throwing — see git history and final-review.md C1 for why
// that guard existed. That enforcement now lives at build time instead, in
// scripts/check-deploy-env.ts (wired into `npm run build` ahead of
// `next build`): there is no vercel.json in this repo, so `main`
// auto-deploys straight to production, and a register() that throws means
// the server never accepts *any* traffic while a key is missing — turning
// one missing Turnstile key into an outage of the entire marketing site,
// which is worse than the contact-form-only outage it was meant to
// prevent. Failing at build time instead means Vercel's build fails and
// the previous good deployment keeps serving; the broken one never ships.
//
// This function's remaining job is narrower and must never throw: if a key
// is missing anyway — e.g. removed from the Vercel project's environment
// variables *after* a successful deploy, with no new build triggered to
// re-run the build-time check — log loudly so there is a distinguishing
// signal in the runtime logs. Without this, that scenario degrades exactly
// as final-review.md C1 describes: lib/server/turnstile.ts
// (verifyTurnstileToken) fails closed, app/api/leads/inbound/route.ts
// turns that into a 400 for every visitor, and because after(mirror) only
// runs on the success path, the HubSpot fallback stops receiving leads
// too — with nothing but a stream of 400s to distinguish it from a
// genuinely failed challenge.
//
// Scoped to `NODE_ENV === 'production'` (both `next start` and a real
// deploy set this), not to every invocation of `register()`: `next dev` and
// the test suite both run today with Turnstile keys unset by design (see
// .env.example's own note that only a local dev choosing to exercise the
// widget needs to set Cloudflare's test keys), and that must keep working
// unchanged. `next dev` runs with NODE_ENV=development, and vitest never
// invokes this file at all (there is no Next server bootstrap under
// vitest), so neither is affected by this guard.
export const register = async (): Promise<void> => {
  if (process.env.NODE_ENV !== 'production') return;

  if (!optionalEnv('TURNSTILE_SECRET_KEY')) {
    console.error(
      '[instrumentation] TURNSTILE_SECRET_KEY is not set. The contact form will fail closed ' +
        '(lib/server/turnstile.ts) and the HubSpot mirror fallback will not run for those ' +
        'requests (after(mirror) only runs on the success path). This should have been caught ' +
        'at build time by scripts/check-deploy-env.ts — set it in the Vercel project’s ' +
        'Environment Variables and redeploy.',
    );
  }

  if (!optionalEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY')) {
    console.error(
      '[instrumentation] NEXT_PUBLIC_TURNSTILE_SITE_KEY is not set. The Turnstile widget will ' +
        'not render correctly for visitors. This should have been caught at build time by ' +
        'scripts/check-deploy-env.ts — set it in the Vercel project’s Environment Variables ' +
        'and redeploy.',
    );
  }
};
