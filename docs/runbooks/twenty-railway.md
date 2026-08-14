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

## ⚠️ Open bootstrap window — close in Task 2

To allow the first admin account to be created before Google OAuth exists, the server is
temporarily running with:

```
AUTH_PASSWORD_ENABLED=true
IS_SIGN_UP_DISABLED=false
```

**Anyone who reaches the URL right now can create an account.** Task 2 must flip these to
`false` and `true` respectively, add the approved access domain, and enable Google OAuth.
Until then, treat the instance as open.

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

## Owner mapping

The prospect sheet's `Owner` column contains `Seth` on all 252 rows. Task 6 defines a
`prospect.owner` relation to the standard `workspaceMember` object, and Task 13 resolves
that name against real members — so the person behind "Seth" must be invited in Task 2
before the import runs.

| Sheet `Owner` | Twenty workspace member |
|---|---|
| `Seth` | Business partner — _address to be filled in during Task 2_ |

## Status

- [x] Services provisioned and healthy; 182 migrations applied
- [x] Custom domain registered in Railway
- [x] DNS records created at Namecheap (CNAME + TXT), both propagated
- [x] Certificate issued; `https://crm.fraterailabs.com` serves with a valid cert
- [ ] Admin account created
- [ ] Workspace API key minted
- [ ] Bootstrap window closed (Task 2)
