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

Both are saved in the team password manager as of 2026-08-15, so Railway is no longer the
only copy. Keep it that way: losing `ENCRYPTION_KEY` makes every stored credential —
connected mailboxes, app API keys — permanently unrecoverable, and no restore of the
Postgres backup brings them back.

To read a value out again without putting it on screen or in shell history:

```bash
railway variables -p 940081c5-8c75-4649-8a4e-a12681284637 -e production -s twenty-server --kv \
  | grep '^ENCRYPTION_KEY=' | cut -d= -f2- | tr -d '\n' | pbcopy
printf '' | pbcopy   # clear the clipboard afterwards
```

Never run `railway variables --kv` unfiltered where the output is captured or logged.

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

### `twenty apply` can OOM the server

Applying an app manifest triggers GraphQL type regeneration across every object once the
metadata migration commits. On the default Node heap this crashed the container:

```
FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory
```

`NODE_OPTIONS=--max-old-space-size=1024` is now set on both services. Container RSS sits
around 0.72 GB, so there is headroom, but every object added to the app makes type
generation heavier — watch memory when applying and raise the limit if it recurs.

**A crash here does not corrupt the schema.** The metadata migration is transactional and
commits *before* type generation runs, so the manifest is applied even if the process then
dies. After any crash during apply, wait ~90 s for the restart and run `npx twenty plan` —
"No changes" means the apply landed.

### App deployment

The `twenty` CLI is registered against this server as remote **`frater-prod`**
(`npx twenty remote:list`). Credentials live in `~/.twenty/config.json`, which the CLI
creates world-readable — it has been chmod'ed to 600, and should be re-checked after any
`remote:add`.

```bash
cd twenty-app
npx twenty plan     # read-only diff, Terraform-style
npx twenty apply    # applies after showing the same plan
```

There is no `yarn deploy` or `twenty app deploy`; those appear in older docs.

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

## Staging environment

Railway environment **`staging`** (`8ed9e966-c6bd-4e9c-b2f7-da1692420499`) in the same
project, forked from production.

- URL: `https://twenty-server-staging-361b.up.railway.app` (no custom domain — deliberate;
  a staging hostname in public certificate-transparency logs is free reconnaissance)
- `AUTH_GOOGLE_ENABLED=false` — password auth only, so staging needs no OAuth redirect URI
  and cannot be reached with production Google credentials

**Isolation was verified, not assumed** — a staging that quietly shares production's
database is worse than no staging at all:

| Resource | Check |
|---|---|
| Postgres | `PG_DATABASE_URL` hashes differ between environments |
| Redis | `REDIS_URL` hashes differ |
| Bucket | `frater-crm-storage-tpvosc` (prod) vs `frater-crm-storage-nmgxe7` (staging) |
| `APP_SECRET` | freshly generated, differs from production, identical across staging's own server and worker |
| `ENCRYPTION_KEY` | same |

Fresh secrets matter beyond tidiness: reusing production's `ENCRYPTION_KEY` would mean a
staging compromise could decrypt production credentials.

Isolation works because Task 1 wired the database and bucket as Railway *variable
references* (`${{Postgres.DATABASE_URL}}`) rather than literal values — forking an
environment re-resolves them against that environment's own services. Hardcoded values
would have silently pointed staging at production.

### Remaining step: create the staging admin account

`twenty apply` needs an API key, and an API key needs an account. Twenty's auth mutations
are not served on `/graphql` (the record API), so this cannot be scripted from here.

1. Open the staging URL, sign up with any address and a strong password (this workspace is
   throwaway; it is not domain-locked)
2. Settings → APIs → create a key named `frater-staging`
3. Store it: `pbpaste | tr -d '\n\r \t' > .env.twenty-staging.local && chmod 600 .env.twenty-staging.local`
4. Register the remote and deploy the schema:

```bash
cd twenty-app
npx twenty remote:add --as frater-staging \
  --url https://twenty-server-staging-361b.up.railway.app \
  --api-key "$(cat ../.env.twenty-staging.local)"
npx twenty plan  --remote frater-staging     # expect the full create plan
npx twenty apply --remote frater-staging
```

Then seed it by pointing the importer at staging:

