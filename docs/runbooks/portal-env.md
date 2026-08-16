# Portal env plumbing and Next.js 16 ground truth

This repo runs **Next.js 16.2.1** (see `package.json`). `AGENTS.md` at the repo
root warns that this release differs from training data. This runbook records
what was verified directly against the docs shipped in
`node_modules/next/dist/docs/` (authoritative — not the public nextjs.org docs,
which may drift from the exact installed version), so later tasks in Plan B
can build on confirmed facts instead of re-deriving them.

App Router source lives at repo-root `app/` (not `src/app/`). `src/` is a
separate, unrelated tree (`assets`, `js`, `styles` — legacy static-site
assets). Any root-level file convention (`proxy.ts`, `middleware.ts`) belongs
at the repo root, next to `app/`.

## Q1: Is `middleware.ts` still the filename and is `config.matcher` still the matcher API?

**No — deviation from the plan.** In Next.js 16, the `middleware` file
convention is **deprecated** and renamed to `proxy`. Source:
`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`
(lines 1–11, "Migration to Proxy" section, and the Version History table at
the bottom: `v16.0.0 | Middleware is deprecated and renamed to Proxy`). Also
confirmed in the upgrade guide:
`node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md`,
section "`middleware` to `proxy`" (~line 615).

What changed:
- File must be named `proxy.ts` (or `proxy.js`) at the project root (same
  level as `app/` here), not `middleware.ts`.
- The exported function must be named `proxy` (or be a default export), not
  `middleware`:
  ```ts
  import { NextResponse } from 'next/server';
  import type { NextRequest } from 'next/server';

  export function proxy(request: NextRequest) {
    return NextResponse.next();
  }

  export const config = {
    matcher: '/portal/:path*',
  };
  ```
- The `edge` runtime is **not** supported in `proxy` — it always runs on the
  `nodejs` runtime, and the runtime cannot be configured. (Not a concern here;
  we need Node APIs for session verification anyway.)
- **The `config.matcher` API itself is unchanged** — same string / array /
  object-with-`source`/`locale`/`has`/`missing` shape as classic middleware.
  Source: same `proxy.md`, "Matcher" section (lines 71–134).
- Next.js ships a codemod (`npx @next/codemod@canary middleware-to-proxy .`)
  but since this plan is writing the file from scratch, later tasks (Task 6:
  "Middleware, portal pages, discoverability") should just write `proxy.ts`
  directly and never write `middleware.ts`.

**Action for later tasks:** wherever this plan's task briefs say
`middleware.ts` / `export function middleware`, substitute `proxy.ts` /
`export function proxy`. The matcher config itself needs no changes.

## Q2: Are `cookies()` and `headers()` async in this version?

**Yes, both are async — confirmed, no deviation from the plan's assumption.**

- `cookies()`: `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cookies.md`,
  line 6 ("`cookies` is an **async** function...") and line 67 ("`cookies` is
  an **asynchronous** function that returns a promise. You must use
  `async/await`..."). Synchronous access was removed as of 16.0 per the
  upgrade guide's "Async Request APIs (Breaking change)" section
  (`version-16.md`, ~line 294–306) — it was already deprecated-but-working in
  v15, and is now fully removed in v16.
- `headers()`: `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/headers.md`,
  line 6 ("`headers` is an **async** function...").
- Both are imported from `next/headers`:
  ```ts
  import { cookies, headers } from 'next/headers';
  const cookieStore = await cookies();
  const headersList = await headers();
  ```
- Same applies to `params`/`searchParams` in pages, layouts, and route
  handlers — all async-only in v16 (`version-16.md`, "Async Request APIs"
  section). Later tasks writing dynamic route handlers must `await` any
  `params`.

## Q3: Exact `NextRequest`/`NextResponse` import path and route-handler signature

**Import path is unchanged from training data:** both are imported from
`next/server`.

```ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
```

Confirmed in
`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md`
(line 67, `import type { NextRequest } from 'next/server'`) and in `proxy.md`
(line 28–29, same imports). `NextResponse` is a concrete class (import as a
value); `NextRequest` is used as a type in these examples but is also a
concrete class you can `new` up.

**Route handler signature** (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md`,
"Parameters" section, lines 60–116):

```ts
// app/api/example/route.ts
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  // ...
}

// With dynamic route params — params is a Promise in v16, must be awaited:
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
}
```

- Supported exported method names: `GET`, `HEAD`, `POST`, `PUT`, `DELETE`,
  `PATCH`, `OPTIONS`.
- The `request` parameter is optional in the handler signature but later
  tasks in this plan need it (reading cookies/headers/body), so always
  include it typed as `NextRequest`.
- The second `context` argument's `params` field is a `Promise` — must be
  awaited before destructuring, consistent with the async-APIs change in Q2.
- `RouteContext<'/exact/route/path'>` is a generated global helper type
  available after `next dev`/`next build`/`next typegen` runs once; not
  required, but available if a later task wants strongly-typed dynamic params
  instead of hand-writing the `Promise<{...}>` shape.
- Cookies inside a route handler: `import { cookies } from 'next/headers'`,
  then `const cookieStore = await cookies()` — same async accessor as Q2, not
  `request.cookies` (which is for reading/mutating request cookies
  specifically, e.g. inside `proxy.ts`).

## Required human actions

The following step from the task brief (Step 5: "Add the redirect URI to the
Google client") requires access to the Google Cloud Console and cannot be
performed by an agent. **Miguel needs to do this manually:**

1. Open the Google Cloud Console project for the OAuth client created in
   **Plan A Task 2**.
2. Under that **same** OAuth 2.0 Client ID, add both of the following as
   **Authorized redirect URIs**:
   - `https://www.fraterailabs.com/api/auth/google/callback`
   - `http://localhost:3000/api/auth/google/callback`
