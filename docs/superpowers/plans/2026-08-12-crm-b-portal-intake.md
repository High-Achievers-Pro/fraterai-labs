# CRM Plan B — Portal & Inbound Intake (M4–M5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a members-only portal to the Frater AI Labs site, backed by real server-side code, and route inbound website leads directly into Twenty instead of only HubSpot.

**Architecture:** Next.js route handlers and middleware provide the backend. There is **no database**: membership is defined as active Twenty workspace membership, and sessions are stateless HMAC-signed cookies. A single typed Twenty client holds the workspace API key server-side.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, `google-auth-library`, Web Crypto, vitest.

**Depends on:** Plan A (Twenty live, workspace locked to `fraterailabs.com`, `prospect` object deployed).

**Spec:** `docs/superpowers/specs/2026-08-12-twenty-crm-portal-design.md`

## Global Constraints

- Google Workspace domain is **`fraterailabs.com`**; CRM host is **`crm.fraterailabs.com`**.
- **`TWENTY_API_KEY` must never reach the browser.** Server-only modules; no `NEXT_PUBLIC_` prefix.
- The portal must be **undiscoverable**: no nav or footer link, `noindex`, and a `robots.txt` disallow.
- Access requires active Twenty workspace membership **always**, plus EITHER a Google `hd` claim matching the domain OR an exact match in `PORTAL_EMAIL_ALLOWLIST`. The allowlist is an exception to the domain check only — never to the membership check.
- **Google is not a viable door for outside collaborators.** Twenty invitations carry no domain restriction, so a collaborator on another email domain is a legitimate workspace member — but they sign into Twenty with a password, and the Internal Google consent screen blocks non-Workspace accounts before our code runs. The allowlist is therefore paired with **magic-link sign-in** (Task 5b); without it the allowlist would be unreachable code.
- **Two token types share `SESSION_SECRET`, so both MUST carry a `purpose` field.** A magic-link token and a session cookie signed by the same key with no domain separation are interchangeable — an attacker who obtains either could present it as the other. Verify `purpose` on every read.
- Inbound writes go to **Twenty first**; the HubSpot mirror is best-effort and must never fail the request.
- This Next.js version has breaking changes — **read `node_modules/next/dist/docs/` before writing framework code** (per `AGENTS.md`).
- Branch: `feat/twenty-crm-portal`.

## Naming Registry (produced here, consumed by Plan D)

| Module | Exports |
|---|---|
| `lib/server/twenty-client.ts` | `twentyGraphQL`, `twentyRest`, `TwentyError` |
| `lib/server/session.ts` | `SessionPayload`, `createSessionCookie`, `readSessionCookie`, `SESSION_COOKIE_NAME` |
| `lib/server/google-oauth.ts` | `buildAuthUrl`, `exchangeCodeForIdToken`, `verifyIdToken`, `GoogleIdentity` |
| `lib/server/membership.ts` | `findActiveWorkspaceMember`, `WorkspaceMember` |
| `lib/server/leads.ts` | `captureInboundLead`, `InboundLead` |
| `lib/server/hubspot-mirror.ts` | `mirrorToHubSpot` |
| `lib/server/summary.ts` | `getPortalSummary`, `PortalSummary` |

## File Structure

```
lib/server/
├── env.ts                required-env accessor
├── twenty-client.ts      the only module holding TWENTY_API_KEY
├── session.ts            HMAC-signed stateless cookie
├── google-oauth.ts       authorization-code flow + ID token verification
├── membership.ts         "is this email an active workspace member?"
├── leads.ts              inbound lead → Twenty records
├── hubspot-mirror.ts     best-effort legacy mirror
└── summary.ts            portal rollups

app/
├── portal/layout.tsx     noindex wrapper
├── portal/page.tsx       launchpad + tiles
├── portal/login/page.tsx sign-in
└── api/
    ├── auth/google/route.ts
    ├── auth/google/callback/route.ts
    ├── auth/logout/route.ts
    ├── portal/me/route.ts
    ├── portal/summary/route.ts
    ├── leads/inbound/route.ts
    └── webhooks/twenty/route.ts

middleware.ts             protects /portal/* and /api/portal/*
app/robots.ts             disallow /portal
```

Auth is split into four small modules rather than one `auth.ts`, because the membership rule is the piece most likely to change and it should be testable without touching OAuth.

---

### Task 1: Establish Next.js 16 ground truth and env plumbing

**Files:**
- Create: `lib/server/env.ts`, `docs/runbooks/portal-env.md`, `.env.example`
- Modify: `package.json`

**Interfaces:**
- Produces: `requireEnv(name: string): string`, and a written record of Next 16 API shapes used by later tasks.

- [ ] **Step 1: Install and read the shipped docs**

`AGENTS.md` warns this Next.js release differs from training data. Verify before writing code.

Run:
```bash
npm install
ls node_modules/next/dist/docs/
```

Read the guides covering **route handlers**, **middleware**, and **cookies**. Record in `docs/runbooks/portal-env.md`:

- Is `middleware.ts` still the filename and `config.matcher` still the matcher API?
- Are `cookies()` and `headers()` async in this version?
- The exact `NextRequest`/`NextResponse` import path and route-handler signature.

Every later task in this plan depends on these answers. If any differ from what this plan shows, **the docs win** — adapt the code and note the deviation.

- [ ] **Step 2: Install runtime dependencies**

Run: `npm install google-auth-library`

`google-auth-library` is Google's official library and handles ID-token signature verification against rotating JWKS. Hand-rolling that verification is the single easiest way to build an auth bypass, so it is not optional.

- [ ] **Step 3: Write the env accessor**

`lib/server/env.ts`:

```ts
import 'server-only';

export const requireEnv = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

export const optionalEnv = (name: string): string | undefined => process.env[name];
```

The `server-only` import makes the build fail if any of this is ever imported into a client component — a compile-time guarantee that the API key cannot leak.

Run: `npm install server-only`

- [ ] **Step 4: Document the variables**

`.env.example`:

```
TWENTY_BASE_URL=https://crm.fraterailabs.com
TWENTY_API_KEY=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://www.fraterailabs.com/api/auth/google/callback
ALLOWED_GOOGLE_DOMAIN=fraterailabs.com
PORTAL_EMAIL_ALLOWLIST=
SESSION_SECRET=
TWENTY_WEBHOOK_SECRET=
HUBSPOT_PORTAL_ID=245673738
HUBSPOT_FORM_GUID=7aaf12d7-5cc8-43a9-91ce-2fcb0961ab4c
SLACK_WEBHOOK_URL=
```

Generate `SESSION_SECRET` with `openssl rand -base64 32`. The HubSpot values are the existing ones already present in `app/contact/page.tsx:47`.