```bash
TWENTY_BASE_URL=https://twenty-server-staging-361b.up.railway.app \
TWENTY_API_KEY="$(cat .env.twenty-staging.local)" \
  npx tsx scripts/import-prospects/import.ts --apply
```

Staging carries the default 100 req/min rate limit, so a full 252-row seed takes 25+
minutes on backoff. Raise `API_RATE_LIMITING_LONG_LIMIT` on the staging server for the
seed if you want it fast — and unlike production, there is no urgency to put it back.

### What staging is for

Rehearse anything that touches schema or spends money **here first**: Twenty version
upgrades, `twenty apply` of new objects or fields, and — most importantly — Plan C's
enrichment agents, which cost roughly \$85 per full pass over 252 prospects and write to
real records.

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

**Task 1 — infrastructure: complete**

- [x] Services provisioned and healthy; 182 migrations applied
- [x] Custom domain registered; Namecheap CNAME + TXT propagated; certificate issued
- [x] `https://crm.fraterailabs.com` serves with a valid certificate
- [x] Admin account created — `fraterai@fraterailabs.com` (Miguel Twahirwa), workspace `b51d41d5-f94b-420c-9278-d62eaf25d5db`
- [x] Workspace API key minted, verified against REST and GraphQL
- [x] First API key revoked after transcript exposure; replacement in `.env.twenty.local` (old key confirmed returning 403)
- [x] REST filter grammar, POST envelope, and composite-field round-trip verified against the live server

**Task 2 — access control: complete**

- [x] Google OAuth client created, consent screen `Internal`
- [x] `AUTH_GOOGLE_*` set on both services; Google sign-in tested and working
- [x] `AUTH_PASSWORD_ENABLED=true` — deliberately on, as break-glass and as the only route for outside-domain invitees
- [x] Non-member rejection tested: a personal Gmail was blocked at Google
- [x] No approved access domain added — deliberate; it would only enable self-join
- [x] `workspaceDiscoverability` not a live control here, since no approved domain exists
- [x] Owner mapping resolved: `Seth` is a business partner sharing `fraterai@fraterailabs.com`, the single workspace member

**Outstanding**

- [x] `APP_SECRET` and `ENCRYPTION_KEY` copied into the team password manager (2026-08-15).
      Verified before copying that both services hold identical values (compared SHA-256
      prefixes, not the values). Railway is no longer the only copy.
- [x] Twenty's 16 seed/demo records deleted before the import (5 companies, 5 people,
      6 opportunities), so the 218/252 gate measured only real data
- [ ] **Confirm Railway's backup policy for this account.** The CRM now holds the entire
      pipeline — 252 prospects, 218 companies, 756 outreach drafts. Managed-Postgres backup
      retention depends on the Railway plan and has not been verified for this account.
      Take a manual dump before any Twenty version upgrade regardless.
- [~] Task 14: staging environment — **infrastructure done and isolation verified**; needs
      an admin account created in the browser before the app package can be deployed to it
- [x] Tasks 3-7 complete: `twenty-app` deployed — Prospect and Outreach objects, 16 custom
      fields on Company and Person, three two-sided relations incl. owner, and the Pipeline
      kanban view with sidebar navigation. `npx twenty plan` reports no drift.
- [x] Contract check passed: a payload built by the real importer from row EV-001 was
      accepted by all four objects (201 each) and cleaned up — the deployed schema and the
      already-merged importer agree.
- [x] **Task 13 complete — the spreadsheet is retired.** 16 seed records deleted; 252
      prospects, 218 companies, 252 people and 756 outreach drafts imported and verified
      against the live API with pagination. A second full run created 0 and updated all
      1,478, proving idempotency against production.

### Rate limiting is the thing that will bite you here

Twenty limits the REST API to **100 requests per 60s** (`API_RATE_LIMITING_LONG_LIMIT` /
`API_RATE_LIMITING_LONG_TTL_IN_MS`, plus a 100-per-1s short bucket). A full import issues
roughly ten requests per row — about 2,500 — so at the default it takes 25+ minutes and
spends most of that in backoff. The first live attempt failed after 8 rows before retry
handling existed.

For a bulk load, raise it temporarily and **put it back afterwards**:

