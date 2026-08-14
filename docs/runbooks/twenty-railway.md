# Runbook — Twenty CRM on Railway

**Provisioned:** 2026-08-13
**Plan:** `docs/superpowers/plans/2026-08-12-crm-a-foundation.md` (Task 1)

## What is running

Railway project **`frater-crm`** (`940081c5-8c75-4649-8a4e-a12681284637`), environment
**production** (`0fc8e661-b172-40c6-adfd-5643040737fa`), in the personal workspace
*Miguel Twahirwa's Projects*.

| Service | Source | Notes |
|---|---|---|
| `twenty-server` | `twentycrm/twenty:v2.31.1` | Image `CMD` (`node dist/main`); healthcheck `/healthz`, 300s; restart ALWAYS |
| `twenty-worker` | `twentycrm/twenty:v2.31.1` | Start command `yarn worker:prod`; migrations and cron registration disabled |
| `Postgres` | Railway managed template | Provides `DATABASE_URL` |
| `Redis` | Railway managed template | Provides `REDIS_URL` |
| `frater-crm-storage` | Railway bucket, region `iad` | S3-compatible object storage |

**Why the image tag is pinned.** `v2.31.1` was the latest published tag at provisioning
time. Pinning rather than tracking `latest` means an upstream release cannot restart your
CRM onto a new version unattended. Upgrades are a deliberate edit to both services'
image tags, followed by a redeploy of the server first (it runs the migrations).

**Why services were created manually rather than from a template.** No Twenty-published
Railway template exists — only community ones, whose pinned image tags cannot be
inspected before deploying. The services above reproduce Twenty's official
`packages/twenty-docker/docker-compose.yml` exactly, with the tag under our control.

**Why plain `postgres:16` is correct.** Twenty's `setup-db.ts` unconditionally requires
only `uuid-ossp` and `unaccent`, both in stock Postgres contrib. The `postgres_fdw`,
`wrappers`, and `mysql_fdw` extensions — the reason Twenty ships a custom
`twenty-postgres-spilo` image — sit behind `IS_FDW_ENABLED`, which we do not set and
which upstream marks as paused work. Do not set `IS_FDW_ENABLED=true` without switching
to an image that carries those extensions.

**Why S3 rather than a volume.** Twenty's compose shares one storage volume between
server and worker. Railway volumes attach to a single service, so a shared volume is not
possible; both services point at the Railway bucket instead.

## URLs

- Canonical: `https://crm.fraterailabs.com` — this is `SERVER_URL` on both services
- Railway fallback: `https://twenty-server-production-ccfd.up.railway.app`

The fallback is useful for health checks, but **do not create the admin account or sign in
through it** while `SERVER_URL` points at the custom domain — auth redirects are built
from `SERVER_URL` and will send you to the wrong host.

## DNS

Two records on `fraterailabs.com`:

| Type | Name | Value |
|---|---|---|
| CNAME | `crm` | `6zth7lut.up.railway.app` |
| TXT | `_railway-verify.crm` | `railway-verify=55f5c8fcdf4c96a7046c9f3f9e5a000e1e694c43605235891852b38e54780ce3` |

If the CNAME is proxied (Cloudflare orange cloud), certificate issuance will fail — set it
to DNS-only until Railway reports the certificate as issued.

## Secrets

`APP_SECRET` and `ENCRYPTION_KEY` are set **identically on both** `twenty-server` and
`twenty-worker`. They must stay in sync; a mismatch breaks session validation and
credential decryption.

They were generated with `openssl rand -base64 32` and written straight into Railway via
`railway variables --set-from-stdin`, so the values never appear in a shell history or a
transcript.

**Copy both from the Railway dashboard into the team password manager.** Railway is
currently the only place they exist. Losing `ENCRYPTION_KEY` makes every stored
credential — connected mailboxes, app API keys — permanently unrecoverable; no
restore of the Postgres backup will bring them back.

To rotate `ENCRYPTION_KEY` later, set the current value as `FALLBACK_ENCRYPTION_KEY`
first so existing ciphertext stays readable during the transition.

Database, Redis, and bucket credentials are **not** copied anywhere — they are wired as
Railway variable references (`${{Postgres.DATABASE_URL}}`, `${{Redis.REDIS_URL}}`,
`${{frater-crm-storage.*}}`) and resolve at deploy time.

## How access control actually works in v2.31.1

**`IS_SIGN_UP_DISABLED` does not exist in this version.** It appears in Twenty's older
docs and in Plan A's original Task 2 text, but no such config variable is defined in
`config-variables.ts`. Setting it is a silent no-op. It was set and then removed here so
nobody mistakes it for a control.

Joining a workspace requires one of exactly two things
(`user-workspace.service.ts: findAvailableWorkspacesByEmail`):

1. **A validated approved access domain** matching the email's domain, **and** the
   workspace's `workspaceDiscoverability` set to `PUBLIC`; or
2. **An explicit invitation** to that address, with the workspace not `HIDDEN`.

