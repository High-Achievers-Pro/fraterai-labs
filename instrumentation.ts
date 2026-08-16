import 'server-only';
import { requireEnv } from './lib/server/env';

// Next.js calls `register()` once when a new server instance is initiated,
// and it must complete before the server accepts any request
// (node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/
// instrumentation.md). That makes this the earliest hook available in this
// app to fail a misconfigured deploy loudly — the alternative, doing
// nothing here, is what final-review.md's C1 describes: with
// TURNSTILE_SECRET_KEY unset, lib/server/turnstile.ts fails closed to
// `false` on every request, app/api/leads/inbound/route.ts turns that into
// a 400 for every visitor, and because after(mirror) only runs on the
// success path, the HubSpot fallback stops receiving leads too — a
// business-facing outage with no distinguishing signal beyond a stream of
// 400s. Throwing here instead means the server never starts serving
// traffic in that state.
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

  requireEnv('TURNSTILE_SECRET_KEY');
  requireEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY');
};