```bash
railway variables -p <project> -e production -s twenty-server --set "API_RATE_LIMITING_LONG_LIMIT=5000"
railway redeploy  -p <project> -e production -s twenty-server -y
# … run the import (took 4m49s at this limit) …
railway variable delete -p <project> -e production -s twenty-server API_RATE_LIMITING_LONG_LIMIT
railway redeploy -p <project> -e production -s twenty-server -y
```

The importer retries 429s with adaptive backoff, so it completes either way — the raised
limit only makes it fast. Note that ordinary verification queries (a paginated count over
218 companies is ~5 requests) also consume the quota, so a count immediately followed by
another operation can push you into throttling.

- [x] Suppression list applied — **verified no-op**: 0 of the 50 suppression entries match
      any of the 218 imported companies (confirmed by local set comparison and by the
      importer's `--suppress` dry run reporting `50 entries, 0 matched, 0 marked`). The
      list exists to keep that true as enrichment adds companies; re-run
      `--suppress --apply` after any run that adds them.
- [~] Task 14: staging — infrastructure up, awaiting an admin account (see Staging below)

## Staging environment

Railway environment **`staging`** (`8ed9e966-c6bd-4e9c-b2f7-da1692420499`) in the same
project, forked from production.

- URL: `https://twenty-server-staging-361b.up.railway.app` (no custom domain — deliberate;
  a staging hostname in public certificate-transparency logs is free reconnaissance)
- `AUTH_GOOGLE_ENABLED=false` — password auth only, so staging needs no OAuth redirect URI
  and cannot be reached with production Google credentials

**Isolation was verified, not assumed** — a staging that quietly shares production's
database is worse than no staging at all:

| Resource | Check |
|---|---|
| Postgres | `PG_DATABASE_URL` hashes differ between environments |
| Redis | `REDIS_URL` hashes differ |
| Bucket | `frater-crm-storage-tpvosc` (prod) vs `frater-crm-storage-nmgxe7` (staging) |
| `APP_SECRET` | freshly generated, differs from production, identical across staging's own server and worker |
| `ENCRYPTION_KEY` | same |

Fresh secrets matter beyond tidiness: reusing production's `ENCRYPTION_KEY` would mean a
staging compromise could decrypt production credentials.

Isolation works because Task 1 wired the database and bucket as Railway *variable
references* (`${{Postgres.DATABASE_URL}}`) rather than literal values — forking an
environment re-resolves them against that environment's own services. Hardcoded values
would have silently pointed staging at production.

### Remaining step: create the staging admin account

`twenty apply` needs an API key, and an API key needs an account. Twenty's auth mutations
are not served on `/graphql` (the record API), so this cannot be scripted from here.

1. Open the staging URL, sign up with any address and a strong password (this workspace is
   throwaway; it is not domain-locked)
2. Settings → APIs → create a key named `frater-staging`
3. Store it: `pbpaste | tr -d '\n\r \t' > .env.twenty-staging.local && chmod 600 .env.twenty-staging.local`
4. Register the remote and deploy the schema:

```bash
cd twenty-app
npx twenty remote:add --as frater-staging \
  --url https://twenty-server-staging-361b.up.railway.app \
  --api-key "$(cat ../.env.twenty-staging.local)"
npx twenty plan  --remote frater-staging     # expect the full create plan
npx twenty apply --remote frater-staging
```

Then seed it by pointing the importer at staging:

```bash
TWENTY_BASE_URL=https://twenty-server-staging-361b.up.railway.app \
TWENTY_API_KEY="$(cat .env.twenty-staging.local)" \
  npx tsx scripts/import-prospects/import.ts --apply
```

Staging carries the default 100 req/min rate limit, so a full 252-row seed takes 25+
minutes on backoff. Raise `API_RATE_LIMITING_LONG_LIMIT` on the staging server for the
seed if you want it fast — and unlike production, there is no urgency to put it back.

### What staging is for

Rehearse anything that touches schema or spends money **here first**: Twenty version
upgrades, `twenty apply` of new objects or fields, and — most importantly — Plan C's
enrichment agents, which cost roughly \$85 per full pass over 252 prospects and write to
real records.

## Owner mapping

`Owner` is `Seth` on all 252 sheet rows. Seth is a business partner who shares the
`fraterai@fraterailabs.com` account rather than holding his own, so all 252 prospects map
to the single workspace member below. Task 13's owner resolution should match on that one
member.

| Sheet `Owner` | Twenty workspace member | Member id |
|---|---|---|
| `Seth` | `fraterai@fraterailabs.com` | `2227b3f6-a7b9-4f31-a777-5166c672a607` |

A shared login means CRM actions cannot be attributed to a specific person and portal
access cannot distinguish the two of you. That was a deliberate choice, not an oversight —
revisit if a third person joins.

## Importing prospects

`scripts/import-prospects/import.ts`, run as `npm run import:prospects`, is the CLI that
retires the spreadsheet. It composes the already-tested parser, normalizers, plan
builder, and upserter (`scripts/import-prospects/{parse-workbook,normalize,build-plan,
apply-plan}.ts`) and resolves the sheet's free-text `Owner` column to a real
`prospect.owner` relation before writing anything (`resolve-owners.ts`).

### Env vars

```bash
export TWENTY_BASE_URL=https://crm.fraterailabs.com
export TWENTY_API_KEY="$(cat .env.twenty.local)"
```

`WORKBOOK_PATH` optionally overrides the default
`scripts/import-prospects/fixtures/prospects.xlsx` (gitignored — the real 252-row sheet).

### Dry-run first, always

The CLI is dry-run **by default**; it only writes with an explicit `--apply` flag:

```bash
npm run import:prospects            # dry run — read-only, prints what it would do
npx tsx scripts/import-prospects/import.ts --apply   # live write
```

Never run `--apply` without having read the preceding dry run's full output — warnings
included. A dry run never calls `client.create`/`client.update`; the only network call it
makes is a read-only `GET /workspaceMembers` for owner resolution.

### Expected numbers (the acceptance gate)

From the real 252-row workbook, against an **empty** CRM (all seed/demo records
deleted first — see the seed-data warning above):

- Parsed: **252 rows**, **50 suppressed companies**
- **218** unique companies, **252** people (one per row), **0** rows with a direct email
- `wouldCreate`: `{ companies: 218, people: 252, prospects: 252, outreaches: 756 }`
  (three outreach drafts per prospect — connection note, follow-up, cold email — wherever
  the sheet has copy for that channel; a handful of rows are missing one or more, which is
  why it's not exactly 3 × 252)
- **~89 warnings** from `buildPlan`, all informational — none of them block the import:
  - ~86 are "Website is a search URL, not a domain" — the sheet's `Website` column holds
    a Google search link instead of a real domain for those companies. The link is kept
    in `researchLinks` so it isn't lost, just excluded from `domainName`.
  - ~3 are "person name appears under N companies" — the same lead name recurs across
    multiple companies in the sheet (e.g. `Founder to verify` across 10 CMU rows). Each
    is imported as a separate person scoped to its own company, and the warning exists so
    a human can confirm that's correct rather than an accidental duplicate merge.
- Owner resolution: `"Seth" -> 1 workspace member` (falls back to the sole member,
  `fraterai@fraterailabs.com`, since "Seth" doesn't literally match the recorded name),
  **0 unmatched**.

If any of these numbers disagree with a dry run, stop and investigate — don't adjust the
expectation to match the output.

### Idempotency check

Because `prospects.queueId` and the company/person filters are the import's identity keys,
running the importer twice must **update**, not duplicate:

```bash
npx tsx scripts/import-prospects/import.ts --apply   # first run: created counts match wouldCreate, 0 failures
npx tsx scripts/import-prospects/import.ts --apply   # second run: created all zero, updated non-zero
```

After the second run, confirm in the Twenty UI that Prospects still shows **252**, not
504, and Companies still shows **218**, not 436. This is the single most important check
in the whole import — a duplicate-creating importer is worse than no importer.

`prospects.ownerId` is deliberately **create-only** (see the `CREATE_ONLY_FIELDS` comment
in `apply-plan.ts`): the sheet's `Owner` text resolves to the same member id on every run,
so if a human reassigns a prospect to a different workspace member inside Twenty, a
re-import must not silently drag it back to the sheet's owner. The same protection already
existed for `stage`, `directEmailStatus`, and outreach `status`/`generatedBy`/`model` —
`ownerId` follows the same rule for the same reason.