`workspaceDiscoverability` values are `PUBLIC`, `MEMBERS_AND_INVITEES`, and `HIDDEN`.
Note the asymmetry: an approved access domain only auto-admits when the workspace is
`PUBLIC`. With `MEMBERS_AND_INVITEES`, the domain does not grant entry on its own and
invitations remain the only route — which is the stricter posture and appropriate for a
two-person team.

Consequently a stranger who reaches the sign-up form can create a **user record with no
workspace** — noise, and a verification email — but cannot reach any CRM data. That is a
materially smaller exposure than "signup is open" implies.

The real password toggle is `AUTH_PASSWORD_ENABLED` (default `true`), which does exist.
It was briefly set to `false` and then deliberately restored to `true` — see "Auth
providers" below.

### Why no approved access domain was added

Plan A Task 2 called for adding `fraterailabs.com` as an approved access domain, carried
over from the spec's "domain-locked" framing. On v2.31.1 that step would **weaken** the
posture, not strengthen it.

An approved access domain grants entry only when the workspace is also `PUBLIC`, and its
effect is to let anyone holding an address at that domain admit themselves without an
invitation. With no approved domain configured, the only route in is an explicit
invitation — strictly tighter, and it still satisfies "only Frater members get in".

The team is two people sharing one account, so the self-join convenience buys nothing.
Add an approved domain only if you later want new `@fraterailabs.com` staff to onboard
themselves without being invited, and understand that you are trading a control for that
convenience.

### Auth providers: both are live, deliberately

`AUTH_GOOGLE_ENABLED=true` and `AUTH_PASSWORD_ENABLED=true`.

Password auth was re-enabled on purpose, for two reasons. It is the break-glass path if
the Google OAuth client breaks, and — less obviously — it is the **only** way an invited
collaborator without an `@fraterailabs.com` address can sign in at all, because the
Internal consent screen blocks non-Workspace accounts at Google.

| Provider | Admits |
|---|---|
| Google | Workspace accounts on `fraterailabs.com` that are workspace members |
| Password | Any invited member, any email domain |

The owner's original signup password is therefore a live second door into the CRM, not a
bootstrap leftover. Keep it strong and in the password manager.

### Inviting collaborators outside the domain

Twenty invitations carry **no** email-domain restriction — verified in
`workspace-invitation.service.ts`, which never consults approved access domains. Any
address can be invited and will become a full workspace member.

Such a collaborator can use the CRM with a password. Reaching the Plan B portal requires
their address in `PORTAL_EMAIL_ALLOWLIST` and uses **magic-link sign-in** (Plan B Task 5b),
not Google — the Internal consent screen would refuse them before the portal's own gate is
consulted, and switching to `External` would only help collaborators whose address happens
to be a Google account. The consent screen stays `Internal`.

### Recovering from a lockout

Password auth is enabled, so a broken Google OAuth client — secret rotated, consent screen
changed, project deleted — does **not** lock anyone out: sign in with email and password
instead.

If password auth is ever turned off again, that safety net goes with it. Recovery would
then be to set `AUTH_PASSWORD_ENABLED=true` on `twenty-server` in Railway and redeploy.
Railway access is therefore the break-glass path and must not itself depend on the CRM.

### Ordering trap when locking down

**Do not set `AUTH_PASSWORD_ENABLED=false` until a Google sign-in has actually succeeded.**
Password is currently the only working provider; disabling it before Google is verified
locks everyone out of the workspace, including the owner.

Correct order: configure `AUTH_GOOGLE_*` → redeploy → sign in with Google successfully →
only then disable password auth.

## Operations

Status of everything:
```bash
railway status -p 940081c5-8c75-4649-8a4e-a12681284637 -e production
```

Logs (the worker is silent when idle — that is normal, not a fault):
```bash
railway logs -p 940081c5-8c75-4649-8a4e-a12681284637 -e production -s twenty-worker
```

Health:
```bash
curl -fsS https://crm.fraterailabs.com/healthz
```

Variable names for a service, without printing values:
```bash
railway variables -p 940081c5-8c75-4649-8a4e-a12681284637 -e production -s twenty-server --kv | sed 's/=.*//'
```

Never run `railway variables --kv` unfiltered where the output is captured — it prints
secrets in plain text.

### Startup ordering

The worker boots faster than the server finishes migrating, so on a cold start it logs
`relation "core.keyValuePair" does not exist` for roughly 30 seconds and then recovers.
This is expected on first deploy and after any upgrade that adds migrations. It is only a
real fault if the errors continue after the server logs
`Executed N legacy migration(s)`.

### Upgrades

1. Rehearse in staging (Task 14) first.
2. Bump the tag on `twenty-server`, redeploy, wait for the migration log line.
3. Bump the tag on `twenty-worker`, redeploy.

The server owns migrations (`DISABLE_DB_MIGRATIONS` unset); the worker has them disabled.
Upgrading the worker first can have it running against a schema it does not understand.

### Backups

Postgres is the Railway managed template, so backups follow Railway's plan-level policy —
**verify what that policy actually is for this account before the CRM holds real
pipeline data**, and take a manual dump before any upgrade.