3. Save. No new OAuth client should be created — both URIs go on the existing
   client so the same `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` pair (already
   in `.env.google-id.local` / `.env.google-secret.local`) keeps working for
   both production and local development.

Until this is done, the Google OAuth callback route that later tasks build
(Task 4/5: Google identity check) will fail in the browser with a
`redirect_uri_mismatch` error, for both prod and local dev.

## Environment variables

Documented in `.env.example` (committed, all secret values left blank).
Real values live in the user's password manager and in git-ignored
`.env.*.local` files at the repo root: `.env.twenty.local`,
`.env.google-id.local`, `.env.google-secret.local`,
`.env.twenty-staging.local`.

| Variable | Notes |
| --- | --- |
| `TWENTY_BASE_URL` | `https://crm.fraterailabs.com` — production Twenty instance from Plan A. |
| `TWENTY_API_KEY` | Secret. Not committed. |
| `GOOGLE_CLIENT_ID` | Secret-ish (not sensitive but kept blank in `.env.example` per plan). From the OAuth client created in Plan A Task 2. |
| `GOOGLE_CLIENT_SECRET` | Secret. Not committed. |
| `GOOGLE_REDIRECT_URI` | `https://www.fraterailabs.com/api/auth/google/callback` — production callback. See "Required human actions" above for registering this (and the localhost variant) in Google Cloud Console. |
| `ALLOWED_GOOGLE_DOMAIN` | `fraterailabs.com` — Google Workspace domain gate for the membership check (Task 4). |
| `PORTAL_EMAIL_ALLOWLIST` | Secret-ish, left blank. Comma-separated allowlist for magic-link collaborators (Task 5b). |
| `SESSION_SECRET` | Secret. Generate with `openssl rand -base64 32`. Not committed — must be set in the real deploy environment and in a local `.env.local` for dev. |
| `TWENTY_WEBHOOK_SECRET` | Secret. Not committed. Used by the webhook receiver (Task 10). |
| `HUBSPOT_PORTAL_ID` | `245673738` — already public, taken verbatim from `app/contact/page.tsx:47`. Safe to commit. |
| `HUBSPOT_FORM_GUID` | `7aaf12d7-5cc8-43a9-91ce-2fcb0961ab4c` — already public, taken verbatim from `app/contact/page.tsx:47`. Safe to commit. |
| `SLACK_WEBHOOK_URL` | Secret, left blank. |

`lib/server/env.ts` provides two accessors for reading these at runtime:

```ts
import 'server-only';

export const requireEnv = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

export const optionalEnv = (name: string): string | undefined => process.env[name];
```

The `server-only` import makes the Next.js build fail at compile time if this
module is ever pulled into a client component bundle, so a secret read via
`requireEnv`/`optionalEnv` cannot leak to the browser through this path.

## Dependencies installed this task

- `google-auth-library` (runtime dependency) — Google's official library for
  verifying ID-token signatures against Google's rotating JWKS. Later tasks
  (Task 4: Google identity and membership check) must use this rather than
  hand-rolling JWT verification.
- `server-only` (runtime dependency) — enforces the server/client boundary
  for `lib/server/env.ts` and any other server-only module.

Package manager is **npm** — do not run `yarn` in this repo. A previous task
had Yarn 4 add a `packageManager` field to root `package.json`; it was
reverted and must not be reintroduced. `npm install` was used for both
dependencies above and both are pinned in `package-lock.json`.

## Notes for whoever writes tests against `lib/server/`

`vitest.config.ts` already includes `lib/server/__tests__/*.test.ts` via its
`**/__tests__/**/*.test.ts` glob and runs with `environment: 'node'`. No
change to `vitest.config.ts` was needed or made.

## Task 10: Twenty's outbound webhook signature scheme — NOT observed, still assumed

Task 10's Step 1 called for creating a test webhook in Twenty, inspecting the
headers it actually sends, and recording the header names and signed-payload
format here. That could not be done: Twenty's API keys were mid-rotation
after a credential leak and no live instance was available, and a search of
`twenty-app/node_modules/` and `docs/runbooks/twenty-railway.md` turned up no
webhook-signing code, header names, or documented payload format anywhere in
this repo (full search trail in `task-10-report.md`).

**Nothing here is confirmed.** The receiver (`app/api/webhooks/twenty/route.ts`,
`lib/server/webhook-verify.ts`) was built against a guessed, Stripe/Slack-style
scheme, isolated in one clearly marked block at the top of
`lib/server/webhook-verify.ts` so it can be corrected in one place once real
traffic is observed. Getting it wrong fails closed (every delivery gets a 401),
so shipping it unverified is safe — it just means the receiver silently
rejects every real Twenty webhook until this is fixed.

**When a live Twenty instance is available again:** create a test webhook
(Settings → Webhooks) pointed at a request-capture endpoint (e.g.
`https://webhook.site`), trigger an event, and update the ASSUMED block in
`lib/server/webhook-verify.ts` (header names, signed-bytes format, digest
encoding, any prefix) to match what's actually observed — then record the
confirmed values in this section, replacing this note.
