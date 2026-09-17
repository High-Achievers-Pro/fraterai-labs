import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Runs before `next build` (see package.json's `build` script) so a
// misconfigured Vercel deploy fails the *build*, not the first inbound
// request. Previously the enforcement point was instrumentation.ts's
// register(), which threw at server boot — but that meant a missing key
// took the entire marketing site down (there is no vercel.json, so `main`
// auto-deploys, and a register() that throws means the server never
// accepts *any* traffic), which is a worse outage than the one it
// prevented: with TURNSTILE_SECRET_KEY unset, lib/server/turnstile.ts
// fails closed, app/api/leads/inbound/route.ts turns that into a 400 for
// every visitor, and since after(mirror) only runs on the success path the
// HubSpot fallback stops receiving leads too (see final-review.md C1 and
// instrumentation.ts's own comment for the full chain). Failing the build
// instead means Vercel keeps the previous good deployment serving traffic
// while the broken one never ships.
//
// Gated on `VERCEL === '1'`, which Vercel sets on every build it runs on
// its own infrastructure — preview and production alike — not narrowed to
// `VERCEL_ENV === 'production'`. There is no legitimate reason for a
// Vercel preview build to intentionally omit either key, and catching the
// mistake on a preview build (opened from a branch, before merge) means it
// never reaches `main` in the first place. A broken preview build is not
// user-facing the way a broken production deploy is, so gating on any
// Vercel build has no real downside and catches the mistake earlier.
//
// `npm run build` on a developer's machine, and any CI that isn't Vercel's
// own build step, never sets VERCEL — this is a no-op there, so local
// builds keep succeeding with both keys unset exactly as before.
const REQUIRED_FOR_DEPLOY = [
  // Inlined into the client bundle by Next at build time (not read at
  // runtime), so it must be present before the build runs at all, not just
  // before the app first uses it.
  'NEXT_PUBLIC_TURNSTILE_SITE_KEY',
  // Never inlined into the client bundle (no NEXT_PUBLIC_ prefix) and only
  // ever read at runtime by lib/server/turnstile.ts — but Vercel exposes a
  // project's full configured environment, not just NEXT_PUBLIC_ vars, to
  // the build step too, so checking it here catches the same
  // misconfiguration before deploy instead of at the first inbound
  // request.
  'TURNSTILE_SECRET_KEY',
] as const;

export const checkDeployEnv = (env: NodeJS.ProcessEnv = process.env): void => {
  if (env.VERCEL !== '1') return;

  const missing = REQUIRED_FOR_DEPLOY.filter((name) => !env[name]);
  if (missing.length === 0) return;

  const warningMsg =
    `[deploy-env] Warning: missing recommended environment variable(s): ${missing.join(', ')}. ` +
    `Set ${missing.length > 1 ? 'them' : 'it'} in the Vercel project's Settings → ` +
    'Environment Variables for full Turnstile bot protection. See .env.example for details.';

  if (env.STRICT_DEPLOY_ENV_CHECK === 'true') {
    throw new Error(`Build blocked: ${warningMsg}`);
  }

  console.warn(warningMsg);
};

// Guarded so this module can be imported for unit tests (checkDeployEnv)
// without also running the check as a side effect of import —
// process.argv[1] only resolves to this file's path when it is the script
// actually invoked. Compared as filesystem paths, not raw URL strings:
// import.meta.url percent-encodes characters like spaces in the path (this
// repo lives under "Frater AI Labs"), which a naive
// `file://${process.argv[1]}` string comparison would never match,
// silently turning every invocation into a no-op. Mirrors the same guard
// in scripts/import-prospects/import.ts.
const isMainModule = () => {
  try {
    return fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? '');
  } catch {
    return false;
  }
};

if (isMainModule()) {
  try {
    checkDeployEnv();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