- [ ] **Step 5: Add the redirect URI to the Google client**

In Google Cloud Console, add `https://www.fraterailabs.com/api/auth/google/callback` to the **same** OAuth client created in Plan A Task 2. Also add `http://localhost:3000/api/auth/google/callback` for local development.

- [ ] **Step 6: Verify the app still builds**

Run: `npm run build`
Expected: success.

- [ ] **Step 7: Commit**

```bash
git add lib/server/env.ts .env.example docs/runbooks/portal-env.md package.json package-lock.json
git commit -m "chore(portal): add server env plumbing and Next 16 API notes"
```

---

### Task 2: Twenty API client

**Files:**
- Create: `lib/server/twenty-client.ts`, `lib/server/__tests__/twenty-client.test.ts`

**Interfaces:**
- Produces: `twentyGraphQL<T>(query, variables?): Promise<T>`, `twentyRest<T>(path, init?): Promise<T>`, `TwentyError`.

- [ ] **Step 1: Write the failing test**

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TwentyError, twentyGraphQL } from '../twenty-client';

const mockFetch = (response: unknown, ok = true, status = 200) =>
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok, status,
    json: async () => response,
    text: async () => JSON.stringify(response),
  })));

afterEach(() => vi.unstubAllGlobals());

describe('twentyGraphQL', () => {
  it('sends the API key as a bearer token', async () => {
    process.env.TWENTY_BASE_URL = 'https://crm.test';
    process.env.TWENTY_API_KEY = 'secret-key';
    mockFetch({ data: { ok: true } });

    await twentyGraphQL('query { ok }');

    const [, init] = (globalThis.fetch as never as { mock: { calls: [string, RequestInit][] } }).mock.calls[0];
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer secret-key');
  });

  it('returns the data payload', async () => {
    process.env.TWENTY_BASE_URL = 'https://crm.test';
    process.env.TWENTY_API_KEY = 'secret-key';
    mockFetch({ data: { workspaceMembers: [] } });

    const result = await twentyGraphQL<{ workspaceMembers: unknown[] }>('query { workspaceMembers { id } }');
    expect(result.workspaceMembers).toEqual([]);
  });

  it('throws TwentyError on a GraphQL error, without leaking the key', async () => {
    process.env.TWENTY_BASE_URL = 'https://crm.test';
    process.env.TWENTY_API_KEY = 'secret-key';
    mockFetch({ errors: [{ message: 'Unauthorized' }] });

    const error = await twentyGraphQL('query { ok }').catch((e) => e);
    expect(error).toBeInstanceOf(TwentyError);
    expect(String(error)).toContain('Unauthorized');
    expect(String(error)).not.toContain('secret-key');
  });

  it('throws when the API key is missing', async () => {
    delete process.env.TWENTY_API_KEY;
    await expect(twentyGraphQL('query { ok }')).rejects.toThrow('TWENTY_API_KEY');
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run lib/server/__tests__/twenty-client.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
import 'server-only';
import { requireEnv } from './env';

export class TwentyError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = 'TwentyError';
  }
}

const baseUrl = () => requireEnv('TWENTY_BASE_URL').replace(/\/$/, '');

const authHeaders = () => ({
  Authorization: `Bearer ${requireEnv('TWENTY_API_KEY')}`,
  'Content-Type': 'application/json',
});

export const twentyGraphQL = async <T>(
  query: string,
  variables: Record<string, unknown> = {},
): Promise<T> => {
  const response = await fetch(`${baseUrl()}/graphql`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ query, variables }),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new TwentyError(`Twenty GraphQL request failed with ${response.status}`, response.status);
  }

  const payload = (await response.json()) as { data?: T; errors?: { message: string }[] };

  if (payload.errors?.length) {
    throw new TwentyError(payload.errors.map((e) => e.message).join('; '));
  }
  if (!payload.data) throw new TwentyError('Twenty returned no data');

  return payload.data;
};

export const twentyRest = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
  const response = await fetch(`${baseUrl()}/rest${path}`, {
    ...init,
    headers: { ...authHeaders(), ...init.headers },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new TwentyError(`Twenty REST ${init.method ?? 'GET'} ${path} failed with ${response.status}`, response.status);
  }

  return (await response.json()) as T;
};
```

Error messages carry status codes and GraphQL messages but never the key or the request headers, so a logged stack trace cannot expose the credential.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run lib/server/__tests__/twenty-client.test.ts`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add lib/server/twenty-client.ts lib/server/__tests__/twenty-client.test.ts
git commit -m "feat(portal): add server-only Twenty API client"
```

---

### Task 3: Stateless signed sessions

**Files:**
- Create: `lib/server/session.ts`, `lib/server/__tests__/session.test.ts`

**Interfaces:**
- Produces: `SESSION_COOKIE_NAME`, `SessionPayload { email, name, workspaceMemberId, expiresAt }`, `createSessionCookie`, `readSessionCookie`.

- [ ] **Step 1: Write the failing test**

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { createSessionCookie, readSessionCookie } from '../session';

const payload = {
  email: 'someone@fraterailabs.com',
  name: 'Some One',
  workspaceMemberId: 'wm-1',
};

beforeEach(() => { process.env.SESSION_SECRET = 'test-secret-value'; });

describe('session', () => {
  it('round-trips a payload', async () => {
    const cookie = await createSessionCookie(payload, 3600);
    const session = await readSessionCookie(cookie);
    expect(session?.email).toBe(payload.email);
    expect(session?.workspaceMemberId).toBe('wm-1');
  });

  it('rejects a tampered payload', async () => {
    const cookie = await createSessionCookie(payload, 3600);
    const [body, signature] = cookie.split('.');
    const forged = Buffer.from(
      JSON.stringify({ ...payload, email: 'attacker@evil.test', expiresAt: Date.now() + 3600_000 }),
    ).toString('base64url');
    expect(await readSessionCookie(`${forged}.${signature}`)).toBeNull();
    expect(await readSessionCookie(`${body}.deadbeef`)).toBeNull();
  });

  it('rejects an expired session', async () => {
    const cookie = await createSessionCookie(payload, -1);
    expect(await readSessionCookie(cookie)).toBeNull();
  });

  it('rejects malformed input', async () => {
    expect(await readSessionCookie('')).toBeNull();
    expect(await readSessionCookie('nodot')).toBeNull();
    expect(await readSessionCookie('a.b.c')).toBeNull();
  });

  it('rejects a session signed with a different secret', async () => {
    const cookie = await createSessionCookie(payload, 3600);
    process.env.SESSION_SECRET = 'rotated-secret';
    expect(await readSessionCookie(cookie)).toBeNull();
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run lib/server/__tests__/session.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
import 'server-only';
import { requireEnv } from './env';

export const SESSION_COOKIE_NAME = 'frater_portal_session';

export type SessionPayload = {
  email: string;
  name: string;
  workspaceMemberId: string;
  expiresAt: number;
};

const encoder = new TextEncoder();

const importKey = async () =>
  crypto.subtle.importKey(
    'raw', encoder.encode(requireEnv('SESSION_SECRET')),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'],
  );

const toBase64Url = (bytes: ArrayBuffer | Uint8Array): string =>
  Buffer.from(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)).toString('base64url');

const sign = async (body: string): Promise<string> =>
  toBase64Url(await crypto.subtle.sign('HMAC', await importKey(), encoder.encode(body)));

export const createSessionCookie = async (
  payload: Omit<SessionPayload, 'expiresAt'>,
  ttlSeconds: number,
): Promise<string> => {
  const full: SessionPayload = { ...payload, expiresAt: Date.now() + ttlSeconds * 1000 };
  const body = Buffer.from(JSON.stringify(full)).toString('base64url');
  return `${body}.${await sign(body)}`;
};

export const readSessionCookie = async (cookie: string | undefined): Promise<SessionPayload | null> => {
  if (!cookie) return null;

  const parts = cookie.split('.');
  if (parts.length !== 2) return null;

  const [body, signature] = parts;

  const expected = await sign(body);
  if (expected.length !== signature.length) return null;

  // Constant-time comparison — a length-only or early-exit check leaks the signature.
  let mismatch = 0;
  for (let i = 0; i < expected.length; i += 1) {
    mismatch |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  if (mismatch !== 0) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as SessionPayload;
    if (typeof payload.expiresAt !== 'number' || payload.expiresAt < Date.now()) return null;
    if (typeof payload.email !== 'string' || !payload.email) return null;
    return payload;
  } catch {
    return null;
  }
};
```

