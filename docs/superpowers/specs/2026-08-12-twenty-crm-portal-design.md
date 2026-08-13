# Twenty CRM — Members-Only Portal Integration

**Date:** 2026-08-12
**Branch:** `feat/twenty-crm-portal`
**Status:** Approved design, ready for implementation planning

---

## 1. Purpose

Frater AI Labs runs its customer-acquisition motion out of a spreadsheet. This design
replaces that spreadsheet with a self-hosted [Twenty](https://github.com/twentyhq/twenty)
CRM, reachable only by Frater AI Labs members through a private portal on the existing
site, and extended with AI agents that automate the parts of the motion that are
currently manual.

The five workflows this must serve:

1. How we reach out to customers
2. How we qualify leads
3. How we follow up
4. How we close sales
5. How we report on progress

The portal is internal tooling. It is never linked from the marketing site and never
exposed to customers.

## 2. Starting point

### 2.1 The Frater AI Labs codebase

A purely static Next.js 16 / React 19 marketing site on the App Router.

- No backend of any kind: no API routes, no database, no auth, no sessions
- Styling is a hand-written 1,467-line `app/globals.css` using CSS variables;
  Tailwind v4 is installed but effectively unused
- Lead capture is client-side only — `app/contact/page.tsx:47` POSTs directly from
  the browser to a HubSpot forms endpoint, alongside a Calendly embed
- Deployed on Vercel at `fraterailabs.com`

### 2.2 Twenty

An Nx monorepo of roughly 28,000 files: NestJS + GraphQL server, React frontend.
Requires Node 24, Yarn 4, PostgreSQL 16, Redis, and a separate worker process. It
self-hosts as four Docker services.

Findings that shaped this design:

| Capability | Availability |
|---|---|
| Google / Microsoft OAuth login | AGPL — free |
| `approved-access-domain` (lock workspace to an email domain) | AGPL — free |
| Invitation-only workspace membership | AGPL — free |
| **OIDC / SAML SSO** | **Enterprise-licensed — not free** |
| AI agents, skills, chat, tool-calling, code interpreter, cost monitoring | AGPL — free |
| Anthropic provider, incl. `claude-opus-5` / `claude-sonnet-5` | Supported natively |
| App framework (`twenty-sdk` + `twenty-cli`) | AGPL — free |
| Exa (web search) and People Data Labs (enrichment) apps | Free; use **our own API keys** via secret `serverVariables` |

Licensing: AGPL-3.0 with 308 files carved out under a commercial Enterprise licence.

### 2.3 The prospect spreadsheet

`Frater_AI_Labs_Public_Web_CMU_Emory_Prospects_v6_All_Emory_CMU_Startups.xlsx` is the
live system of record. Analysis of its six sheets:

| Sheet | Rows | Role |
|---|---|---|
| **All Evidence Leads** | **252** | **Master** — 200 `EV-*` + 52 `CMU-*` |
| CMU Startup Additions | 52 | Strict subset of master (all 52 Queue IDs already present) |
| Alumni Lead View | 252 | A view of the master; no Queue ID column |
| Prior 50 Exclusion | 50 | Suppression list; zero overlap with master |
| Dashboard | 13 | Rollup metrics |
| Research Notes | 11 | Commentary |

Importing all sheets would create ~556 records for 252 real prospects. **Import from
`All Evidence Leads` only.**

Data profile of the 252:

- Emory 156 / CMU 96
- 218 unique companies (34 rows share an account → multi-contact companies)
- Owner is `Seth` on all 252; Status is `Not Contacted` on all 252
- **`Direct Email` is empty on all 252**; `Direct Email Status` is
  `Enrichment required` on all 252 — enrichment is a total blocker
- Headcount: 200 `Needs headcount verification`, 52 `Likely startup; verify 50–500`
  → the ICP is **50–500 headcount**
- **All 252 `Company LinkedIn / Lookup` values are Google *search* URLs**, not
  LinkedIn profiles. The same is true of `Alumni Evidence Search` and
  `Target Person Search`.
- `Alumni Path` has **27 distinct variants** across the 252 rows. The two most
  common are `Decision-maker alumni` (128) and `Referral alumni` (47); the
  remaining 25 are long-tail blends such as
  `Decision-maker / Goizueta career ops connection` and
  `Referral / CMU Project Olympus connection`. Every one begins with either
  `Decision-maker` (166 rows) or `Referral` (86 rows), which is what makes
  prefix matching — rather than an enumerated list — the correct
  normalization strategy.

### 2.4 The motion the columns describe

1. **Research** — find a named decision-maker who is a CMU or Emory alum, backed by an
   `Evidence URL` and `Evidence Summary`. Qualification is evidence-backed, not scraped.
2. **Qualify** — verify person, company, school, and headcount against the 50–500 ICP.
3. **Enrich** — find the direct email. Currently 0% complete.
4. **Personalize** — derive a `Recommended AI Workflow` for the account, then draft a
   LinkedIn connection note (tracked at 123–129 characters), a follow-up, and a cold
   email subject and body.
5. **Track** — `Owner`, `Status`, `Notes`.
6. **Report** — the Dashboard sheet.

## 3. Decisions

| # | Decision | Rationale |
|---|---|---|
| D1 | Self-host Twenty; members reach **Twenty's own UI** behind our login | Full CRM capability on day one; no re-implementation of tables, views, workflows, or AI chat |
| D2 | Host on **Railway** | Verified Twenty templates including worker + S3; managed Postgres and Redis; private networking; account already authenticated |
| D3 | Backend = **Next.js route handlers** + a **Twenty app package** | No third service for CRM concerns; business logic and AI live as versioned code in the same repo |
| D4 | Identity = **Google Workspace** on the company domain | Free on both sides, no Enterprise licence, and unlocks free Gmail/Calendar sync |
| D5 | **Migrate all 252 rows** in scope; team leaves Excel | The spreadsheet is the live system of record |
| D6 | Inbound leads go **directly into Twenty**; HubSpot kept as a best-effort mirror | Leads land where the team works and trigger workflows; API key leaves the browser; mirror de-risks the transition |
| D7 | AI layer is **hybrid** — Twenty-native agents plus an external Claude Agent SDK service | Native for interactive daily use; external for long-running research |
| D8 | **All six layers in scope**, sequenced into eight milestones | User decision, taken after a scope concern was raised and overruled |

### 3.1 Recorded scope concern

A concern was raised that six subsystems is too much for one spec and that delivering
everything at once postpones all working software. The user elected to keep full scope.
Nothing is dropped. The risk is mitigated by sequencing into eight independently
shippable milestones (§9), each leaving the system in a working state — sequencing
delivery, not reducing scope.

## 4. Architecture

Three deploy targets, one repository.

```
┌─ Vercel ───────────────────────────┐          ┌─ Railway (one project) ────────────────┐
│                                    │          │                                        │
│  <site domain>                     │          │  crm.<site domain>                     │
│  ├── /        public marketing     │          │  ┌──────────────────────────────────┐  │
│  └── /portal  members only         │          │  │ twenty-server (NestJS + GraphQL) │  │
│                                    │          │  │ twenty-worker (jobs, sync)       │  │
│  /api/*  route handlers            │          │  │ Postgres 16 · Redis · S3         │  │
│  ├── auth (Google, domain-locked) ─┼─ query ─▶│  └────────────┬─────────────────────┘  │
│  ├── inbound lead intake ──────────┼─ write ─▶│               │                        │
│  ├── portal summary ───────────────┼─ read ──▶│               │ private network only   │
│  └── webhook receiver ◀────────────┼─ events ─┤               ▼                        │
│         └──▶ Slack                 │          │  research-agent (Claude Agent SDK)     │
│                                    │          │  └── no public domain                  │
└────────────────────────────────────┘          └────────────────────────────────────────┘
```

Every arrow crossing the boundary originates on the Vercel side except `events`, which
`twenty-server` sends to the webhook receiver. The research agent neither receives from
nor sends to Vercel; it is reached only by `twenty-server` over the private network.

The research agent sits in the **same Railway project** as Twenty and is reachable only
at `research-agent.railway.internal`. Nothing outside the infrastructure can reach it.

**Call-direction boundary.** Vercel cannot reach the research agent. Twenty's logic
functions call it over the private network. The Vercel webhook receiver handles only
work requiring the public internet, such as Slack notifications.

### 4.1 Repository layout

```
fraterai-labs/
├── app/                      # existing marketing site — unchanged
│   ├── portal/               # NEW  members-only portal (gate + launchpad)
│   └── api/                  # NEW  route handlers = "the backend"
├── lib/server/               # NEW  auth, session, Twenty API client
├── twenty-app/               # NEW  Frater app package (twenty-sdk) → twenty-cli
├── services/research-agent/  # NEW  Claude Agent SDK service → Railway
└── scripts/import-prospects/ # NEW  252-row importer
```

Three independent deploys: Vercel builds `app/` + `lib/`; `twenty-app/` ships via
`twenty-cli`; `services/research-agent/` deploys to Railway with its root directory
scoped to that folder. One git history, no build coupling — a portal change cannot
break the CRM.

`twenty-app/` needs Node 24 and Yarn 4 while the site uses npm. They stay isolated by
directory with their own lockfiles, matching how Twenty's own app packages are built.

### 4.2 Licensing position

We self-host and modify nothing in Twenty's core; the app package is a separate work
using its SDK. AGPL-3.0 obligations therefore reduce to offering source to users who
interact with it over a network — who are Frater AI Labs members. Trivially satisfied
while the CRM stays internal. **Revisit before exposing the CRM to clients.**

## 5. Data model

Four objects. The spreadsheet's 31 columns conflate three distinct things; separating
them is what makes automation possible.

| Object | Kind | Source columns | Count at import |
|---|---|---|---|
| **Company** | standard + custom | `Company`, `Website`, `Segment`, `Region`, `Country`, `Headcount`, `Headcount Status` | 218 |
| **Person** | standard + custom | `Lead Person`, `Lead Title`, `School`, `Alumni Path`, `Target Role`, `Evidence URL`, `Evidence Summary`, `Direct Email`, `Direct Email Status` | 252 |
| **Prospect** | **new custom** | `Queue ID`, `Lead Status`, `Qualification Status`, `Recommended AI Workflow`, `Owner`, `Status`, `Notes` | 252 |
| **Outreach** | **new custom** | `LinkedIn Connection Note`, `Connection Note Characters`, `LinkedIn Follow-up`, `Cold Email Subject`, `Cold Email` | ~756 |

### 5.1 Why `Prospect` is not an Opportunity

All 252 rows are `Not Contacted` and `Enrichment required`. None is a deal. Creating 252
Opportunities would corrupt pipeline value and forecasting from day one. `Prospect` owns
the pre-sale lifecycle and converts to a standard Opportunity only on genuine interest,
keeping deal reporting honest.

### 5.2 Prospect stages

```
Sourced → Evidence Verified → ICP Qualified → Enriched → Outreach Drafted
        → Contacted → Engaged → [convert to Opportunity]
                              ↘ Disqualified (reason required)
```

All 252 import at **Sourced**. This is an accurate statement of current position and
makes the enrichment agent's contribution measurable.

### 5.3 Why `Outreach` is normalized

Today one row holds five frozen outreach artifacts with nowhere to record outcomes. As
its own object — `channel`, `subject`, `body`, `characterCount`, `status`
(Draft / Approved / Sent / Replied), `sentAt`, `generatedBy`, `model`, relation to
`Prospect` — it supports multiple drafts, an approval gate, and reply logging. This
object is the mechanism for "how we follow up" and "how we close".

`characterCount` is validated against LinkedIn's 200-character connection-note limit.
Existing notes run 123–129 characters, so agents have room. Drafts exceeding the limit
are flagged, never silently truncated at send time.

### 5.4 Importer rules

1. **Search URLs are not profile URLs.** All 252 `Company LinkedIn / Lookup`,
   `Alumni Evidence Search`, and `Target Person Search` values are Google search URLs.
   They import into a `researchLinks` field and **must never** populate Twenty's
   `linkedinLink`. Doing so would corrupt the field and break People Data Labs matching,
   which keys off real LinkedIn URLs and domains.
2. **Normalize `Alumni Path`** from its 27 variants to a two-value SELECT —
   by prefix match, never an enumerated list —
   `Decision-maker` / `Referral` — preserving the original string in `notes`.
3. **`Prior 50 Exclusion` imports as a suppression list**, not as prospects. Zero
   overlap today; the list exists to prevent re-contact once enrichment adds companies.
4. **Idempotent on `Queue ID`.** Re-running updates in place. Non-negotiable — the
   import will be run more than once.
5. **Dry-run by default**, emitting a diff report before any write.
6. **Companies deduplicate on domain**, so the 34 shared-company rows become
   multi-contact accounts.
7. **`Owner` maps to a real workspace member.** The workspace and its members must
   exist before the first import.

## 6. Portal, auth, and backend

### 6.1 No database in the Next.js layer

Membership *is* Twenty workspace membership. After Google sign-in, Twenty is queried for
an active `workspaceMember` with that email; that answer alone grants portal access. One
source of truth, no second user table, no drift between CRM access and portal access.
Sessions are stateless encrypted cookies.

### 6.2 Sign-in flow

```
/portal/*  →  middleware: valid session?
                 ├─ no  → /portal/login → Google OAuth
                 │         ├─ verify ID token, require verified email
                 │         ├─ require hd claim = Workspace domain
                 │         └─ query Twenty: active workspaceMember? ─ no → 403
                 │              └─ yes → set httpOnly session cookie
                 └─ yes → portal
```

Two gates, both required: the Google `hd` domain claim proves Frater identity; active
workspace membership proves current authorization. Revoking someone in Twenty locks them
out of the portal on their next request.

Twenty is hardened independently: public signup disabled, invitation-only,
`approved-access-domain` locked to the Workspace domain, Google OAuth sharing the same
GCP OAuth client via a second authorized redirect URI. Because the browser already holds
a Google session, portal → CRM is a single "Continue as…" click. Not literal SSO — that
is the Enterprise-licensed feature — but equivalent in daily use.

### 6.3 The portal

Deliberately thin, since Twenty owns the real work:

- A prominent **Open CRM** action
- Live rollup tiles: prospects by stage, enrichment progress against the 252, outreach
  sent and replied this week
- Recent activity
- Reuses the existing design language in `app/globals.css`

**Undiscoverable by requirement:** no link in `components/global/Navbar.tsx` or
`components/global/Footer.tsx`, `noindex` metadata, and a `robots.txt` disallow.

### 6.4 Route handlers

| Route | Purpose |
|---|---|
| `/api/auth/[...]` | Google OAuth callback, session issuance |
| `/api/portal/summary` | Reporting rollups from Twenty's GraphQL API |
| `/api/leads/inbound` | Contact-form intake → Twenty (+ HubSpot mirror) |
| `/api/webhooks/twenty` | Signed webhook receiver → Slack |
| `/api/portal/me` | Session and member profile |

All Twenty access flows through one typed client in `lib/server/twenty.ts` holding the
workspace API key from Vercel env. **The key never reaches the browser** — a concrete
security improvement over `app/contact/page.tsx:47`, which POSTs to a third party from
the client today.

### 6.5 Inbound intake

The contact form is rewritten to POST to `/api/leads/inbound`, which:

1. Validates input
2. Upserts Company by email domain
3. Upserts Person by email
4. Creates a Prospect at `Sourced` with `leadSource = Inbound Website`
5. Attaches the message as a Note
6. Mirrors to HubSpot, best-effort

A failed HubSpot mirror is logged and never fails the request; Twenty is authoritative.
The endpoint is public, so it carries a honeypot field and Cloudflare Turnstile rather
than a rate-limit table requiring storage.

## 7. AI layer

**Placement rule:** anything that must finish inside a single user interaction runs on
Twenty's agent runtime; anything running for minutes across many records runs in the
research service. Every future capability is placed by this test.

### 7.1 Twenty-native agents

Defined as code in `twenty-app/`, on Twenty's agent runtime, using Claude with Exa and
People Data Labs as tools. Invocable from the command menu, as workflow steps, or from
AI chat.

- **Enrichment agent** — resolves the 252 Google search URLs into real LinkedIn profiles
  and domains, then calls PDL to fill `directEmail` and verify `headcount`. Writes
  **only confident matches**; low-confidence results are flagged for human review. A
  wrong email is worse than a missing one. Unblocks all 252 rows.
- **Qualification agent** — re-checks each `Evidence URL` still supports the alumni claim
  via Exa, confirms headcount against the 50–500 ICP, then advances the stage or
  disqualifies with a recorded reason.
- **Outreach agent** — given prospect, company, evidence, and `Recommended AI Workflow`,
  drafts the connection note (≤200 chars), follow-up, and cold email. Writes `Outreach`
  records at status **Draft**.

**Agents never send.** Every draft requires owner approval. These are cold approaches to
named alumni at 218 companies; one bad automated send causes reputational damage that no
bug fix repairs.

### 7.2 Research service

`services/research-agent`, Claude Agent SDK, private network only. Handles what
serverless functions cannot: multi-hop evidence verification, whole-list re-qualification
sweeps, and **new-prospect discovery** — automating the manual research that produced the
original 252 and growing the list beyond it. Invoked by Twenty logic functions, writes
back through Twenty's API, checkpoints progress per prospect.

## 8. Workflows, reporting, error handling, testing

### 8.1 The five workflows

| Need | Mechanism |
|---|---|
| How we reach out | Outreach agent drafts → owner approves → Gmail sync logs the send |
| How we qualify leads | Qualification agent + ICP gates on stage transitions |
| How we follow up | Twenty workflow: no reply in N days → task + drafted follow-up; Gmail sync detects replies |
| How we close | Prospect converts to Opportunity; standard deal stages |
| How we report | Twenty native dashboards + portal rollup tiles |

Gmail and Calendar sync are free with Google Workspace and auto-log emails and meetings
against People. Follow-up tracking therefore works without anyone remembering to log
anything — the usual reason follow-up tracking fails.

### 8.2 Error handling

- **Importer** — dry-run default; idempotent on `Queue ID`; per-row failure reporting;
  never partial-writes a prospect. Because GraphQL offers no cross-record transaction,
  partial failures reconcile on the next run via `Queue ID`.
- **Enrichment** — PDL "not found" is a normal outcome, not an error: set
  `directEmailStatus` and stop, with no retry loop. A per-run spend cap prevents runaway
  cost.
- **Webhooks** — verify signatures, dedupe on event ID, return 2xx quickly.
- **Inbound** — HubSpot mirror failure never fails the request.
- **Research sweeps** — checkpoint per prospect so a crash resumes rather than restarts.

### 8.3 Testing

- **Security path (explicit):** a non-domain Google account and a valid-domain-but-not-a-
  workspace-member account must both be rejected.
- **Importer:** unit tests over fixture rows from the real sheet, covering the six
  `Alumni Path` variants and the search-URL trap; an idempotency test importing twice and
  asserting 252 records, not 504.
- **Route handlers:** integration tests against a mocked Twenty client.
- **Logic functions:** unit tests with mocked PDL and Exa (Twenty app packages already
  use vitest).
- **E2E:** a seeded staging Twenty workspace in a second Railway environment; smoke test
  is inbound form → prospect appears.

## 9. Build order

All eight in scope. Each ships independently and leaves the system working.

| # | Milestone | Outcome |
|---|---|---|
| M1 | Infrastructure | Twenty on Railway, domain, Google OAuth, hardening |
| M2 | Data model | `twenty-app` package: objects, fields, stages, views, roles |
| M3 | Migration | Importer runs; 252 prospects live; **team leaves Excel** |
| M4 | Portal & backend | Auth gate, launchpad, summary API |
| M5 | Inbound intake | Form rewrite, webhook receiver, Slack |
| M6 | AI native | Enrichment, qualification, outreach agents + approval gate |
| M7 | Research service | Batch sweeps, new-prospect discovery |
| M8 | Reporting | Dashboards, follow-up automation, Gmail/Calendar sync |

M3 is the first milestone with standalone business value.

## 10. Running costs

| Item | Cost |
|---|---|
| Railway (server, worker, Postgres, Redis, research service) | $40–70 / mo |
| Exa (web search) | $5–20 / mo at this volume |
| Anthropic API | A few dollars per full drafting pass |
| Vercel | Unchanged |
| People Data Labs — enrich all 252 | **~$85 one-time** (person match ~$0.336) |

Roughly **$60–100 / month**, plus the one-time enrichment.

## 11. Open items for implementation

These are execution details, deliberately deferred to the implementation plan rather
than left ambiguous here:

- **The Google Workspace domain — blocking for M1.** The codebase carries two
  identities: `app/contact/page.tsx:101` advertises `hello@highachievers.ai` while
  `components/global/Footer.tsx:69` advertises `hello@fraterailabs.com`,
  `app/layout.tsx:8` sets `metadataBase` to `fraterailabs.com`, and the repository sits
  under the `High-Achievers-Pro` org. The Workspace domain drives both the Google `hd`
  claim check (§6.2) and Twenty's `approved-access-domain`, so an incorrect value locks
  out the entire team. This must be confirmed before M1, not inferred. The CRM subdomain
  follows from it (`crm.<domain>`).
- Choice of Railway Twenty template (`twenty-crm-production` is the leading candidate;
  verify it tracks a current Twenty release before committing)
- `next-auth` / Auth.js version compatibility with Next.js 16 — `AGENTS.md` warns that
  this Next.js release has breaking changes, so the relevant guide in
  `node_modules/next/dist/docs/` must be read before writing auth code
- Slack workspace and channel for webhook notifications
- The follow-up interval N (days) for the no-reply workflow