## Google OAuth

Client lives in Google Cloud project **FraterAI labs CRM**. Consent screen must be
**Internal** — External would require Google verification and would let any Google account
reach the consent screen.

Consent-screen **Authorized domains** take bare registrable domains only
(`fraterailabs.com`), which covers both `crm.` and `www.` subdomains. Full URLs with paths
are rejected there with "must be a top private domain" — those belong in the client's
**Authorized redirect URIs** instead:

```
https://crm.fraterailabs.com/auth/google/redirect
https://crm.fraterailabs.com/auth/google-apis/get-access-token
https://www.fraterailabs.com/api/auth/google/callback   (Plan B portal)
```

One client serves both the CRM and the portal, which is what makes the portal → CRM hop a
single "Continue as…" click.

Credentials are stored locally, gitignored, at `.env.google-id.local` and
`.env.google-secret.local`, and were written into Railway via `--set-from-stdin`.

`AUTH_GOOGLE_CALLBACK_URL` on the server must match a registered redirect URI
character-for-character, or sign-in fails with `redirect_uri_mismatch`.

## Owner mapping

The prospect sheet's `Owner` column contains `Seth` on all 252 rows. Task 6 defines a
`prospect.owner` relation to the standard `workspaceMember` object, and Task 13 resolves
that name against real members — so the person behind "Seth" must be invited in Task 2
before the import runs.

| Sheet `Owner` | Twenty workspace member |
|---|---|
| `Seth` | Business partner — _address to be filled in during Task 2_ |

## Verified against the live instance (2026-08-13)

These retire the top three items of the first-live-run checklist in the Plan A final
review. All were previously unverifiable because no server existed.

**REST filter grammar works, and genuinely evaluates.** This was the highest-risk unknown:
if filters silently matched nothing, every import run would create duplicates while
reporting success.

| Query | Result |
|---|---|
| `name[eq]:Notion` | matched 1 |
| `name[eq]:ZzzNoSuch` | matched 0 |
| `name.firstName[eq]:Ivan,name.lastName[eq]:Zhao` | matched 1 |
| `name.firstName[eq]:Ivan,name.lastName[eq]:ZzzWrong` | **matched 0** |

The last row is the one that matters — the comma-AND is really applied, not ignored. Both
raw brackets and `encodeURIComponent`-encoded forms work, so `twenty-rest.ts` is correct
as written.

**POST envelope is `{ data: { createCompany: {...} } }`.** So `apply-plan.ts`'s
`Object.values(created.data)[0].id` yields a real id string — the failure mode behind
finding I3 does not occur on this version.

**Composite fields round-trip.** `domainName` written as `{primaryLinkUrl}` reads back as
`{primaryLinkLabel, primaryLinkUrl, secondaryLinks}`.

**GraphQL `workspaceMembers` works** with the exact query Plan B's membership gate uses
(`edges { node { id userEmail name { firstName lastName } } }`).

When testing filters with curl, pass `-g/--globoff` — curl otherwise treats `[` and `]`
as a glob range and never sends the request.

## ⚠️ Seed data must be deleted before the import

Twenty seeded the new workspace with demo records: **5 companies, 5 people, 6
opportunities** (Notion, Airbnb, Figma, Stripe, Anthropic and their founders).

Task 13's acceptance gate expects exactly 218 companies and 252 people. Leaving the seed
data in place makes those numbers 223 and 257, so the gate would fail — or worse, be
"corrected" to the wrong expectation. Delete all demo records before the first
`--apply`, and re-confirm the counts are zero beforehand.

## Status

- [x] Services provisioned and healthy; 182 migrations applied
- [x] Custom domain registered in Railway
- [x] DNS records created at Namecheap (CNAME + TXT), both propagated
- [x] Certificate issued; `https://crm.fraterailabs.com` serves with a valid cert
- [x] Admin account created — `fraterai@fraterailabs.com` (Miguel Twahirwa), workspace `b51d41d5-f94b-420c-9278-d62eaf25d5db`
- [x] Workspace API key minted and verified against REST + GraphQL
- [ ] **Replace the first API key** — it was pasted into a chat transcript; revoke and re-mint
- [ ] Delete the 16 seed/demo records
- [x] Google OAuth client created (Internal); `AUTH_GOOGLE_*` set on both services
- [x] `authProviders.google = true` confirmed on the live instance
- [x] Google sign-in tested end to end and works
- [x] `AUTH_PASSWORD_ENABLED=false` — Google is the only auth provider
- [x] First API key revoked (old key returns 403) and replaced
- [x] **No approved access domain added — deliberate, see below**
- [x] Password auth re-enabled as break-glass and for outside-domain invitees
- [x] Non-member rejection **tested and passing** — a personal Gmail was blocked at Google
- [x] `workspaceDiscoverability` — not a live control here: with no approved access domain
      configured, `PUBLIC` grants nothing, so no setting was required. Revisit only if an
      approved domain is ever added.
- [ ] Seth invited and owner mapping filled in