Verification happens before parsing, so untrusted JSON is never deserialized until the signature checks out.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run lib/server/__tests__/session.test.ts`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add lib/server/session.ts lib/server/__tests__/session.test.ts
git commit -m "feat(portal): add HMAC-signed stateless sessions"
```

---

### Task 4: Google identity and membership check

**Files:**
- Create: `lib/server/google-oauth.ts`, `lib/server/membership.ts`, `lib/server/__tests__/membership.test.ts`

**Interfaces:**
- Produces: `buildAuthUrl(state)`, `exchangeCodeForIdToken(code)`, `verifyIdToken(idToken): Promise<GoogleIdentity>`, `GoogleIdentity { email, name, hostedDomain, emailVerified }`, `findActiveWorkspaceMember(email): Promise<WorkspaceMember | null>`, `WorkspaceMember { id, name, userEmail }`.

- [ ] **Step 1: Write the Google OAuth module**

```ts
import 'server-only';
import { OAuth2Client } from 'google-auth-library';
import { requireEnv } from './env';

export type GoogleIdentity = {
  email: string;
  name: string;
  hostedDomain: string | undefined;
  emailVerified: boolean;
};

const client = () =>
  new OAuth2Client(
    requireEnv('GOOGLE_CLIENT_ID'),
    requireEnv('GOOGLE_CLIENT_SECRET'),
    requireEnv('GOOGLE_REDIRECT_URI'),
  );

export const buildAuthUrl = (state: string): string =>
  client().generateAuthUrl({
    scope: ['openid', 'email', 'profile'],
    state,
    prompt: 'select_account',
    hd: requireEnv('ALLOWED_GOOGLE_DOMAIN'),
  });

export const exchangeCodeForIdToken = async (code: string): Promise<string> => {
  const { tokens } = await client().getToken(code);
  if (!tokens.id_token) throw new Error('Google did not return an id_token');
  return tokens.id_token;
};

export const verifyIdToken = async (idToken: string): Promise<GoogleIdentity> => {
  const ticket = await client().verifyIdToken({
    idToken,
    audience: requireEnv('GOOGLE_CLIENT_ID'),
  });

  const payload = ticket.getPayload();
  if (!payload?.email) throw new Error('Google token has no email');

  return {
    email: payload.email.toLowerCase(),
    name: payload.name ?? payload.email,
    hostedDomain: payload.hd,
    emailVerified: payload.email_verified === true,
  };
};
```

The `hd` parameter on the auth URL is a UX hint only — Google does not enforce it. The real check happens in Task 5 against the verified token payload. Treating the URL parameter as the control would be an auth bypass.

- [ ] **Step 2: Write the failing membership test**

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { findActiveWorkspaceMember } from '../membership';

vi.mock('../twenty-client', () => ({ twentyGraphQL: vi.fn() }));
const { twentyGraphQL } = await import('../twenty-client');

afterEach(() => vi.resetAllMocks());

describe('findActiveWorkspaceMember', () => {
  it('returns the member when one matches', async () => {
    vi.mocked(twentyGraphQL).mockResolvedValue({
      workspaceMembers: {
        edges: [{ node: { id: 'wm-1', userEmail: 'a@fraterailabs.com', name: { firstName: 'A', lastName: 'B' } } }],
      },
    } as never);

    const member = await findActiveWorkspaceMember('a@fraterailabs.com');
    expect(member).toEqual({ id: 'wm-1', userEmail: 'a@fraterailabs.com', name: 'A B' });
  });

  it('returns null when nobody matches', async () => {
    vi.mocked(twentyGraphQL).mockResolvedValue({ workspaceMembers: { edges: [] } } as never);
    expect(await findActiveWorkspaceMember('ghost@fraterailabs.com')).toBeNull();
  });

  it('lowercases the email before querying', async () => {
    vi.mocked(twentyGraphQL).mockResolvedValue({ workspaceMembers: { edges: [] } } as never);
    await findActiveWorkspaceMember('MiXeD@FraterAILabs.com');
    expect(vi.mocked(twentyGraphQL).mock.calls[0][1]).toMatchObject({ email: 'mixed@fraterailabs.com' });
  });

  it('returns null rather than throwing when Twenty is unreachable', async () => {
    vi.mocked(twentyGraphQL).mockRejectedValue(new Error('network down'));
    expect(await findActiveWorkspaceMember('a@fraterailabs.com')).toBeNull();
  });
});
```

The last case is a deliberate fail-closed decision: if Twenty cannot confirm membership, access is denied.

- [ ] **Step 3: Run it and confirm it fails**

Run: `npx vitest run lib/server/__tests__/membership.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement**

```ts
import 'server-only';
import { twentyGraphQL } from './twenty-client';

export type WorkspaceMember = { id: string; userEmail: string; name: string };

const QUERY = `
  query FindWorkspaceMember($email: String!) {
    workspaceMembers(filter: { userEmail: { eq: $email } }, first: 1) {
      edges { node { id userEmail name { firstName lastName } } }
    }
  }
`;

type QueryResult = {
  workspaceMembers: {
    edges: { node: { id: string; userEmail: string; name: { firstName: string; lastName: string } } }[];
  };
};

export const findActiveWorkspaceMember = async (email: string): Promise<WorkspaceMember | null> => {
  const normalized = email.trim().toLowerCase();

  try {
    const data = await twentyGraphQL<QueryResult>(QUERY, { email: normalized });
    const node = data.workspaceMembers.edges[0]?.node;
    if (!node) return null;

    return {
      id: node.id,
      userEmail: node.userEmail,
      name: [node.name.firstName, node.name.lastName].filter(Boolean).join(' '),
    };
  } catch {
    // Fail closed: an unreachable CRM must not grant access.
    return null;
  }
};
```

Verify the `workspaceMembers` filter shape against your server before relying on it:

```bash
curl -s "$TWENTY_BASE_URL/graphql" -H "Authorization: Bearer $TWENTY_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"query":"query { workspaceMembers(first: 1) { edges { node { id userEmail } } } }"}'
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run lib/server/__tests__/membership.test.ts`
Expected: 4 passed.

- [ ] **Step 6: Commit**

```bash
git add lib/server/google-oauth.ts lib/server/membership.ts lib/server/__tests__/membership.test.ts
git commit -m "feat(portal): add Google identity verification and membership lookup"
```

---

### Task 5: Auth routes with both gates enforced

**Files:**
- Create: `app/api/auth/google/route.ts`, `app/api/auth/google/callback/route.ts`, `app/api/auth/logout/route.ts`, `lib/server/__tests__/auth-gate.test.ts`, `lib/server/auth-gate.ts`

**Interfaces:**
- Produces: `evaluateAccess(identity, member): AccessDecision` — the pure authorization rule, tested independently of HTTP.

- [ ] **Step 1: Write the failing test for the authorization rule**

Extracting the rule from the route handler is what makes it testable. This is the security-critical test the spec calls for.

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { evaluateAccess } from '../auth-gate';

const member = { id: 'wm-1', userEmail: 'a@fraterailabs.com', name: 'A B' };
const identity = {
  email: 'a@fraterailabs.com', name: 'A B',
  hostedDomain: 'fraterailabs.com', emailVerified: true,
};

beforeEach(() => { process.env.ALLOWED_GOOGLE_DOMAIN = 'fraterailabs.com'; });

describe('evaluateAccess', () => {
  it('allows a verified in-domain workspace member', () => {
    expect(evaluateAccess(identity, member)).toEqual({ allowed: true, member });
  });

  it('denies a personal Gmail account even if somehow a member', () => {
    const outsider = { ...identity, email: 'someone@gmail.com', hostedDomain: undefined };
    expect(evaluateAccess(outsider, member).allowed).toBe(false);
  });

  it('denies an in-domain account that is not a workspace member', () => {
    expect(evaluateAccess(identity, null).allowed).toBe(false);
  });

  it('denies an unverified email', () => {
    expect(evaluateAccess({ ...identity, emailVerified: false }, member).allowed).toBe(false);
  });

  it('denies a lookalike domain', () => {
    const lookalike = {
      ...identity, email: 'a@notfraterailabs.com', hostedDomain: 'notfraterailabs.com',
    };
    expect(evaluateAccess(lookalike, member).allowed).toBe(false);
  });

  it('denies when the email domain and hd claim disagree', () => {
    expect(evaluateAccess({ ...identity, email: 'a@gmail.com' }, member).allowed).toBe(false);
  });

  it('allows an allowlisted outside address that is also a workspace member', () => {
    process.env.PORTAL_EMAIL_ALLOWLIST = 'contractor@partner.test';
    const outside = {
      ...identity, email: 'contractor@partner.test', hostedDomain: undefined,
    };
    expect(evaluateAccess(outside, member).allowed).toBe(true);
  });

  it('still denies an allowlisted address that is NOT a workspace member', () => {
    process.env.PORTAL_EMAIL_ALLOWLIST = 'contractor@partner.test';
    const outside = {
      ...identity, email: 'contractor@partner.test', hostedDomain: undefined,
    };
    expect(evaluateAccess(outside, null).allowed).toBe(false);
  });

  it('matches the allowlist case-insensitively', () => {
    process.env.PORTAL_EMAIL_ALLOWLIST = 'Contractor@Partner.test';
    const outside = {
      ...identity, email: 'contractor@partner.test', hostedDomain: undefined,
    };
    expect(evaluateAccess(outside, member).allowed).toBe(true);
  });

  it('does not treat an allowlist entry as a domain suffix', () => {
    process.env.PORTAL_EMAIL_ALLOWLIST = 'contractor@partner.test';
    const other = {
      ...identity, email: 'someone-else@partner.test', hostedDomain: undefined,
    };
    expect(evaluateAccess(other, member).allowed).toBe(false);
  });

  it('denies everyone outside the domain when the allowlist is empty', () => {
    process.env.PORTAL_EMAIL_ALLOWLIST = '';
    const outside = { ...identity, email: 'x@gmail.com', hostedDomain: undefined };
    expect(evaluateAccess(outside, member).allowed).toBe(false);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run lib/server/__tests__/auth-gate.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the rule**

```ts
import 'server-only';
import { optionalEnv, requireEnv } from './env';
import type { GoogleIdentity } from './google-oauth';
import type { WorkspaceMember } from './membership';

export type AccessDecision =
  | { allowed: true; member: WorkspaceMember }
  | { allowed: false; reason: string };

const parseAllowlist = (): string[] =>
  (optionalEnv('PORTAL_EMAIL_ALLOWLIST') ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

export const evaluateAccess = (
  identity: GoogleIdentity,
  member: WorkspaceMember | null,
): AccessDecision => {
  const domain = requireEnv('ALLOWED_GOOGLE_DOMAIN').toLowerCase();
  const email = identity.email.toLowerCase();

  if (!identity.emailVerified) return { allowed: false, reason: 'Email is not verified' };

  const isDomainMember =
    identity.hostedDomain?.toLowerCase() === domain &&
    email.split('@')[1] === domain;

  const isAllowlisted = parseAllowlist().includes(email);

  if (!isDomainMember && !isAllowlisted) {
    return { allowed: false, reason: 'Not on the Frater AI Labs domain and not allowlisted' };
  }

  // Membership is required on BOTH paths. The allowlist waives the domain
  // requirement, never the membership requirement.
  if (!member) return { allowed: false, reason: 'Not an active Twenty workspace member' };

  return { allowed: true, member };
};
```

For the domain path, both the `hd` claim and the email's own domain must match. Checking only `hd` would admit an account whose hosted domain is set but whose primary email is elsewhere.

The allowlist is an exact, case-insensitive, full-address match — never a domain suffix. A suffix rule (`@partner.com`) would silently admit every future address at that domain, which is the failure mode allowlists exist to avoid.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run lib/server/__tests__/auth-gate.test.ts`
Expected: 6 passed.

- [ ] **Step 5: Write the sign-in route**

`app/api/auth/google/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { buildAuthUrl } from '@/lib/server/google-oauth';

export const GET = async () => {
  const state = crypto.randomUUID();

  const response = NextResponse.redirect(buildAuthUrl(state));
  response.cookies.set('frater_oauth_state', state, {
    httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 600,
  });

  return response;
};
```

- [ ] **Step 6: Write the callback route**

`app/api/auth/google/callback/route.ts`:

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { evaluateAccess } from '@/lib/server/auth-gate';
import { exchangeCodeForIdToken, verifyIdToken } from '@/lib/server/google-oauth';
import { findActiveWorkspaceMember } from '@/lib/server/membership';
import { SESSION_COOKIE_NAME, createSessionCookie } from '@/lib/server/session';

const SESSION_TTL_SECONDS = 8 * 60 * 60;

export const GET = async (request: NextRequest) => {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const expectedState = request.cookies.get('frater_oauth_state')?.value;

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(new URL('/portal/login?error=invalid_state', request.url));
  }

  try {
    const identity = await verifyIdToken(await exchangeCodeForIdToken(code));
    const member = await findActiveWorkspaceMember(identity.email);
    const decision = evaluateAccess(identity, member);

    if (!decision.allowed) {
      return NextResponse.redirect(new URL('/portal/login?error=not_authorized', request.url));
    }

    const cookie = await createSessionCookie(
      { email: identity.email, name: decision.member.name, workspaceMemberId: decision.member.id },
      SESSION_TTL_SECONDS,
    );

    const response = NextResponse.redirect(new URL('/portal', request.url));
    response.cookies.set(SESSION_COOKIE_NAME, cookie, {
      httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: SESSION_TTL_SECONDS,
    });
    response.cookies.delete('frater_oauth_state');

    return response;
  } catch {
    return NextResponse.redirect(new URL('/portal/login?error=sign_in_failed', request.url));
  }
};
```

The state cookie is the CSRF defence for the OAuth flow. Failures redirect with a generic code rather than rendering the underlying error, so the login page cannot become an information leak.

- [ ] **Step 7: Write the logout route**

`app/api/auth/logout/route.ts`:

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE_NAME } from '@/lib/server/session';

export const POST = async (request: NextRequest) => {
  const response = NextResponse.redirect(new URL('/portal/login', request.url));
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
};
```

- [ ] **Step 8: Commit**

```bash
git add lib/server/auth-gate.ts lib/server/__tests__/auth-gate.test.ts app/api/auth
git commit -m "feat(portal): add Google auth routes with domain and membership gates"
```

---

### Task 5b: Magic-link sign-in for allowlisted collaborators

**Files:**
- Create: `lib/server/magic-link.ts`, `lib/server/email.ts`, `lib/server/__tests__/magic-link.test.ts`, `app/api/auth/magic-link/request/route.ts`, `app/api/auth/magic-link/verify/route.ts`
- Modify: `app/portal/login/page.tsx`, `.env.example`

**Interfaces:**
- Consumes: `evaluateAccess` semantics from Task 5, `findActiveWorkspaceMember`, `createSessionCookie`.
- Produces: `createMagicToken(email)`, `readMagicToken(token)`, `sendMagicLinkEmail(email, url)`, `MAGIC_LINK_TTL_SECONDS`.

Outside collaborators cannot use Google (see Global Constraints). This gives them a second door that needs no password store and no database, so the "no DB in the Next.js layer" decision survives.

- [ ] **Step 1: Add email config**

Append to `.env.example`:

```
RESEND_API_KEY=
PORTAL_EMAIL_FROM=portal@fraterailabs.com
```

Resend is the default because it is a single HTTPS call from Vercel with no SMTP connection handling. Google Workspace SMTP with an app password also works and adds no vendor — but an app password is a long-lived credential with full mailbox send rights, which is a worse thing to hold than a scoped API key.

- [ ] **Step 2: Write the failing test**

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { createMagicToken, readMagicToken } from '../magic-link';
import { createSessionCookie } from '../session';

beforeEach(() => {
  process.env.SESSION_SECRET = 'test-secret-value';
  process.env.PORTAL_EMAIL_ALLOWLIST = 'contractor@partner.test';
});

describe('magic link tokens', () => {
  it('round-trips the email', async () => {
    const t = await createMagicToken('contractor@partner.test');
    expect((await readMagicToken(t))?.email).toBe('contractor@partner.test');
  });

  it('normalises the email to lowercase', async () => {
    const t = await createMagicToken('Contractor@Partner.test');
    expect((await readMagicToken(t))?.email).toBe('contractor@partner.test');
  });

  it('rejects a tampered payload', async () => {
    const t = await createMagicToken('contractor@partner.test');
    const [body, sig] = t.split('.');
    const forged = Buffer.from(JSON.stringify({
      email: 'attacker@evil.test', purpose: 'magic-link', expiresAt: Date.now() + 60000,
    })).toString('base64url');
    expect(await readMagicToken(`${forged}.${sig}`)).toBeNull();
  });

  it('rejects an expired token', async () => {
    const t = await createMagicToken('contractor@partner.test', -1);
    expect(await readMagicToken(t)).toBeNull();
  });

  it('REFUSES a session cookie presented as a magic token', async () => {
    const session = await createSessionCookie(
      { email: 'contractor@partner.test', name: 'C', workspaceMemberId: 'wm-1' }, 3600,
    );
    expect(await readMagicToken(session)).toBeNull();
  });

  it('rejects a token for an address no longer on the allowlist', async () => {
    const t = await createMagicToken('contractor@partner.test');
    process.env.PORTAL_EMAIL_ALLOWLIST = '';
    expect(await readMagicToken(t)).toBeNull();
  });

  it('rejects malformed input', async () => {
    expect(await readMagicToken('')).toBeNull();
    expect(await readMagicToken('nodot')).toBeNull();
  });
});
```

The session-cookie test is the important one. Both token types are signed with `SESSION_SECRET`; without a `purpose` check, a stolen session cookie would redeem as a magic link and vice versa.

- [ ] **Step 3: Run it and confirm it fails**

Run: `npx vitest run lib/server/__tests__/magic-link.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement**

`lib/server/magic-link.ts` mirrors `session.ts`'s HMAC approach — same constant-time comparison, same verify-before-parse ordering — with three differences: the payload carries `purpose: 'magic-link'` and `readMagicToken` returns `null` unless it matches; the TTL is `MAGIC_LINK_TTL_SECONDS = 600`; and the allowlist is re-checked at redemption, so removing an address from `PORTAL_EMAIL_ALLOWLIST` invalidates links already in flight.

Add `purpose: 'session'` to `session.ts`'s payload and reject anything else in `readSessionCookie`. Update its existing tests to match — this is a deliberate change to Task 3's output.

- [ ] **Step 5: Implement the request route**

`app/api/auth/magic-link/request/route.ts`:

- Validate the email's shape.
- **Always return the same 200 response**, whatever happens next. Any difference in status, body, or timing between "allowlisted member" and "stranger" turns this endpoint into a membership oracle.
- Only if the address is both allowlisted **and** an active workspace member: mint a token and email `${SERVER_URL}/api/auth/magic-link/verify?token=…`.
- Rate-limit by putting the same Cloudflare Turnstile widget used on the contact form in front of it. Without that, this is an unauthenticated endpoint that sends email on demand, which is a spam relay pointed at your own domain's reputation.

- [ ] **Step 6: Implement the verify route**

Validate signature → expiry → `purpose` → allowlist → **re-query `findActiveWorkspaceMember`**. Only then issue the session cookie via `createSessionCookie` and redirect to `/portal`. On any failure redirect to `/portal/login?error=link_invalid` with no detail.

Re-checking membership at redemption is what keeps revocation immediate: pulling someone from the Twenty workspace kills their portal access even if they hold an unexpired link.

- [ ] **Step 7: Add the email sender**

`lib/server/email.ts` exports `sendMagicLinkEmail(email, url)`. Plain text is fine. State the 10-minute expiry in the body, and include a line saying to ignore the message if they did not request it.

- [ ] **Step 8: Update the login page**

Add a secondary path below "Continue with Google": an email field and a "Send me a sign-in link" button. After submit, always render the same "If that address has access, a link is on its way" message — matching the endpoint's non-disclosure.

- [ ] **Step 9: Run the tests and verify end to end**

```bash
npx vitest run lib/server/__tests__/magic-link.test.ts lib/server/__tests__/session.test.ts
```

Then locally: request a link for an allowlisted member (arrives, works), for a non-allowlisted address (identical response, no email), and confirm an expired token is refused.

- [ ] **Step 10: Commit**

```bash
git add lib/server/magic-link.ts lib/server/email.ts lib/server/__tests__/magic-link.test.ts app/api/auth/magic-link app/portal/login/page.tsx .env.example
git commit -m "feat(portal): add magic-link sign-in for allowlisted collaborators"
```

---

### Task 6: Middleware, portal pages, and discoverability controls

**Files:**
- Create: `middleware.ts`, `app/portal/layout.tsx`, `app/portal/page.tsx`, `app/portal/login/page.tsx`, `app/robots.ts`, `app/api/portal/me/route.ts`

**Interfaces:**
- Consumes: `readSessionCookie`, `SESSION_COOKIE_NAME`.
- Produces: a protected `/portal`.

- [ ] **Step 1: Write the middleware**

Confirm the middleware API against the docs notes from Task 1 first.

`middleware.ts`:

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE_NAME, readSessionCookie } from '@/lib/server/session';

export const middleware = async (request: NextRequest) => {
  const session = await readSessionCookie(request.cookies.get(SESSION_COOKIE_NAME)?.value);

  if (session) return NextResponse.next();

  if (request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.redirect(new URL('/portal/login', request.url));
};

export const config = {
  matcher: ['/portal/:path*', '/api/portal/:path*'],
};
```

The matcher deliberately excludes `/portal/login`; add an explicit path check if your Next version's matcher includes it, or the login page will redirect to itself.

- [ ] **Step 2: Add the noindex layout**

`app/portal/layout.tsx`:

```tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Frater Portal',
  robots: { index: false, follow: false, nocache: true },
};

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
```

- [ ] **Step 3: Add the robots rule**

`app/robots.ts`:

```ts
import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/portal', '/api'] }],
    sitemap: 'https://www.fraterailabs.com/sitemap.xml',
  };
}
```

- [ ] **Step 4: Build the login page**

`app/portal/login/page.tsx` — a minimal page with one "Continue with Google" link to `/api/auth/google`, styled with the existing classes from `app/globals.css` (`.section`, `.container`, `.btn`, `.btn-primary`). Render a short message when `?error=not_authorized` is present. Do not reveal whether an address exists in the workspace.

- [ ] **Step 5: Build the portal page**

`app/portal/page.tsx` — a server component that reads the session, greets the member by name, and renders:

- A prominent "Open CRM" link to `https://crm.fraterailabs.com`
- A tiles area (filled in Task 7)
- A logout form posting to `/api/auth/logout`

- [ ] **Step 6: Add the session endpoint**

`app/api/portal/me/route.ts`:

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE_NAME, readSessionCookie } from '@/lib/server/session';

export const GET = async (request: NextRequest) => {
  const session = await readSessionCookie(request.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  return NextResponse.json({
    email: session.email, name: session.name, workspaceMemberId: session.workspaceMemberId,
  });
};
```

- [ ] **Step 7: Verify no link leaks into the public site**

Run: `grep -rn "portal" app components --include=*.tsx | grep -v "app/portal"`
Expected: no navigation or footer link. `app/api/*` route files may reference it.

- [ ] **Step 8: Test the flow end to end**

Run: `npm run dev`

Verify each of these:
1. Visiting `/portal` while signed out redirects to `/portal/login`.
2. Signing in with your `@fraterailabs.com` account reaches `/portal`.
3. Signing in with a personal Gmail account is rejected with `not_authorized`.
4. `curl -s localhost:3000/api/portal/me` without a cookie returns 401.
5. `curl -s localhost:3000/robots.txt` disallows `/portal`.

Case 3 is the one that matters. Do not proceed until it demonstrably fails to grant access.

- [ ] **Step 9: Commit**

```bash
git add middleware.ts app/portal app/robots.ts app/api/portal
git commit -m "feat(portal): add protected members-only portal and discoverability controls"
```

---

### Task 7: Portal summary rollups

**Files:**
- Create: `lib/server/summary.ts`, `lib/server/__tests__/summary.test.ts`, `app/api/portal/summary/route.ts`
- Modify: `app/portal/page.tsx`

**Interfaces:**
- Produces: `getPortalSummary(): Promise<PortalSummary>` where

```ts
export type PortalSummary = {
  totalProspects: number;
  byStage: Record<string, number>;
  enrichmentProgress: number;   // 0-1, share of prospects past SOURCED
  outreachThisWeek: number;
  unavailable: boolean;         // true when Twenty could not be reached
};
```

Plan D extends this type with `replyRate`, `awaitingApproval`, and `followUpsDue`. Keep `unavailable` on every return path, including the success path where it is `false`.

- [ ] **Step 1: Write the failing test**

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getPortalSummary } from '../summary';

vi.mock('../twenty-client', () => ({ twentyGraphQL: vi.fn() }));
const { twentyGraphQL } = await import('../twenty-client');

afterEach(() => vi.resetAllMocks());

describe('getPortalSummary', () => {
  it('summarises prospects by stage', async () => {
    vi.mocked(twentyGraphQL).mockResolvedValue({
      prospects: {
        totalCount: 252,
        edges: [
          { node: { stage: 'SOURCED' } },
          { node: { stage: 'SOURCED' } },
          { node: { stage: 'ENRICHED' } },
        ],
      },
      outreaches: { totalCount: 5 },
    } as never);

    const summary = await getPortalSummary();
    expect(summary.totalProspects).toBe(252);
    expect(summary.byStage.SOURCED).toBe(2);
    expect(summary.byStage.ENRICHED).toBe(1);
  });

  it('reports zeroes rather than throwing when Twenty is unreachable', async () => {
    vi.mocked(twentyGraphQL).mockRejectedValue(new Error('down'));
    const summary = await getPortalSummary();
    expect(summary.totalProspects).toBe(0);
    expect(summary.unavailable).toBe(true);
  });
});
```

A dashboard tile must degrade to "unavailable" rather than take the whole portal down when the CRM hiccups.

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run lib/server/__tests__/summary.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Write `getPortalSummary` to issue one GraphQL query fetching `prospects` (with `totalCount` and each node's `stage`) plus an `outreaches` count filtered to `sentAt` within the last seven days. Aggregate stages into a `Record<string, number>`, compute `enrichmentProgress` as the share of prospects past `SOURCED`, and return `{ unavailable: true }` with zeroed counts on any error.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run lib/server/__tests__/summary.test.ts`
Expected: 2 passed.

- [ ] **Step 5: Add the route and tiles**

Create `app/api/portal/summary/route.ts` returning `getPortalSummary()` as JSON (the middleware already guards `/api/portal/*`). Render the tiles in `app/portal/page.tsx`, showing an "unavailable" state when the flag is set.

- [ ] **Step 6: Verify against real data**

With Plan A's import complete, load `/portal`.
Expected: 252 total prospects, all under Sourced.

- [ ] **Step 7: Commit**

```bash
git add lib/server/summary.ts lib/server/__tests__/summary.test.ts app/api/portal/summary app/portal/page.tsx
git commit -m "feat(portal): add prospect rollup tiles"
```

---

### Task 8: Inbound lead capture into Twenty

**Files:**
- Create: `lib/server/leads.ts`, `lib/server/hubspot-mirror.ts`, `lib/server/__tests__/leads.test.ts`, `app/api/leads/inbound/route.ts`

**Interfaces:**
- Produces: `InboundLead { name, email, company, message }`, `captureInboundLead(lead)`, `mirrorToHubSpot(lead, pageUri)`.

- [ ] **Step 1: Write the failing test**

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { captureInboundLead } from '../leads';

vi.mock('../twenty-client', () => ({ twentyRest: vi.fn() }));
const { twentyRest } = await import('../twenty-client');

afterEach(() => vi.resetAllMocks());

const lead = {
  name: 'Ada Lovelace', email: 'ada@acme.test',
  company: 'Acme Corp', message: 'We need agents',
};

describe('captureInboundLead', () => {
  it('creates company, person, prospect, and note', async () => {
    vi.mocked(twentyRest).mockImplementation(async (path: string) => {
      if (path.startsWith('/companies?')) return { data: { companies: [] } } as never;
      if (path.startsWith('/people?')) return { data: { people: [] } } as never;
      if (path === '/companies') return { data: { createCompany: { id: 'c1' } } } as never;
      if (path === '/people') return { data: { createPerson: { id: 'p1' } } } as never;
      if (path === '/prospects') return { data: { createProspect: { id: 'pr1' } } } as never;
      return { data: {} } as never;
    });

    const result = await captureInboundLead(lead);

    expect(result.prospectId).toBe('pr1');
    const paths = vi.mocked(twentyRest).mock.calls.map((c) => c[0]);
    expect(paths).toContain('/companies');
    expect(paths).toContain('/people');
    expect(paths).toContain('/prospects');
  });

  it('derives the company domain from the email', async () => {
    vi.mocked(twentyRest).mockResolvedValue({ data: { companies: [], people: [] } } as never);
    await captureInboundLead(lead).catch(() => undefined);
    const createCall = vi.mocked(twentyRest).mock.calls.find((c) => c[0] === '/companies');
    expect(JSON.stringify(createCall?.[1]?.body)).toContain('acme.test');
  });

  it('marks the prospect as an inbound website lead at SOURCED', async () => {
    vi.mocked(twentyRest).mockImplementation(async (path: string) =>
      (path.includes('?') ? { data: { companies: [], people: [] } } : { data: { x: { id: 'id' } } }) as never);

    await captureInboundLead(lead);
    const call = vi.mocked(twentyRest).mock.calls.find((c) => c[0] === '/prospects');
    const body = String(call?.[1]?.body);
    expect(body).toContain('INBOUND_WEBSITE');
    expect(body).toContain('SOURCED');
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run lib/server/__tests__/leads.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement lead capture**

Write `captureInboundLead` to, in order: derive the domain from the email; look up then create the Company (`domainName`, `name`); look up then create the Person (`emails.primaryEmail`, split `name`, `companyId`, `directEmailStatus: 'FOUND'`); create the Prospect with `stage: 'SOURCED'`, `leadSource: 'INBOUND_WEBSITE'`, and a generated `queueId` of `WEB-<timestamp>`; then create a Note carrying the message, linked to the person. Return `{ companyId, personId, prospectId }`.

Field names must match Plan A's registry exactly.

- [ ] **Step 4: Implement the HubSpot mirror**

```ts
import 'server-only';
import { optionalEnv } from './env';
import type { InboundLead } from './leads';

export const mirrorToHubSpot = async (lead: InboundLead, pageUri: string): Promise<void> => {
  const portalId = optionalEnv('HUBSPOT_PORTAL_ID');
  const formGuid = optionalEnv('HUBSPOT_FORM_GUID');
  if (!portalId || !formGuid) return;

  const [firstname, ...rest] = lead.name.trim().split(/\s+/);

  try {
    await fetch(`https://api.hsforms.com/submissions/v3/integration/submit/${portalId}/${formGuid}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: [
          { name: 'email', value: lead.email },
          { name: 'firstname', value: firstname ?? '' },
          { name: 'lastname', value: rest.join(' ') },
          { name: 'company', value: lead.company },
          { name: 'message', value: lead.message },
        ],
        context: { pageUri, pageName: 'Contact' },
      }),
    });
  } catch (error) {
    console.error('HubSpot mirror failed (non-fatal)', error);
  }
};
```

Every failure path here is swallowed by design — Twenty is authoritative and a HubSpot outage must not cost a lead.

- [ ] **Step 5: Write the route handler**

`app/api/leads/inbound/route.ts` validates the body (all fields present, email shape, message under 5,000 characters), rejects any request where the honeypot field is filled, calls `captureInboundLead`, then fires `mirrorToHubSpot` without awaiting its result. It returns 200 on success and 400 on validation failure, and never echoes internal error details.

- [ ] **Step 6: Run the tests**

Run: `npx vitest run lib/server/__tests__/leads.test.ts`
Expected: 3 passed.

- [ ] **Step 7: Verify against the live CRM**

```bash
curl -fsS -X POST http://localhost:3000/api/leads/inbound \
  -H 'Content-Type: application/json' \
  -d '{"name":"Test Person","email":"test@example.test","company":"Example","message":"hello"}'
```

Confirm in Twenty that a Prospect appears with `leadSource = Inbound website`, then delete the test records.

- [ ] **Step 8: Commit**

```bash
git add lib/server/leads.ts lib/server/hubspot-mirror.ts lib/server/__tests__/leads.test.ts app/api/leads
git commit -m "feat(leads): capture inbound website leads into Twenty with HubSpot mirror"
```

---

### Task 9: Rewire the contact form

**Files:**
- Modify: `app/contact/page.tsx`

**Interfaces:**
- Consumes: `POST /api/leads/inbound`.

- [ ] **Step 1: Replace the third-party POST**

In `app/contact/page.tsx`, replace the direct HubSpot `fetch` at line 47 with a POST to `/api/leads/inbound` sending `{ name, email, company, message, website }`, where `website` is the honeypot.

Delete the client-side HubSpot payload construction entirely — it is now server-side in `hubspot-mirror.ts`. Leaving it would double-submit every lead.

- [ ] **Step 2: Add the honeypot field**

Add a visually hidden input named `website` with `tabIndex={-1}` and `autoComplete="off"`. Hide it with CSS rather than `display: none`, which some bots detect.

- [ ] **Step 3: Keep the existing UX**

Preserve the current button state machine (`Sending…`, success, error, 6-second reset) and the Calendly tab. This task changes only where the data goes.

- [ ] **Step 4: Test in the browser**

Run `npm run dev`, submit the form, and confirm: the success state renders, a Prospect appears in Twenty, and the browser network tab shows a request to `/api/leads/inbound` — with **no** request to `hsforms.com` and no API key in any payload.

- [ ] **Step 5: Delete the test records and commit**

```bash
git add app/contact/page.tsx
git commit -m "feat(contact): route inbound form through our backend into Twenty"
```

---

### Task 10: Twenty webhook receiver

**Files:**
- Create: `app/api/webhooks/twenty/route.ts`, `lib/server/webhook-verify.ts`, `lib/server/__tests__/webhook-verify.test.ts`

**Interfaces:**
- Produces: `verifyWebhookSignature(rawBody, signature, timestamp): boolean`.

- [ ] **Step 1: Confirm Twenty's signature scheme**

Create a test webhook in Twenty (Settings → Webhooks) pointed at a request-capture endpoint and inspect the headers it sends. Record the header names and the signed-payload format in `docs/runbooks/portal-env.md`. Implement against what you observe, not against an assumed scheme.

- [ ] **Step 2: Write the failing test**

Cover: a valid signature passes; a tampered body fails; a missing signature fails; a timestamp older than five minutes fails (replay protection); and comparison is constant-time.

- [ ] **Step 3: Implement verification**

HMAC the raw request body with `TWENTY_WEBHOOK_SECRET` and compare in constant time, mirroring the approach in `session.ts`. Read the **raw** body text before any JSON parsing — parsing and re-serialising changes the bytes and breaks the signature.

- [ ] **Step 4: Implement the route**

Verify the signature, return 401 on failure, deduplicate on the event id, post a Slack message when `SLACK_WEBHOOK_URL` is set, and return 200 quickly. Any processing error still returns 200 with the failure logged, so Twenty does not enter a retry storm.

- [ ] **Step 5: Run the tests and commit**

```bash
npx vitest run lib/server/__tests__/webhook-verify.test.ts
git add app/api/webhooks lib/server/webhook-verify.ts lib/server/__tests__/webhook-verify.test.ts
git commit -m "feat(webhooks): add verified Twenty webhook receiver"
```

---

### Task 11: Deploy

**Files:**
- Modify: `docs/runbooks/portal-env.md`

- [ ] **Step 1: Set Vercel environment variables**

Add every variable from `.env.example` to the Vercel project (Production and Preview). `SESSION_SECRET` and `TWENTY_API_KEY` must differ between environments so a preview deploy cannot mint production sessions.

- [ ] **Step 2: Add the production redirect URI**

Confirm `https://www.fraterailabs.com/api/auth/google/callback` is registered on the Google OAuth client.

- [ ] **Step 3: Deploy and verify**

Push the branch and open a preview deploy. Re-run the five checks from Task 6 Step 8 against the deployed URL, especially the personal-Gmail rejection.

- [ ] **Step 4: Verify the API key is absent from the client bundle**

```bash
npm run build
grep -r "TWENTY_API_KEY" .next/static 2>/dev/null && echo "LEAK — investigate" || echo "clean"
```
Expected: `clean`.

- [ ] **Step 5: Commit and push**

```bash
git add docs/runbooks/portal-env.md
git commit -m "docs: record portal deployment configuration"
git push
```

---

## Definition of Done

- `/portal` is reachable only by signed-in `@fraterailabs.com` accounts that are active Twenty workspace members; a personal Gmail account was tested against the deployed URL and rejected.
- No link to `/portal` exists anywhere in the public site; `robots.txt` disallows it and the pages carry `noindex`.
- The contact form writes to Twenty first and mirrors to HubSpot; a HubSpot outage does not fail submissions.
- `TWENTY_API_KEY` does not appear in the client bundle.
- Portal tiles show 252 prospects and degrade gracefully when Twenty is unreachable.
- `npm test` passes.
