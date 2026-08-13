# CRM Plan A — Foundation (M1–M3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a self-hosted Twenty CRM on Railway, define the Frater sales data model as a versioned app package, and import all 252 prospects so the team can stop working out of the spreadsheet.

**Architecture:** Twenty runs as managed services on Railway (server, worker, Postgres, Redis, S3). The Frater data model ships as a `twenty-sdk` app package in `twenty-app/`, deployed with `twenty-cli`. A one-off Node importer reads the master sheet and upserts Companies, People, Prospects, and Outreach records through Twenty's REST API.

**Tech Stack:** Twenty (AGPL, self-hosted), Railway, Node 24 + Yarn 4 (app package), Node + npm + tsx + vitest (importer), `exceljs`, Twenty REST API.

**Spec:** `docs/superpowers/specs/2026-08-12-twenty-crm-portal-design.md`

## Global Constraints

- Google Workspace domain is **`fraterailabs.com`**. CRM host is **`crm.fraterailabs.com`**.
- ICP is **50–500 headcount**.
- Import from the **`All Evidence Leads`** sheet only (252 rows). Never import `CMU Startup Additions` (subset) or `Alumni Lead View` (view).
- All 252 `Company LinkedIn / Lookup`, `Alumni Evidence Search`, and `Target Person Search` values are Google **search** URLs. They go to `researchLinks`. **Never** write them to `linkedinLink`.
- The importer is **dry-run by default** and **idempotent on `Queue ID`**.
- `twenty-app/` requires **Node 24 + Yarn 4**; the rest of the repo uses npm. Keep separate lockfiles.
- All universal identifiers must be valid **UUID v4** and must never be changed once deployed.
- Agents never send outreach. (Enforced in Plan C; the `status` enum here must support it.)
- Branch: `feat/twenty-crm-portal`.

## Naming Registry

These names are referenced verbatim by Plans B, C, and D. Do not rename.

| Kind | Name |
|---|---|
| App package | `frater-crm` (dir `twenty-app/`) |
| Object | `prospect` / `prospects` |
| Object | `outreach` / `outreaches` |
| Prospect fields | `queueId`, `stage`, `leadSource`, `qualificationStatus`, `recommendedAiWorkflow`, `disqualificationReason`, `importNotes`, `company`, `person`, `outreaches` |
| Outreach fields | `title`, `channel`, `subject`, `body`, `characterCount`, `status`, `sentAt`, `generatedBy`, `model`, `prospect` |
| Company added fields | `segment`, `region`, `country`, `headcountStatus`, `researchLinks`, `isSuppressed`, `suppressionReason`, `prospects` |
| Person added fields | `school`, `alumniPath`, `targetRole`, `evidenceUrl`, `evidenceSummary`, `directEmailStatus`, `researchLinks`, `prospects` |

**Enum values** (SELECT `value` strings, SCREAMING_SNAKE):

- `prospect.stage`: `SOURCED`, `EVIDENCE_VERIFIED`, `ICP_QUALIFIED`, `ENRICHED`, `OUTREACH_DRAFTED`, `CONTACTED`, `ENGAGED`, `CONVERTED`, `DISQUALIFIED`
- `prospect.leadSource`: `ALUMNI_EVIDENCE`, `CMU_STARTUP`, `INBOUND_WEBSITE`
- `outreach.channel`: `LINKEDIN_CONNECTION`, `LINKEDIN_FOLLOW_UP`, `COLD_EMAIL`
- `outreach.status`: `DRAFT`, `APPROVED`, `SENT`, `REPLIED`, `BOUNCED`
- `outreach.generatedBy`: `HUMAN`, `AGENT`
- `company.headcountStatus`: `NEEDS_VERIFICATION`, `LIKELY_STARTUP`, `VERIFIED_IN_ICP`, `VERIFIED_OUTSIDE_ICP`
- `person.school`: `CMU`, `EMORY`
- `person.alumniPath`: `DECISION_MAKER`, `REFERRAL`
- `person.directEmailStatus`: `ENRICHMENT_REQUIRED`, `FOUND`, `NOT_FOUND`, `LOW_CONFIDENCE`

## File Structure

```
twenty-app/
├── package.json                       Yarn 4, Node 24, twenty-sdk dep
├── tsconfig.json
├── vitest.config.ts
└── src/
    ├── application.config.ts          defineApplication
    ├── constants/universal-identifiers.ts   every UUID in one place
    ├── objects/prospect.object.ts
    ├── objects/outreach.object.ts
    ├── fields/prospect-company.field.ts     + reverse on Company
    ├── fields/prospect-person.field.ts      + reverse on Person
    ├── fields/outreach-prospect.field.ts    + reverse on Prospect
    ├── fields/company-*.field.ts            segment, region, country, …
    ├── fields/person-*.field.ts             school, alumniPath, …
    ├── views/prospect-pipeline.view.ts
    ├── navigation-menu-items/prospects.navigation-menu-item.ts
    └── roles/default-function.role.ts

scripts/import-prospects/
├── types.ts             ParsedRow, ImportPlan, and record input types
├── parse-workbook.ts    parseWorkbook()  — pure
├── normalize.ts         normalizers      — pure
├── twenty-rest.ts       REST client
├── build-plan.ts        rows → ImportPlan (pure)
├── apply-plan.ts        ImportPlan → Twenty (effectful, idempotent)
├── import.ts            CLI entry, dry-run default
└── __tests__/           vitest specs + fixtures
```

Pure logic (`parse-workbook`, `normalize`, `build-plan`) is separated from I/O (`twenty-rest`, `apply-plan`) so the mapping rules — where the real risk lives — are unit-testable without a running Twenty.

---

### Task 1: Provision Twenty on Railway

**Files:**
- Create: `docs/runbooks/twenty-railway.md`

**Interfaces:**
- Produces: a reachable Twenty at `https://crm.fraterailabs.com`, an admin account, and a workspace API key used by every later task.

- [ ] **Step 1: Verify the template is current**

Twenty releases frequently and stale templates pin old images. Check the template's image tag against the latest release before deploying.

Run: `gh release list --repo twentyhq/twenty --limit 3`

Compare with the `twentycrm/twenty` tag the template uses. If the template is more than one minor version behind, deploy the official `packages/twenty-docker/docker-compose.yml` services manually instead.

- [ ] **Step 2: Deploy the template**

Use the Railway dashboard or MCP with template code `twenty-crm-production` (worker + S3 + workflows preconfigured). Required variables:

| Variable | Value |
|---|---|
| `SERVER_URL` | `https://crm.fraterailabs.com` |
| `APP_SECRET` | `openssl rand -base64 32` |
| `ENCRYPTION_KEY` | `openssl rand -base64 32` |
| `PG_DATABASE_URL` | from the Railway Postgres service |
| `REDIS_URL` | from the Railway Redis service |
| `STORAGE_TYPE` | `s3` |

Store `APP_SECRET` and `ENCRYPTION_KEY` in a password manager immediately. Losing `ENCRYPTION_KEY` makes every stored credential unrecoverable.

- [ ] **Step 3: Point the domain**

Add a Railway custom domain `crm.fraterailabs.com` on the **server** service (not the worker), then create the CNAME it prints at your DNS provider. Wait for the certificate to issue.

- [ ] **Step 4: Verify health**

Run: `curl -fsS https://crm.fraterailabs.com/healthz`
Expected: HTTP 200.

Then confirm the worker is running — a server-only deploy looks healthy but silently never processes jobs:

Run: `railway logs --service worker | tail -20`
Expected: worker boot lines, no crash loop.

- [ ] **Step 5: Create the admin account and workspace**

Open `https://crm.fraterailabs.com` and sign up with your `@fraterailabs.com` address. This first account becomes workspace owner.

- [ ] **Step 6: Mint a workspace API key**

In Twenty: Settings → APIs → create an API key named `frater-automation`. Copy it once — it is not shown again.

- [ ] **Step 7: Verify the API key works**

Run:
```bash
curl -fsS https://crm.fraterailabs.com/rest/companies \
  -H "Authorization: Bearer $TWENTY_API_KEY" | head -c 200
```
Expected: a JSON body (an empty `data.companies` array is correct at this point).

- [ ] **Step 8: Write the runbook and commit**

Record in `docs/runbooks/twenty-railway.md`: service names, where secrets live, the domain, how to read worker logs, and how to restore from a Postgres backup. Do **not** commit any secret values.

```bash
git add docs/runbooks/twenty-railway.md
git commit -m "docs: add Twenty on Railway provisioning runbook"
```

---

### Task 2: Lock the workspace to Frater members

**Files:**
- Modify: `docs/runbooks/twenty-railway.md`

**Interfaces:**
- Consumes: the running instance from Task 1.
- Produces: a workspace only `@fraterailabs.com` Google accounts can enter. Plan B's membership check depends on this.

- [ ] **Step 1: Create the Google OAuth client**

In Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client ID (Web application). Add authorized redirect URIs:

```
https://crm.fraterailabs.com/auth/google/redirect
https://crm.fraterailabs.com/auth/google-apis/get-access-token
```

Plan B adds a third URI to this same client for the portal. Keep the client ID and secret.

- [ ] **Step 2: Enable Google auth on the server**

Set on **both** the server and worker services, then redeploy:

```
AUTH_GOOGLE_ENABLED=true
AUTH_GOOGLE_CLIENT_ID=<client id>
AUTH_GOOGLE_CLIENT_SECRET=<client secret>
AUTH_GOOGLE_CALLBACK_URL=https://crm.fraterailabs.com/auth/google/redirect
AUTH_GOOGLE_APIS_CALLBACK_URL=https://crm.fraterailabs.com/auth/google-apis/get-access-token
AUTH_PASSWORD_ENABLED=false
IS_SIGN_UP_DISABLED=true
```

`AUTH_PASSWORD_ENABLED=false` removes password login so Google is the only door. `IS_SIGN_UP_DISABLED=true` makes the workspace invitation-only.

- [ ] **Step 3: Add the approved access domain**

In Twenty: Settings → General → Approved access domains → add `fraterailabs.com` and complete verification.

- [ ] **Step 4: Verify a non-member is rejected**

In a private browser window, attempt sign-in with a personal Gmail account.
Expected: rejected. The account must **not** land in the workspace.

This is the security control the whole portal rests on. Do not skip it, and do not accept "it redirected oddly" as a pass — confirm no workspace member was created under Settings → Members.

- [ ] **Step 5: Invite the team**

Settings → Members → invite each teammate's `@fraterailabs.com` address, including the owner referenced as `Seth` in the spreadsheet. Task 12 maps that name to a real member, so this must be done first.

- [ ] **Step 6: Record member emails and commit**

Append to the runbook a table mapping spreadsheet `Owner` values to Twenty member emails (`Seth` → their address).

```bash
git add docs/runbooks/twenty-railway.md
git commit -m "docs: record workspace hardening and owner mapping"
```

---

### Task 3: Scaffold the frater-crm app package

**Files:**
- Create: `twenty-app/package.json`, `twenty-app/tsconfig.json`, `twenty-app/.nvmrc`, `twenty-app/src/application.config.ts`, `twenty-app/src/constants/universal-identifiers.ts`, `twenty-app/src/roles/default-function.role.ts`
- Modify: `.gitignore`

**Interfaces:**
- Produces: `APPLICATION_UNIVERSAL_IDENTIFIER`, `DEFAULT_ROLE_UNIVERSAL_IDENTIFIER`, and a deployable empty app.

- [ ] **Step 1: Generate the UUIDs**

Every identifier is fixed forever once deployed, so generate them all now.

Run: `for i in $(seq 1 40); do uuidgen | tr 'A-Z' 'a-z'; done`

- [ ] **Step 2: Create the package manifest**

`twenty-app/package.json`:

```json
{
  "name": "frater-crm",
  "version": "0.1.0",
  "private": true,
  "packageManager": "yarn@4.13.0",
  "engines": { "node": "^24.5.0" },
  "type": "module",
  "scripts": {
    "typecheck": "twenty dev typecheck",
    "build": "twenty dev build",
    "deploy": "twenty app deploy",
    "test": "vitest run"
  },
  "dependencies": { "twenty-sdk": "^1.0.0" },
  "devDependencies": { "typescript": "^5", "vitest": "^2" }
}
```

Pin `twenty-sdk` to the version matching your deployed server; a mismatch produces confusing schema-sync errors.

- [ ] **Step 3: Add the constants file**

`twenty-app/src/constants/universal-identifiers.ts` — paste your generated UUIDs:

```ts
export const APPLICATION_UNIVERSAL_IDENTIFIER = '<uuid-1>';
export const DEFAULT_ROLE_UNIVERSAL_IDENTIFIER = '<uuid-2>';

export const PROSPECT_OBJECT_ID = '<uuid-3>';
export const PROSPECT_QUEUE_ID_FIELD_ID = '<uuid-4>';
export const PROSPECT_STAGE_FIELD_ID = '<uuid-5>';
export const PROSPECT_LEAD_SOURCE_FIELD_ID = '<uuid-6>';
export const PROSPECT_QUALIFICATION_STATUS_FIELD_ID = '<uuid-7>';
export const PROSPECT_RECOMMENDED_AI_WORKFLOW_FIELD_ID = '<uuid-8>';
export const PROSPECT_DISQUALIFICATION_REASON_FIELD_ID = '<uuid-9>';
export const PROSPECT_IMPORT_NOTES_FIELD_ID = '<uuid-10>';

export const OUTREACH_OBJECT_ID = '<uuid-11>';
export const OUTREACH_TITLE_FIELD_ID = '<uuid-12>';
export const OUTREACH_CHANNEL_FIELD_ID = '<uuid-13>';
export const OUTREACH_SUBJECT_FIELD_ID = '<uuid-14>';
export const OUTREACH_BODY_FIELD_ID = '<uuid-15>';
export const OUTREACH_CHARACTER_COUNT_FIELD_ID = '<uuid-16>';
export const OUTREACH_STATUS_FIELD_ID = '<uuid-17>';
export const OUTREACH_SENT_AT_FIELD_ID = '<uuid-18>';
export const OUTREACH_GENERATED_BY_FIELD_ID = '<uuid-19>';
export const OUTREACH_MODEL_FIELD_ID = '<uuid-20>';

// Relations — each needs an identifier on both sides
export const PROSPECT_COMPANY_FIELD_ID = '<uuid-21>';
export const COMPANY_PROSPECTS_FIELD_ID = '<uuid-22>';
export const PROSPECT_PERSON_FIELD_ID = '<uuid-23>';
export const PERSON_PROSPECTS_FIELD_ID = '<uuid-24>';
export const OUTREACH_PROSPECT_FIELD_ID = '<uuid-25>';
export const PROSPECT_OUTREACHES_FIELD_ID = '<uuid-26>';

// Company additions
export const COMPANY_SEGMENT_FIELD_ID = '<uuid-27>';
export const COMPANY_REGION_FIELD_ID = '<uuid-28>';
export const COMPANY_COUNTRY_FIELD_ID = '<uuid-29>';
export const COMPANY_HEADCOUNT_STATUS_FIELD_ID = '<uuid-30>';
export const COMPANY_RESEARCH_LINKS_FIELD_ID = '<uuid-31>';
export const COMPANY_IS_SUPPRESSED_FIELD_ID = '<uuid-32>';
export const COMPANY_SUPPRESSION_REASON_FIELD_ID = '<uuid-33>';

// Person additions
export const PERSON_SCHOOL_FIELD_ID = '<uuid-34>';
export const PERSON_ALUMNI_PATH_FIELD_ID = '<uuid-35>';
export const PERSON_TARGET_ROLE_FIELD_ID = '<uuid-36>';
export const PERSON_EVIDENCE_URL_FIELD_ID = '<uuid-37>';
export const PERSON_EVIDENCE_SUMMARY_FIELD_ID = '<uuid-38>';
export const PERSON_DIRECT_EMAIL_STATUS_FIELD_ID = '<uuid-39>';
export const PERSON_RESEARCH_LINKS_FIELD_ID = '<uuid-40>';
```

- [ ] **Step 4: Add the application config and role**

`twenty-app/src/roles/default-function.role.ts`:

```ts
import { defineRole } from 'twenty-sdk/define';
import { DEFAULT_ROLE_UNIVERSAL_IDENTIFIER } from '../constants/universal-identifiers';

export default defineRole({
  universalIdentifier: DEFAULT_ROLE_UNIVERSAL_IDENTIFIER,
  label: 'Frater CRM Functions',
  description: 'Role used by Frater CRM logic functions and agents',
  canReadAllObjectRecords: true,
  canUpdateAllObjectRecords: true,
  canSoftDeleteAllObjectRecords: false,
  canDestroyAllObjectRecords: false,
});
```

`twenty-app/src/application.config.ts`:

```ts
import { defineApplication } from 'twenty-sdk/define';
import {
  APPLICATION_UNIVERSAL_IDENTIFIER,
  DEFAULT_ROLE_UNIVERSAL_IDENTIFIER,
} from './constants/universal-identifiers';

export default defineApplication({
  universalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER,
  displayName: 'Frater CRM',
  description: 'Frater AI Labs prospecting data model, agents, and workflows',
  defaultRoleUniversalIdentifier: DEFAULT_ROLE_UNIVERSAL_IDENTIFIER,
});
```

- [ ] **Step 5: Ignore build output**

Append to `.gitignore`:

```
twenty-app/node_modules
twenty-app/dist
twenty-app/.twenty
```

- [ ] **Step 6: Typecheck**

Run: `cd twenty-app && yarn install && yarn typecheck`
Expected: no errors.

If `defineRole` rejects a property, run `yarn twenty dev typecheck` and follow the reported shape — the SDK version you pinned is authoritative over this plan.

- [ ] **Step 7: Commit**

```bash
git add twenty-app .gitignore
git commit -m "feat(crm): scaffold frater-crm Twenty app package"
```

---

### Task 4: Define the Prospect object

**Files:**
- Create: `twenty-app/src/objects/prospect.object.ts`

**Interfaces:**
- Consumes: constants from Task 3.
- Produces: object `prospect`/`prospects`, label identifier `queueId`. Plans B, C, D all read and write this object.

- [ ] **Step 1: Write the object definition**

```ts
import { defineObject, FieldType } from 'twenty-sdk/define';
import {
  PROSPECT_OBJECT_ID,
  PROSPECT_QUEUE_ID_FIELD_ID,
  PROSPECT_STAGE_FIELD_ID,
  PROSPECT_LEAD_SOURCE_FIELD_ID,
  PROSPECT_QUALIFICATION_STATUS_FIELD_ID,
  PROSPECT_RECOMMENDED_AI_WORKFLOW_FIELD_ID,
  PROSPECT_DISQUALIFICATION_REASON_FIELD_ID,
  PROSPECT_IMPORT_NOTES_FIELD_ID,
} from '../constants/universal-identifiers';

export enum ProspectStage {
  SOURCED = 'SOURCED',
  EVIDENCE_VERIFIED = 'EVIDENCE_VERIFIED',
  ICP_QUALIFIED = 'ICP_QUALIFIED',
  ENRICHED = 'ENRICHED',
  OUTREACH_DRAFTED = 'OUTREACH_DRAFTED',
  CONTACTED = 'CONTACTED',
  ENGAGED = 'ENGAGED',
  CONVERTED = 'CONVERTED',
  DISQUALIFIED = 'DISQUALIFIED',
}

export enum ProspectLeadSource {
  ALUMNI_EVIDENCE = 'ALUMNI_EVIDENCE',
  CMU_STARTUP = 'CMU_STARTUP',
  INBOUND_WEBSITE = 'INBOUND_WEBSITE',
}

export default defineObject({
  universalIdentifier: PROSPECT_OBJECT_ID,
  nameSingular: 'prospect',
  namePlural: 'prospects',
  labelSingular: 'Prospect',
  labelPlural: 'Prospects',
  description: 'A researched lead moving through the Frater pre-sale pipeline',
  icon: 'IconTargetArrow',
  labelIdentifierFieldMetadataUniversalIdentifier: PROSPECT_QUEUE_ID_FIELD_ID,
  fields: [
    {
      universalIdentifier: PROSPECT_QUEUE_ID_FIELD_ID,
      type: FieldType.TEXT,
      name: 'queueId',
      label: 'Queue ID',
      description: 'Stable identifier from the source research sheet, e.g. EV-001',
      icon: 'IconHash',
    },
    {
      universalIdentifier: PROSPECT_STAGE_FIELD_ID,
      type: FieldType.SELECT,
      name: 'stage',
      label: 'Stage',
      icon: 'IconProgressCheck',
      defaultValue: `'${ProspectStage.SOURCED}'`,
      options: [
        { id: '<uuid-s1>', value: ProspectStage.SOURCED, label: 'Sourced', position: 0, color: 'gray' },
        { id: '<uuid-s2>', value: ProspectStage.EVIDENCE_VERIFIED, label: 'Evidence verified', position: 1, color: 'blue' },
        { id: '<uuid-s3>', value: ProspectStage.ICP_QUALIFIED, label: 'ICP qualified', position: 2, color: 'turquoise' },
        { id: '<uuid-s4>', value: ProspectStage.ENRICHED, label: 'Enriched', position: 3, color: 'purple' },
        { id: '<uuid-s5>', value: ProspectStage.OUTREACH_DRAFTED, label: 'Outreach drafted', position: 4, color: 'yellow' },
        { id: '<uuid-s6>', value: ProspectStage.CONTACTED, label: 'Contacted', position: 5, color: 'orange' },
        { id: '<uuid-s7>', value: ProspectStage.ENGAGED, label: 'Engaged', position: 6, color: 'green' },
        { id: '<uuid-s8>', value: ProspectStage.CONVERTED, label: 'Converted', position: 7, color: 'green' },
        { id: '<uuid-s9>', value: ProspectStage.DISQUALIFIED, label: 'Disqualified', position: 8, color: 'red' },
      ],
    },
    {
      universalIdentifier: PROSPECT_LEAD_SOURCE_FIELD_ID,
      type: FieldType.SELECT,
      name: 'leadSource',
      label: 'Lead source',
      icon: 'IconRoute',
      isNullable: true,
      options: [
        { id: '<uuid-l1>', value: ProspectLeadSource.ALUMNI_EVIDENCE, label: 'Alumni evidence', position: 0, color: 'blue' },
        { id: '<uuid-l2>', value: ProspectLeadSource.CMU_STARTUP, label: 'CMU startup', position: 1, color: 'purple' },
        { id: '<uuid-l3>', value: ProspectLeadSource.INBOUND_WEBSITE, label: 'Inbound website', position: 2, color: 'green' },
      ],
    },
    {
      universalIdentifier: PROSPECT_QUALIFICATION_STATUS_FIELD_ID,
      type: FieldType.TEXT,
      name: 'qualificationStatus',
      label: 'Qualification status',
      icon: 'IconCheckbox',
    },
    {
      universalIdentifier: PROSPECT_RECOMMENDED_AI_WORKFLOW_FIELD_ID,
      type: FieldType.TEXT,
      name: 'recommendedAiWorkflow',
      label: 'Recommended AI workflow',
      description: 'The automation opportunity identified for this account',
      icon: 'IconRobot',
    },
    {
      universalIdentifier: PROSPECT_DISQUALIFICATION_REASON_FIELD_ID,
      type: FieldType.TEXT,
      name: 'disqualificationReason',
      label: 'Disqualification reason',
      icon: 'IconBan',
    },
    {
      universalIdentifier: PROSPECT_IMPORT_NOTES_FIELD_ID,
      type: FieldType.TEXT,
      name: 'importNotes',
      label: 'Import notes',
      description: 'Original sheet notes and any values normalized during import',
      icon: 'IconNotes',
    },
  ],
});
```

Generate the twelve option UUIDs (`<uuid-s1>`…`<uuid-l3>`) with `uuidgen` and paste them in.

- [ ] **Step 2: Typecheck**

Run: `cd twenty-app && yarn typecheck`
Expected: no errors.

- [ ] **Step 3: Deploy and verify**

Run: `cd twenty-app && yarn deploy`

Then in Twenty, open Prospects and create one record by hand. Confirm the stage picker lists all nine stages in order and defaults to Sourced.

- [ ] **Step 4: Delete the test record and commit**

```bash
git add twenty-app/src/objects/prospect.object.ts
git commit -m "feat(crm): define Prospect object with pipeline stages"
```

---

### Task 5: Define the Outreach object and its relation to Prospect

**Files:**
- Create: `twenty-app/src/objects/outreach.object.ts`, `twenty-app/src/fields/outreach-prospect.field.ts`

**Interfaces:**
- Produces: object `outreach`/`outreaches`; `outreach.prospect` (MANY_TO_ONE) and `prospect.outreaches` (ONE_TO_MANY). Plan C writes drafts here; Plan D reports on them.

- [ ] **Step 1: Write the Outreach object**

```ts
import { defineObject, FieldType } from 'twenty-sdk/define';
import {
  OUTREACH_OBJECT_ID, OUTREACH_TITLE_FIELD_ID, OUTREACH_CHANNEL_FIELD_ID,
  OUTREACH_SUBJECT_FIELD_ID, OUTREACH_BODY_FIELD_ID, OUTREACH_CHARACTER_COUNT_FIELD_ID,
  OUTREACH_STATUS_FIELD_ID, OUTREACH_SENT_AT_FIELD_ID, OUTREACH_GENERATED_BY_FIELD_ID,
  OUTREACH_MODEL_FIELD_ID,
} from '../constants/universal-identifiers';

export enum OutreachChannel {
  LINKEDIN_CONNECTION = 'LINKEDIN_CONNECTION',
  LINKEDIN_FOLLOW_UP = 'LINKEDIN_FOLLOW_UP',
  COLD_EMAIL = 'COLD_EMAIL',
}

export enum OutreachStatus {
  DRAFT = 'DRAFT',
  APPROVED = 'APPROVED',
  SENT = 'SENT',
  REPLIED = 'REPLIED',
  BOUNCED = 'BOUNCED',
}

export enum OutreachGeneratedBy { HUMAN = 'HUMAN', AGENT = 'AGENT' }

export default defineObject({
  universalIdentifier: OUTREACH_OBJECT_ID,
  nameSingular: 'outreach',
  namePlural: 'outreaches',
  labelSingular: 'Outreach',
  labelPlural: 'Outreaches',
  description: 'A single drafted or sent touch against a prospect',
  icon: 'IconSend',
  labelIdentifierFieldMetadataUniversalIdentifier: OUTREACH_TITLE_FIELD_ID,
  fields: [
    { universalIdentifier: OUTREACH_TITLE_FIELD_ID, type: FieldType.TEXT, name: 'title', label: 'Title', icon: 'IconAbc' },
    {
      universalIdentifier: OUTREACH_CHANNEL_FIELD_ID, type: FieldType.SELECT, name: 'channel', label: 'Channel', icon: 'IconMessage',
      options: [
        { id: '<uuid-c1>', value: OutreachChannel.LINKEDIN_CONNECTION, label: 'LinkedIn connection', position: 0, color: 'blue' },
        { id: '<uuid-c2>', value: OutreachChannel.LINKEDIN_FOLLOW_UP, label: 'LinkedIn follow-up', position: 1, color: 'turquoise' },
        { id: '<uuid-c3>', value: OutreachChannel.COLD_EMAIL, label: 'Cold email', position: 2, color: 'purple' },
      ],
    },
    { universalIdentifier: OUTREACH_SUBJECT_FIELD_ID, type: FieldType.TEXT, name: 'subject', label: 'Subject', icon: 'IconMailOpened' },
    { universalIdentifier: OUTREACH_BODY_FIELD_ID, type: FieldType.TEXT, name: 'body', label: 'Body', icon: 'IconFileText' },
    {
      universalIdentifier: OUTREACH_CHARACTER_COUNT_FIELD_ID, type: FieldType.NUMBER, name: 'characterCount',
      label: 'Character count', description: 'LinkedIn connection notes must stay at or under 200', icon: 'IconNumbers',
      isNullable: true, defaultValue: null,
    },
    {
      universalIdentifier: OUTREACH_STATUS_FIELD_ID, type: FieldType.SELECT, name: 'status', label: 'Status', icon: 'IconProgress',
      defaultValue: `'${OutreachStatus.DRAFT}'`,
      options: [
        { id: '<uuid-o1>', value: OutreachStatus.DRAFT, label: 'Draft', position: 0, color: 'gray' },
        { id: '<uuid-o2>', value: OutreachStatus.APPROVED, label: 'Approved', position: 1, color: 'blue' },
        { id: '<uuid-o3>', value: OutreachStatus.SENT, label: 'Sent', position: 2, color: 'orange' },
        { id: '<uuid-o4>', value: OutreachStatus.REPLIED, label: 'Replied', position: 3, color: 'green' },
        { id: '<uuid-o5>', value: OutreachStatus.BOUNCED, label: 'Bounced', position: 4, color: 'red' },
      ],
    },
    { universalIdentifier: OUTREACH_SENT_AT_FIELD_ID, type: FieldType.DATE_TIME, name: 'sentAt', label: 'Sent at', icon: 'IconClock', isNullable: true, defaultValue: null },
    {
      universalIdentifier: OUTREACH_GENERATED_BY_FIELD_ID, type: FieldType.SELECT, name: 'generatedBy', label: 'Generated by', icon: 'IconPencil',
      isNullable: true,
      options: [
        { id: '<uuid-g1>', value: OutreachGeneratedBy.HUMAN, label: 'Human', position: 0, color: 'gray' },
        { id: '<uuid-g2>', value: OutreachGeneratedBy.AGENT, label: 'Agent', position: 1, color: 'purple' },
      ],
    },
    { universalIdentifier: OUTREACH_MODEL_FIELD_ID, type: FieldType.TEXT, name: 'model', label: 'Model', description: 'Model id that produced this draft', icon: 'IconRobot' },
  ],
});
```

- [ ] **Step 2: Write the relation — both sides**

A Twenty relation needs a field on each object, each naming the other's identifier.

`twenty-app/src/fields/outreach-prospect.field.ts`:

```ts
import { defineField, FieldType, OnDeleteAction, RelationType } from 'twenty-sdk/define';
import {
  OUTREACH_OBJECT_ID, OUTREACH_PROSPECT_FIELD_ID,
  PROSPECT_OBJECT_ID, PROSPECT_OUTREACHES_FIELD_ID,
} from '../constants/universal-identifiers';

export const outreachOnProspect = defineField({
  universalIdentifier: OUTREACH_PROSPECT_FIELD_ID,
  objectUniversalIdentifier: OUTREACH_OBJECT_ID,
  type: FieldType.RELATION,
  name: 'prospect',
  label: 'Prospect',
  icon: 'IconTargetArrow',
  relationTargetObjectMetadataUniversalIdentifier: PROSPECT_OBJECT_ID,
  relationTargetFieldMetadataUniversalIdentifier: PROSPECT_OUTREACHES_FIELD_ID,
  universalSettings: {
    relationType: RelationType.MANY_TO_ONE,
    onDelete: OnDeleteAction.CASCADE,
    joinColumnName: 'prospectId',
  },
});

export default outreachOnProspect;
```

Create the reverse in the same directory as `prospect-outreaches.field.ts`, with `universalIdentifier: PROSPECT_OUTREACHES_FIELD_ID`, `objectUniversalIdentifier: PROSPECT_OBJECT_ID`, `name: 'outreaches'`, `label: 'Outreaches'`, target object `OUTREACH_OBJECT_ID`, target field `OUTREACH_PROSPECT_FIELD_ID`, and `universalSettings: { relationType: RelationType.ONE_TO_MANY }`.

`onDelete: CASCADE` is deliberate: deleting a prospect should remove its drafts, which have no meaning alone.

- [ ] **Step 3: Typecheck and deploy**

Run: `cd twenty-app && yarn typecheck && yarn deploy`
Expected: no errors; Outreaches appears in Twenty.

- [ ] **Step 4: Verify the relation both ways**

Create a Prospect and an Outreach, link them, and confirm the Outreach shows on the Prospect record and vice versa. Then delete both.

- [ ] **Step 5: Commit**

```bash
git add twenty-app/src/objects/outreach.object.ts twenty-app/src/fields/
git commit -m "feat(crm): define Outreach object and Prospect relation"
```

---

### Task 6: Extend Company and Person with research fields

**Files:**
- Create: `twenty-app/src/fields/company-segment.field.ts`, `company-region.field.ts`, `company-country.field.ts`, `company-headcount-status.field.ts`, `company-research-links.field.ts`, `company-is-suppressed.field.ts`, `company-suppression-reason.field.ts`, `person-school.field.ts`, `person-alumni-path.field.ts`, `person-target-role.field.ts`, `person-evidence-url.field.ts`, `person-evidence-summary.field.ts`, `person-direct-email-status.field.ts`, `person-research-links.field.ts`, `prospect-company.field.ts`, `company-prospects.field.ts`, `prospect-person.field.ts`, `person-prospects.field.ts`

**Interfaces:**
- Produces: every custom field named in the registry. The importer (Tasks 9–13) and Plan C's agents write these exact names.

- [ ] **Step 1: Add a simple TEXT field on Company**

`twenty-app/src/fields/company-segment.field.ts`:

```ts
import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';
import { COMPANY_SEGMENT_FIELD_ID } from '../constants/universal-identifiers';

export default defineField({
  universalIdentifier: COMPANY_SEGMENT_FIELD_ID,
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.company.universalIdentifier,
  type: FieldType.TEXT,
  name: 'segment',
  label: 'Segment',
  description: 'Industry segment from prospect research',
  icon: 'IconCategory',
});
```

Note `.company.universalIdentifier` — the SDK re-exports the wrapped `STANDARD_OBJECTS`, so the bare key is not the UUID.

Create `company-region.field.ts` and `company-country.field.ts` the same way with names `region`/`country`, labels `Region`/`Country`, icons `IconMap`/`IconFlag`, and their own constants.

- [ ] **Step 2: Add the LINKS and BOOLEAN fields on Company**

`company-research-links.field.ts` uses `type: FieldType.LINKS`, `name: 'researchLinks'`, `label: 'Research links'`, `description: 'Google search URLs from the research sheet — not verified profile URLs'`, `icon: 'IconSearch'`, `isNullable: true`.

That description is load-bearing. It is what stops a future engineer from treating these as real LinkedIn URLs.

`company-is-suppressed.field.ts` uses `type: FieldType.BOOLEAN`, `name: 'isSuppressed'`, `label: 'Suppressed'`, `defaultValue: false`, `icon: 'IconBan'`. `company-suppression-reason.field.ts` is TEXT, `name: 'suppressionReason'`.

- [ ] **Step 3: Add the Company SELECT**

`company-headcount-status.field.ts`:

```ts
import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';
import { COMPANY_HEADCOUNT_STATUS_FIELD_ID } from '../constants/universal-identifiers';

export enum HeadcountStatus {
  NEEDS_VERIFICATION = 'NEEDS_VERIFICATION',
  LIKELY_STARTUP = 'LIKELY_STARTUP',
  VERIFIED_IN_ICP = 'VERIFIED_IN_ICP',
  VERIFIED_OUTSIDE_ICP = 'VERIFIED_OUTSIDE_ICP',
}

export default defineField({
  universalIdentifier: COMPANY_HEADCOUNT_STATUS_FIELD_ID,
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.company.universalIdentifier,
  type: FieldType.SELECT,
  name: 'headcountStatus',
  label: 'Headcount status',
  description: 'ICP is 50-500 employees',
  icon: 'IconUsers',
  defaultValue: `'${HeadcountStatus.NEEDS_VERIFICATION}'`,
  options: [
    { id: '<uuid-h1>', value: HeadcountStatus.NEEDS_VERIFICATION, label: 'Needs verification', position: 0, color: 'gray' },
    { id: '<uuid-h2>', value: HeadcountStatus.LIKELY_STARTUP, label: 'Likely startup', position: 1, color: 'yellow' },
    { id: '<uuid-h3>', value: HeadcountStatus.VERIFIED_IN_ICP, label: 'Verified in ICP', position: 2, color: 'green' },
    { id: '<uuid-h4>', value: HeadcountStatus.VERIFIED_OUTSIDE_ICP, label: 'Verified outside ICP', position: 3, color: 'red' },
  ],
});
```

- [ ] **Step 4: Add the Person fields**

Following the same pattern against `STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier`:

| File | Type | Name | Options / notes |
|---|---|---|---|
| `person-school.field.ts` | SELECT | `school` | `CMU` (blue), `EMORY` (purple) |
| `person-alumni-path.field.ts` | SELECT | `alumniPath` | `DECISION_MAKER` (green), `REFERRAL` (blue) |
| `person-target-role.field.ts` | TEXT | `targetRole` | — |
| `person-evidence-url.field.ts` | LINKS | `evidenceUrl` | The URL proving the alumni claim |
| `person-evidence-summary.field.ts` | TEXT | `evidenceSummary` | — |
| `person-direct-email-status.field.ts` | SELECT | `directEmailStatus` | `ENRICHMENT_REQUIRED` (gray, default), `FOUND` (green), `NOT_FOUND` (orange), `LOW_CONFIDENCE` (yellow) |
| `person-research-links.field.ts` | LINKS | `researchLinks` | Same warning description as Company |

`alumniPath` deliberately has only two options even though the sheet holds six variants. Task 10 normalizes them.

- [ ] **Step 5: Add the Prospect relations to Company and Person**

`prospect-company.field.ts` — MANY_TO_ONE from Prospect to standard Company:

```ts
import { defineField, FieldType, OnDeleteAction, RelationType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';
import { PROSPECT_OBJECT_ID, PROSPECT_COMPANY_FIELD_ID, COMPANY_PROSPECTS_FIELD_ID } from '../constants/universal-identifiers';

export default defineField({
  universalIdentifier: PROSPECT_COMPANY_FIELD_ID,
  objectUniversalIdentifier: PROSPECT_OBJECT_ID,
  type: FieldType.RELATION,
  name: 'company',
  label: 'Company',
  icon: 'IconBuildingSkyscraper',
  relationTargetObjectMetadataUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.company.universalIdentifier,
  relationTargetFieldMetadataUniversalIdentifier: COMPANY_PROSPECTS_FIELD_ID,
  universalSettings: {
    relationType: RelationType.MANY_TO_ONE,
    onDelete: OnDeleteAction.SET_NULL,
    joinColumnName: 'companyId',
  },
});
```

`company-prospects.field.ts` is the reverse: `universalIdentifier: COMPANY_PROSPECTS_FIELD_ID`, `objectUniversalIdentifier: …company.universalIdentifier`, `name: 'prospects'`, `label: 'Prospects'`, target object `PROSPECT_OBJECT_ID`, target field `PROSPECT_COMPANY_FIELD_ID`, `relationType: RelationType.ONE_TO_MANY`.

Repeat for `prospect-person.field.ts` / `person-prospects.field.ts` using `PROSPECT_PERSON_FIELD_ID` / `PERSON_PROSPECTS_FIELD_ID`, name `person` / `prospects`, `joinColumnName: 'personId'`.

MANY_TO_ONE is correct on both: 34 sheet rows share a company, and a person could plausibly be re-prospected later.

- [ ] **Step 6: Typecheck, deploy, verify**

Run: `cd twenty-app && yarn typecheck && yarn deploy`

In Twenty, open a Company record and confirm Segment, Region, Country, Headcount status, Research links, Suppressed, and Prospects all appear. Do the same on a Person record.

- [ ] **Step 7: Commit**

```bash
git add twenty-app/src/fields
git commit -m "feat(crm): extend Company and Person with research fields and Prospect relations"
```

---

### Task 7: Add the pipeline view and navigation

**Files:**
- Create: `twenty-app/src/views/prospect-pipeline.view.ts`, `twenty-app/src/navigation-menu-items/prospects.navigation-menu-item.ts`

**Interfaces:**
- Produces: a Prospects entry in the sidebar grouped by `stage`.

- [ ] **Step 1: Read a working example**

The plan cannot pin the exact view manifest shape across SDK versions, so copy the structure from a known-good example rather than guessing:

Run: `cat node_modules/twenty-sdk/dist/define/views/*.d.ts` from `twenty-app/`, or read `packages/twenty-apps/internal/real-estate/src/views/all-properties.view.ts` in a checkout of `twentyhq/twenty`.

- [ ] **Step 2: Define a kanban view grouped by stage**

Create the view over `PROSPECT_OBJECT_ID`, named "Pipeline", grouped by `PROSPECT_STAGE_FIELD_ID`, with visible fields `queueId`, `company`, `person`, `stage`, `leadSource`, `recommendedAiWorkflow`.

- [ ] **Step 3: Add the navigation item**

Create the navigation menu item pointing at the Prospects object with icon `IconTargetArrow`.

A view without a navigation item is invisible in the sidebar — the pitfall called out in Twenty's own app documentation.

- [ ] **Step 4: Deploy and verify**

Run: `cd twenty-app && yarn typecheck && yarn deploy`
Expected: Prospects appears in the sidebar and opens on the Pipeline view.

- [ ] **Step 5: Commit**

```bash
git add twenty-app/src/views twenty-app/src/navigation-menu-items
git commit -m "feat(crm): add Prospect pipeline view and navigation"
```

---

### Task 8: Set up the importer workspace

**Files:**
- Create: `scripts/import-prospects/types.ts`, `vitest.config.ts`
- Modify: `package.json`
- Copy: the workbook to `scripts/import-prospects/fixtures/prospects.xlsx`

**Interfaces:**
- Produces: `ParsedRow`, `CompanyInput`, `PersonInput`, `ProspectInput`, `OutreachInput`, `ImportPlan` — consumed by Tasks 9–13.

- [ ] **Step 1: Add dependencies**

Run:
```bash
npm install --save-dev vitest exceljs tsx @types/node
```

- [ ] **Step 2: Add scripts and vitest config**

Add to `package.json` scripts:

```json
"test": "vitest run",
"import:prospects": "tsx scripts/import-prospects/import.ts"
```

`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { environment: 'node', include: ['**/__tests__/**/*.test.ts'] },
});
```

- [ ] **Step 3: Copy the workbook and keep it out of git**

```bash
mkdir -p scripts/import-prospects/fixtures
cp "../Frater_AI_Labs_Public_Web_CMU_Emory_Prospects_v6_All_Emory_CMU_Startups.xlsx" \
   scripts/import-prospects/fixtures/prospects.xlsx
printf '\nscripts/import-prospects/fixtures/prospects.xlsx\n' >> .gitignore
```

The workbook holds named individuals' details and stays out of version control. Tests use a small derived fixture instead (Task 9).

- [ ] **Step 4: Define the types**

`scripts/import-prospects/types.ts`:

```ts
export type ParsedRow = {
  queueId: string;
  leadStatus: string;
  country: string;
  region: string;
  segment: string;
  company: string;
  website: string;
  leadPerson: string;
  leadTitle: string;
  school: string;
  alumniPath: string;
  evidenceUrl: string;
  evidenceSummary: string;
  headcount: string;
  headcountStatus: string;
  qualificationStatus: string;
  directEmail: string;
  directEmailStatus: string;
  companyLinkedInLookup: string;
  alumniEvidenceSearch: string;
  targetPersonSearch: string;
  targetRole: string;
  recommendedAiWorkflow: string;
  linkedInConnectionNote: string;
  connectionNoteCharacters: string;
  linkedInFollowUp: string;
  coldEmailSubject: string;
  coldEmail: string;
  owner: string;
  status: string;
  notes: string;
};

export type CompanyInput = {
  name: string;
  domainName?: { primaryLinkUrl: string };
  segment: string;
  region: string;
  country: string;
  headcountStatus: 'NEEDS_VERIFICATION' | 'LIKELY_STARTUP' | 'VERIFIED_IN_ICP' | 'VERIFIED_OUTSIDE_ICP';
  researchLinks?: { primaryLinkUrl: string; secondaryLinks?: { url: string }[] };
};

export type PersonInput = {
  name: { firstName: string; lastName: string };
  jobTitle: string;
  school: 'CMU' | 'EMORY' | null;
  alumniPath: 'DECISION_MAKER' | 'REFERRAL' | null;
  targetRole: string;
  evidenceUrl?: { primaryLinkUrl: string };
  evidenceSummary: string;
  directEmailStatus: 'ENRICHMENT_REQUIRED' | 'FOUND' | 'NOT_FOUND' | 'LOW_CONFIDENCE';
  researchLinks?: { primaryLinkUrl: string; secondaryLinks?: { url: string }[] };
  emails?: { primaryEmail: string };
};

export type ProspectInput = {
  queueId: string;
  stage: 'SOURCED';
  leadSource: 'ALUMNI_EVIDENCE' | 'CMU_STARTUP';
  qualificationStatus: string;
  recommendedAiWorkflow: string;
  importNotes: string;
};

export type OutreachInput = {
  title: string;
  channel: 'LINKEDIN_CONNECTION' | 'LINKEDIN_FOLLOW_UP' | 'COLD_EMAIL';
  subject: string;
  body: string;
  characterCount: number | null;
  status: 'DRAFT';
  generatedBy: 'HUMAN';
  model: string;
};

export type PlanEntry = {
  row: ParsedRow;
  company: CompanyInput;
  person: PersonInput;
  prospect: ProspectInput;
  outreaches: OutreachInput[];
};

export type ImportPlan = {
  entries: PlanEntry[];
  suppressedCompanies: { name: string; reason: string }[];
  warnings: string[];
};
```

- [ ] **Step 5: Verify the harness runs**

Run: `npm test`
Expected: vitest starts and reports no test files. That is a pass at this stage.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts scripts/import-prospects/types.ts .gitignore
git commit -m "chore(import): set up importer workspace and shared types"
```

---

### Task 9: Parse the workbook

**Files:**
- Create: `scripts/import-prospects/parse-workbook.ts`, `scripts/import-prospects/__tests__/parse-workbook.test.ts`, `scripts/import-prospects/__tests__/fixtures/mini.xlsx`

**Interfaces:**
- Produces: `parseWorkbook(filePath: string): Promise<ParsedRow[]>` and `SUPPRESSION_SHEET`/`MASTER_SHEET` constants.

- [ ] **Step 1: Build a small test fixture**

Generate a 3-row workbook with the exact 31 master headers plus a 2-row exclusion sheet, so tests never touch real personal data:

```bash
npx tsx -e "
import ExcelJS from 'exceljs';
const wb = new ExcelJS.Workbook();
const headers = ['Queue ID','Lead Status','Country','Region','Segment','Company','Website','CMU/Emory Lead Person','Lead Title','School','Alumni Path','Evidence URL','Evidence Summary','Headcount','Headcount Status','Qualification Status','Direct Email','Direct Email Status','Company LinkedIn / Lookup','Alumni Evidence Search','Target Person Search','Target Role','Recommended AI Workflow','LinkedIn Connection Note','Connection Note Characters','LinkedIn Follow-up','Cold Email Subject','Cold Email','Owner','Status','Notes'];
const ws = wb.addWorksheet('All Evidence Leads');
ws.addRow(headers);
ws.addRow(['EV-001','Evidence-backed CMU/Emory lead','USA','Atlanta, GA','Beverage','Acme Co','https://acme.test/','Ada Lovelace','CEO','Emory','Decision-maker alumni','https://evidence.test/a','CEO at Acme','','Needs headcount verification','Evidence-backed','','Enrichment required','https://www.google.com/search?q=acme','https://www.google.com/search?q=ada','https://www.google.com/search?q=ada+acme','CEO','support triage','Hi Ada - note','13','Thanks for connecting','Workflow idea for Acme','Hi Ada,','Seth','Not Contacted','n/a']);
ws.addRow(['CMU-001','Evidence-backed CMU startup lead','USA','Palo Alto, CA','AI','Beta Labs','https://beta.test/','Grace Hopper','Founder','CMU','Referral / company-level alumni startup','https://evidence.test/b','Founder at Beta','','Likely startup; verify 50-500','Evidence-backed','','Enrichment required','https://www.google.com/search?q=beta','https://www.google.com/search?q=grace','https://www.google.com/search?q=grace+beta','Founder','onboarding','Hi Grace - note','15','Thanks Grace','Workflow idea for Beta','Hi Grace,','Seth','Not Contacted','new row']);
const ex = wb.addWorksheet('Prior 50 Exclusion');
ex.addRow(['Prior Priority','Company','Country','Industry','Rule']);
ex.addRow(['1','Excluded Corp','USA','Field service','Exclude from additional list']);
await wb.xlsx.writeFile('scripts/import-prospects/__tests__/fixtures/mini.xlsx');
"
```

- [ ] **Step 2: Write the failing test**

`scripts/import-prospects/__tests__/parse-workbook.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseWorkbook, parseSuppressionList } from '../parse-workbook';

const FIXTURE = 'scripts/import-prospects/__tests__/fixtures/mini.xlsx';

describe('parseWorkbook', () => {
  it('reads only the master sheet', async () => {
    const rows = await parseWorkbook(FIXTURE);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.queueId)).toEqual(['EV-001', 'CMU-001']);
  });

  it('maps every column by header name, not position', async () => {
    const [first] = await parseWorkbook(FIXTURE);
    expect(first.company).toBe('Acme Co');
    expect(first.leadPerson).toBe('Ada Lovelace');
    expect(first.school).toBe('Emory');
    expect(first.coldEmailSubject).toBe('Workflow idea for Acme');
    expect(first.owner).toBe('Seth');
  });

  it('returns empty strings rather than undefined for blank cells', async () => {
    const [first] = await parseWorkbook(FIXTURE);
    expect(first.directEmail).toBe('');
    expect(first.headcount).toBe('');
  });

  it('reads the suppression list separately', async () => {
    const suppressed = await parseSuppressionList(FIXTURE);
    expect(suppressed).toEqual([{ name: 'Excluded Corp', reason: 'Exclude from additional list' }]);
  });

  it('throws if the master sheet is missing', async () => {
    await expect(parseWorkbook('scripts/import-prospects/__tests__/fixtures/does-not-exist.xlsx'))
      .rejects.toThrow();
  });
});
```

- [ ] **Step 3: Run it and confirm it fails**

Run: `npx vitest run scripts/import-prospects/__tests__/parse-workbook.test.ts`
Expected: FAIL — cannot resolve `../parse-workbook`.

- [ ] **Step 4: Implement the parser**

```ts
import ExcelJS from 'exceljs';
import type { ParsedRow } from './types';

export const MASTER_SHEET = 'All Evidence Leads';
export const SUPPRESSION_SHEET = 'Prior 50 Exclusion';

const HEADER_TO_KEY: Record<string, keyof ParsedRow> = {
  'Queue ID': 'queueId',
  'Lead Status': 'leadStatus',
  'Country': 'country',
  'Region': 'region',
  'Segment': 'segment',
  'Company': 'company',
  'Website': 'website',
  'CMU/Emory Lead Person': 'leadPerson',
  'Lead Title': 'leadTitle',
  'School': 'school',
  'Alumni Path': 'alumniPath',
  'Evidence URL': 'evidenceUrl',
  'Evidence Summary': 'evidenceSummary',
  'Headcount': 'headcount',
  'Headcount Status': 'headcountStatus',
  'Qualification Status': 'qualificationStatus',
  'Direct Email': 'directEmail',
  'Direct Email Status': 'directEmailStatus',
  'Company LinkedIn / Lookup': 'companyLinkedInLookup',
  'Alumni Evidence Search': 'alumniEvidenceSearch',
  'Target Person Search': 'targetPersonSearch',
  'Target Role': 'targetRole',
  'Recommended AI Workflow': 'recommendedAiWorkflow',
  'LinkedIn Connection Note': 'linkedInConnectionNote',
  'Connection Note Characters': 'connectionNoteCharacters',
  'LinkedIn Follow-up': 'linkedInFollowUp',
  'Cold Email Subject': 'coldEmailSubject',
  'Cold Email': 'coldEmail',
  'Owner': 'owner',
  'Status': 'status',
  'Notes': 'notes',
};

const cellText = (value: ExcelJS.CellValue): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object' && 'text' in value) return String(value.text).trim();
  if (typeof value === 'object' && 'result' in value) return String(value.result ?? '').trim();
  if (typeof value === 'object' && 'richText' in value) {
    return (value.richText as { text: string }[]).map((part) => part.text).join('').trim();
  }
  return String(value).trim();
};

const readSheet = async (filePath: string, sheetName: string) => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const sheet = workbook.getWorksheet(sheetName);
  if (!sheet) throw new Error(`Sheet "${sheetName}" not found in ${filePath}`);
  return sheet;
};

export const parseWorkbook = async (filePath: string): Promise<ParsedRow[]> => {
  const sheet = await readSheet(filePath, MASTER_SHEET);
  const headers = (sheet.getRow(1).values as ExcelJS.CellValue[]).map(cellText);

  const rows: ParsedRow[] = [];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const values = row.values as ExcelJS.CellValue[];
    const parsed = {} as ParsedRow;

    for (const key of Object.values(HEADER_TO_KEY)) parsed[key] = '';

    headers.forEach((header, index) => {
      const key = HEADER_TO_KEY[header];
      if (key) parsed[key] = cellText(values[index]);
    });

    if (parsed.queueId) rows.push(parsed);
  });

  return rows;
};

export const parseSuppressionList = async (
  filePath: string,
): Promise<{ name: string; reason: string }[]> => {
  const sheet = await readSheet(filePath, SUPPRESSION_SHEET);
  const headers = (sheet.getRow(1).values as ExcelJS.CellValue[]).map(cellText);
  const nameIndex = headers.indexOf('Company');
  const ruleIndex = headers.indexOf('Rule');

  const suppressed: { name: string; reason: string }[] = [];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const values = row.values as ExcelJS.CellValue[];
    const name = cellText(values[nameIndex]);
    if (name) suppressed.push({ name, reason: cellText(values[ruleIndex]) });
  });

  return suppressed;
};
```

Headers drive the mapping, never column position — a reordered column would otherwise silently shift every field.

- [ ] **Step 5: Run the tests**

Run: `npx vitest run scripts/import-prospects/__tests__/parse-workbook.test.ts`
Expected: 5 passed.

- [ ] **Step 6: Verify against the real workbook**

Run:
```bash
npx tsx -e "
import { parseWorkbook } from './scripts/import-prospects/parse-workbook';
const rows = await parseWorkbook('scripts/import-prospects/fixtures/prospects.xlsx');
console.log('rows:', rows.length);
console.log('unique companies:', new Set(rows.map(r => r.company)).size);
console.log('with direct email:', rows.filter(r => r.directEmail).length);
"
```
Expected exactly: `rows: 252`, `unique companies: 218`, `with direct email: 0`.

If any number differs, stop and reconcile before continuing — those three figures are the contract the rest of the import depends on.

- [ ] **Step 7: Commit**

```bash
git add scripts/import-prospects/parse-workbook.ts scripts/import-prospects/__tests__
git commit -m "feat(import): parse master sheet and suppression list"
```

---

### Task 10: Normalize the messy columns

**Files:**
- Create: `scripts/import-prospects/normalize.ts`, `scripts/import-prospects/__tests__/normalize.test.ts`

**Interfaces:**
- Produces: `normalizeAlumniPath`, `normalizeSchool`, `normalizeHeadcountStatus`, `splitFullName`, `isSearchUrl`, `toDomainName`, `buildResearchLinks`, `countCharacters`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import {
  normalizeAlumniPath, normalizeSchool, normalizeHeadcountStatus,
  splitFullName, isSearchUrl, toDomainName, buildResearchLinks, countCharacters,
} from '../normalize';

describe('normalizeAlumniPath', () => {
  it('maps all six observed variants to two values', () => {
    expect(normalizeAlumniPath('Decision-maker alumni')).toBe('DECISION_MAKER');
    expect(normalizeAlumniPath('Referral alumni')).toBe('REFERRAL');
    expect(normalizeAlumniPath('Decision-maker / CMU connection')).toBe('DECISION_MAKER');
    expect(normalizeAlumniPath('Referral / Goizueta advisory connection')).toBe('REFERRAL');
    expect(normalizeAlumniPath('Referral / company-level alumni startup')).toBe('REFERRAL');
    expect(normalizeAlumniPath('Decision-maker/referral alumni')).toBe('DECISION_MAKER');
  });

  it('returns null for unknown input rather than guessing', () => {
    expect(normalizeAlumniPath('')).toBeNull();
    expect(normalizeAlumniPath('Something else')).toBeNull();
  });
});

describe('normalizeSchool', () => {
  it('maps school names', () => {
    expect(normalizeSchool('Emory')).toBe('EMORY');
    expect(normalizeSchool('CMU')).toBe('CMU');
    expect(normalizeSchool('unknown')).toBeNull();
  });
});

describe('normalizeHeadcountStatus', () => {
  it('maps the two observed statuses', () => {
    expect(normalizeHeadcountStatus('Needs headcount verification')).toBe('NEEDS_VERIFICATION');
    expect(normalizeHeadcountStatus('Likely startup; verify 50-500')).toBe('LIKELY_STARTUP');
    expect(normalizeHeadcountStatus('Likely startup; verify 50–500')).toBe('LIKELY_STARTUP');
  });

  it('defaults to needing verification', () => {
    expect(normalizeHeadcountStatus('')).toBe('NEEDS_VERIFICATION');
  });
});

describe('splitFullName', () => {
  it('splits on the first space', () => {
    expect(splitFullName('Ada Lovelace')).toEqual({ firstName: 'Ada', lastName: 'Lovelace' });
  });

  it('keeps multi-word surnames intact', () => {
    expect(splitFullName('Sean Hengxiao Tao')).toEqual({ firstName: 'Sean', lastName: 'Hengxiao Tao' });
  });

  it('handles a single name', () => {
    expect(splitFullName('Cher')).toEqual({ firstName: 'Cher', lastName: '' });
  });
});

describe('isSearchUrl', () => {
  it('detects Google search URLs', () => {
    expect(isSearchUrl('https://www.google.com/search?q=site%3Alinkedin.com')).toBe(true);
  });

  it('does not flag real profile URLs', () => {
    expect(isSearchUrl('https://www.linkedin.com/in/someone')).toBe(false);
    expect(isSearchUrl('')).toBe(false);
  });
});

describe('toDomainName', () => {
  it('produces a Twenty LINKS value', () => {
    expect(toDomainName('https://acme.test/')).toEqual({ primaryLinkUrl: 'https://acme.test/' });
  });

  it('returns undefined for blanks', () => {
    expect(toDomainName('')).toBeUndefined();
  });
});

describe('buildResearchLinks', () => {
  it('collects search URLs into one LINKS value', () => {
    const links = buildResearchLinks([
      'https://www.google.com/search?q=a',
      'https://www.google.com/search?q=b',
      '',
    ]);
    expect(links).toEqual({
      primaryLinkUrl: 'https://www.google.com/search?q=a',
      secondaryLinks: [{ url: 'https://www.google.com/search?q=b' }],
    });
  });

  it('returns undefined when there is nothing to store', () => {
    expect(buildResearchLinks(['', ''])).toBeUndefined();
  });
});

describe('countCharacters', () => {
  it('prefers the actual body length over the sheet value', () => {
    expect(countCharacters('hello', '99')).toBe(5);
  });

  it('returns null with no body', () => {
    expect(countCharacters('', '12')).toBeNull();
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run scripts/import-prospects/__tests__/normalize.test.ts`
Expected: FAIL — cannot resolve `../normalize`.

- [ ] **Step 3: Implement**

```ts
import type { CompanyInput, PersonInput } from './types';

export const normalizeAlumniPath = (raw: string): PersonInput['alumniPath'] => {
  const value = raw.trim().toLowerCase();
  if (!value) return null;
  if (value.startsWith('decision-maker')) return 'DECISION_MAKER';
  if (value.startsWith('referral')) return 'REFERRAL';
  return null;
};

export const normalizeSchool = (raw: string): PersonInput['school'] => {
  const value = raw.trim().toUpperCase();
  if (value === 'CMU') return 'CMU';
  if (value === 'EMORY') return 'EMORY';
  return null;
};

export const normalizeHeadcountStatus = (raw: string): CompanyInput['headcountStatus'] => {
  const value = raw.trim().toLowerCase();
  if (value.includes('likely startup')) return 'LIKELY_STARTUP';
  return 'NEEDS_VERIFICATION';
};

export const splitFullName = (raw: string): { firstName: string; lastName: string } => {
  const parts = raw.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: '', lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
};

export const isSearchUrl = (raw: string): boolean =>
  raw.includes('google.com/search') || raw.includes('bing.com/search');

export const toDomainName = (raw: string): CompanyInput['domainName'] => {
  const value = raw.trim();
  return value ? { primaryLinkUrl: value } : undefined;
};

export const buildResearchLinks = (
  candidates: string[],
): CompanyInput['researchLinks'] => {
  const urls = candidates.map((c) => c.trim()).filter(Boolean);
  if (urls.length === 0) return undefined;
  const [primaryLinkUrl, ...rest] = urls;
  return rest.length > 0
    ? { primaryLinkUrl, secondaryLinks: rest.map((url) => ({ url })) }
    : { primaryLinkUrl };
};

export const countCharacters = (body: string, _sheetValue: string): number | null =>
  body.trim() ? body.length : null;
```

`normalizeAlumniPath` returns `null` rather than defaulting, so unmapped variants surface as warnings in Task 11 instead of being silently miscategorised. `countCharacters` recomputes from the body because the sheet's stored count can drift from the text.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run scripts/import-prospects/__tests__/normalize.test.ts`
Expected: all passed.

- [ ] **Step 5: Verify every real value maps**

Run:
```bash
npx tsx -e "
import { parseWorkbook } from './scripts/import-prospects/parse-workbook';
import { normalizeAlumniPath } from './scripts/import-prospects/normalize';
const rows = await parseWorkbook('scripts/import-prospects/fixtures/prospects.xlsx');
const unmapped = rows.filter(r => normalizeAlumniPath(r.alumniPath) === null);
console.log('unmapped alumni paths:', unmapped.length);
console.log([...new Set(unmapped.map(r => r.alumniPath))]);
"
```
Expected: `unmapped alumni paths: 0`. Any non-zero result means a variant needs adding to the normalizer.

- [ ] **Step 6: Commit**

```bash
git add scripts/import-prospects/normalize.ts scripts/import-prospects/__tests__/normalize.test.ts
git commit -m "feat(import): normalize alumni paths, names, and research links"
```

---

### Task 11: Build the import plan

**Files:**
- Create: `scripts/import-prospects/build-plan.ts`, `scripts/import-prospects/__tests__/build-plan.test.ts`

**Interfaces:**
- Produces: `buildPlan(rows: ParsedRow[], suppressed: {name,reason}[]): ImportPlan`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { buildPlan } from '../build-plan';
import type { ParsedRow } from '../types';

const row = (over: Partial<ParsedRow> = {}): ParsedRow => ({
  queueId: 'EV-001', leadStatus: '', country: 'USA', region: 'Atlanta, GA',
  segment: 'Beverage', company: 'Acme Co', website: 'https://acme.test/',
  leadPerson: 'Ada Lovelace', leadTitle: 'CEO', school: 'Emory',
  alumniPath: 'Decision-maker alumni', evidenceUrl: 'https://evidence.test/a',
  evidenceSummary: 'CEO at Acme', headcount: '', headcountStatus: 'Needs headcount verification',
  qualificationStatus: 'Evidence-backed', directEmail: '', directEmailStatus: 'Enrichment required',
  companyLinkedInLookup: 'https://www.google.com/search?q=acme',
  alumniEvidenceSearch: 'https://www.google.com/search?q=ada',
  targetPersonSearch: 'https://www.google.com/search?q=ada+acme',
  targetRole: 'CEO', recommendedAiWorkflow: 'support triage',
  linkedInConnectionNote: 'Hi Ada', connectionNoteCharacters: '6',
  linkedInFollowUp: 'Thanks', coldEmailSubject: 'Workflow idea', coldEmail: 'Hi Ada,',
  owner: 'Seth', status: 'Not Contacted', notes: 'n/a', ...over,
});

describe('buildPlan', () => {
  it('creates one entry per row', () => {
    const plan = buildPlan([row(), row({ queueId: 'EV-002' })], []);
    expect(plan.entries).toHaveLength(2);
  });

  it('routes search URLs to researchLinks and never to a profile field', () => {
    const [entry] = buildPlan([row()], []).entries;
    expect(entry.company.researchLinks?.primaryLinkUrl).toContain('google.com/search');
    expect(JSON.stringify(entry.company)).not.toContain('linkedinLink');
    expect(entry.company.domainName).toEqual({ primaryLinkUrl: 'https://acme.test/' });
  });

  it('imports every prospect at SOURCED', () => {
    const [entry] = buildPlan([row()], []).entries;
    expect(entry.prospect.stage).toBe('SOURCED');
  });

  it('derives leadSource from the queue id prefix', () => {
    expect(buildPlan([row()], []).entries[0].prospect.leadSource).toBe('ALUMNI_EVIDENCE');
    expect(buildPlan([row({ queueId: 'CMU-007' })], []).entries[0].prospect.leadSource).toBe('CMU_STARTUP');
  });

  it('builds three outreach drafts when all copy is present', () => {
    const [entry] = buildPlan([row()], []).entries;
    expect(entry.outreaches.map((o) => o.channel)).toEqual([
      'LINKEDIN_CONNECTION', 'LINKEDIN_FOLLOW_UP', 'COLD_EMAIL',
    ]);
    expect(entry.outreaches.every((o) => o.status === 'DRAFT')).toBe(true);
    expect(entry.outreaches.every((o) => o.generatedBy === 'HUMAN')).toBe(true);
  });

  it('skips outreach drafts with no body', () => {
    const [entry] = buildPlan([row({ linkedInFollowUp: '', coldEmail: '' })], []).entries;
    expect(entry.outreaches).toHaveLength(1);
  });

  it('warns when a connection note exceeds the LinkedIn limit', () => {
    const plan = buildPlan([row({ linkedInConnectionNote: 'x'.repeat(201) })], []);
    expect(plan.warnings.some((w) => w.includes('EV-001') && w.includes('200'))).toBe(true);
  });

  it('warns on an unmapped alumni path but still imports the row', () => {
    const plan = buildPlan([row({ alumniPath: 'Mystery' })], []);
    expect(plan.entries).toHaveLength(1);
    expect(plan.entries[0].person.alumniPath).toBeNull();
    expect(plan.warnings.some((w) => w.includes('alumni path'))).toBe(true);
  });

  it('preserves the original alumni path in importNotes', () => {
    const [entry] = buildPlan([row({ alumniPath: 'Decision-maker / CMU connection' })], []).entries;
    expect(entry.prospect.importNotes).toContain('Decision-maker / CMU connection');
  });

  it('passes the suppression list through', () => {
    const plan = buildPlan([row()], [{ name: 'Excluded Corp', reason: 'Exclude' }]);
    expect(plan.suppressedCompanies).toEqual([{ name: 'Excluded Corp', reason: 'Exclude' }]);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run scripts/import-prospects/__tests__/build-plan.test.ts`
Expected: FAIL — cannot resolve `../build-plan`.

- [ ] **Step 3: Implement**

```ts
import {
  buildResearchLinks, countCharacters, normalizeAlumniPath, normalizeHeadcountStatus,
  normalizeSchool, splitFullName, toDomainName,
} from './normalize';
import type { ImportPlan, OutreachInput, ParsedRow, PlanEntry } from './types';

const LINKEDIN_NOTE_LIMIT = 200;

const buildOutreaches = (row: ParsedRow, warnings: string[]): OutreachInput[] => {
  const drafts: OutreachInput[] = [];

  if (row.linkedInConnectionNote.trim()) {
    const count = countCharacters(row.linkedInConnectionNote, row.connectionNoteCharacters);
    if (count !== null && count > LINKEDIN_NOTE_LIMIT) {
      warnings.push(
        `${row.queueId}: LinkedIn connection note is ${count} characters, over the ${LINKEDIN_NOTE_LIMIT} limit`,
      );
    }
    drafts.push({
      title: `${row.queueId} · LinkedIn connection`,
      channel: 'LINKEDIN_CONNECTION',
      subject: '',
      body: row.linkedInConnectionNote,
      characterCount: count,
      status: 'DRAFT',
      generatedBy: 'HUMAN',
      model: '',
    });
  }

  if (row.linkedInFollowUp.trim()) {
    drafts.push({
      title: `${row.queueId} · LinkedIn follow-up`,
      channel: 'LINKEDIN_FOLLOW_UP',
      subject: '',
      body: row.linkedInFollowUp,
      characterCount: countCharacters(row.linkedInFollowUp, ''),
      status: 'DRAFT',
      generatedBy: 'HUMAN',
      model: '',
    });
  }

  if (row.coldEmail.trim()) {
    drafts.push({
      title: `${row.queueId} · Cold email`,
      channel: 'COLD_EMAIL',
      subject: row.coldEmailSubject,
      body: row.coldEmail,
      characterCount: countCharacters(row.coldEmail, ''),
      status: 'DRAFT',
      generatedBy: 'HUMAN',
      model: '',
    });
  }

  return drafts;
};

export const buildPlan = (
  rows: ParsedRow[],
  suppressedCompanies: { name: string; reason: string }[],
): ImportPlan => {
  const warnings: string[] = [];

  const entries: PlanEntry[] = rows.map((row) => {
    const alumniPath = normalizeAlumniPath(row.alumniPath);
    if (alumniPath === null && row.alumniPath.trim()) {
      warnings.push(`${row.queueId}: unmapped alumni path "${row.alumniPath}"`);
    }

    const importNotes = [
      row.notes,
      row.alumniPath ? `Original alumni path: ${row.alumniPath}` : '',
      row.leadStatus ? `Original lead status: ${row.leadStatus}` : '',
      row.status ? `Original status: ${row.status}` : '',
      row.owner ? `Original owner: ${row.owner}` : '',
    ].filter(Boolean).join(' | ');

    return {
      row,
      company: {
        name: row.company,
        domainName: toDomainName(row.website),
        segment: row.segment,
        region: row.region,
        country: row.country,
        headcountStatus: normalizeHeadcountStatus(row.headcountStatus),
        researchLinks: buildResearchLinks([row.companyLinkedInLookup]),
      },
      person: {
        name: splitFullName(row.leadPerson),
        jobTitle: row.leadTitle,
        school: normalizeSchool(row.school),
        alumniPath,
        targetRole: row.targetRole,
        evidenceUrl: row.evidenceUrl.trim() ? { primaryLinkUrl: row.evidenceUrl } : undefined,
        evidenceSummary: row.evidenceSummary,
        directEmailStatus: row.directEmail.trim() ? 'FOUND' : 'ENRICHMENT_REQUIRED',
        researchLinks: buildResearchLinks([row.alumniEvidenceSearch, row.targetPersonSearch]),
        emails: row.directEmail.trim() ? { primaryEmail: row.directEmail } : undefined,
      },
      prospect: {
        queueId: row.queueId,
        stage: 'SOURCED',
        leadSource: row.queueId.startsWith('CMU-') ? 'CMU_STARTUP' : 'ALUMNI_EVIDENCE',
        qualificationStatus: row.qualificationStatus,
        recommendedAiWorkflow: row.recommendedAiWorkflow,
        importNotes,
      },
      outreaches: buildOutreaches(row, warnings),
    };
  });

  return { entries, suppressedCompanies, warnings };
};
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run scripts/import-prospects/__tests__/build-plan.test.ts`
Expected: all passed.

- [ ] **Step 5: Commit**

```bash
git add scripts/import-prospects/build-plan.ts scripts/import-prospects/__tests__/build-plan.test.ts
git commit -m "feat(import): build import plan from parsed rows"
```

---

### Task 12: Twenty REST client with idempotent upserts

**Files:**
- Create: `scripts/import-prospects/twenty-rest.ts`, `scripts/import-prospects/apply-plan.ts`, `scripts/import-prospects/__tests__/apply-plan.test.ts`

**Interfaces:**
- Produces: `TwentyClient` with `findCompanyByName`, `createCompany`, `updateCompany`, `findPersonByName`, `createPerson`, `updatePerson`, `findProspectByQueueId`, `createProspect`, `updateProspect`, `findOutreachByTitle`, `createOutreach`, `updateOutreach`, `findWorkspaceMemberByEmail`; and `applyPlan(plan, client, options)`.

- [ ] **Step 1: Write the REST client**

```ts
const BASE = process.env.TWENTY_BASE_URL ?? 'https://crm.fraterailabs.com';

export type TwentyRecord = { id: string; [key: string]: unknown };

const request = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
  const apiKey = process.env.TWENTY_API_KEY;
  if (!apiKey) throw new Error('TWENTY_API_KEY is not set');

  const response = await fetch(`${BASE}/rest${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`Twenty ${init.method ?? 'GET'} ${path} failed: ${response.status} ${await response.text()}`);
  }

  return (await response.json()) as T;
};

const firstRecord = (payload: unknown, plural: string): TwentyRecord | null => {
  const data = (payload as { data?: Record<string, TwentyRecord[]> }).data;
  const records = data?.[plural] ?? [];
  return records.length > 0 ? records[0] : null;
};

export const createTwentyClient = () => ({
  findByFilter: async (plural: string, filter: string) =>
    firstRecord(await request(`/${plural}?filter=${encodeURIComponent(filter)}&limit=1`), plural),

  create: async (plural: string, body: unknown) =>
    request<{ data: Record<string, TwentyRecord> }>(`/${plural}`, {
      method: 'POST', body: JSON.stringify(body),
    }),

  update: async (plural: string, id: string, body: unknown) =>
    request<{ data: Record<string, TwentyRecord> }>(`/${plural}/${id}`, {
      method: 'PATCH', body: JSON.stringify(body),
    }),
});

export type TwentyClient = ReturnType<typeof createTwentyClient>;
```

Confirm the filter syntax against your server before the live run: `curl -H "Authorization: Bearer $TWENTY_API_KEY" "$TWENTY_BASE_URL/rest/companies?filter=name[eq]:Acme&limit=1"`. Twenty's REST filter grammar changes between versions; adjust `findByFilter` callers if the shape differs.

- [ ] **Step 2: Write the failing test for apply-plan**

```ts
import { describe, expect, it, vi } from 'vitest';
import { applyPlan } from '../apply-plan';
import { buildPlan } from '../build-plan';
import type { ParsedRow } from '../types';

const row = (over: Partial<ParsedRow> = {}): ParsedRow => ({
  queueId: 'EV-001', leadStatus: '', country: 'USA', region: 'GA', segment: 'Bev',
  company: 'Acme Co', website: 'https://acme.test/', leadPerson: 'Ada Lovelace',
  leadTitle: 'CEO', school: 'Emory', alumniPath: 'Decision-maker alumni',
  evidenceUrl: 'https://e.test/a', evidenceSummary: 'CEO', headcount: '',
  headcountStatus: 'Needs headcount verification', qualificationStatus: 'ok',
  directEmail: '', directEmailStatus: 'Enrichment required',
  companyLinkedInLookup: 'https://www.google.com/search?q=acme',
  alumniEvidenceSearch: '', targetPersonSearch: '', targetRole: 'CEO',
  recommendedAiWorkflow: 'triage', linkedInConnectionNote: 'Hi',
  connectionNoteCharacters: '2', linkedInFollowUp: '', coldEmailSubject: '',
  coldEmail: '', owner: 'Seth', status: 'Not Contacted', notes: '', ...over,
});

const fakeClient = (existing: Record<string, { id: string } | null> = {}) => ({
  findByFilter: vi.fn(async (plural: string) => existing[plural] ?? null),
  create: vi.fn(async (plural: string) => ({ data: { [plural.slice(0, -1)]: { id: `new-${plural}` } } })),
  update: vi.fn(async (plural: string) => ({ data: { [plural.slice(0, -1)]: { id: `upd-${plural}` } } })),
});

describe('applyPlan', () => {
  it('writes nothing in dry-run mode', async () => {
    const client = fakeClient();
    const result = await applyPlan(buildPlan([row()], []), client as never, { dryRun: true });
    expect(client.create).not.toHaveBeenCalled();
    expect(client.update).not.toHaveBeenCalled();
    expect(result.wouldCreate.prospects).toBe(1);
  });

  it('creates records when nothing exists', async () => {
    const client = fakeClient();
    await applyPlan(buildPlan([row()], []), client as never, { dryRun: false });
    const created = client.create.mock.calls.map((c) => c[0]);
    expect(created).toContain('companies');
    expect(created).toContain('people');
    expect(created).toContain('prospects');
  });

  it('updates instead of duplicating when the prospect already exists', async () => {
    const client = fakeClient({ prospects: { id: 'p1' }, companies: { id: 'c1' }, people: { id: 'pe1' } });
    await applyPlan(buildPlan([row()], []), client as never, { dryRun: false });
    expect(client.create).not.toHaveBeenCalledWith('prospects', expect.anything());
    expect(client.update).toHaveBeenCalledWith('prospects', 'p1', expect.anything());
  });

  it('reports per-row failures without aborting the run', async () => {
    const client = fakeClient();
    client.create.mockRejectedValueOnce(new Error('boom'));
    const result = await applyPlan(buildPlan([row(), row({ queueId: 'EV-002' })], []), client as never, { dryRun: false });
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0].queueId).toBe('EV-001');
  });
});
```

- [ ] **Step 3: Run it and confirm it fails**

Run: `npx vitest run scripts/import-prospects/__tests__/apply-plan.test.ts`
Expected: FAIL — cannot resolve `../apply-plan`.

- [ ] **Step 4: Implement apply-plan**

```ts
import type { ImportPlan, PlanEntry } from './types';
import type { TwentyClient } from './twenty-rest';

export type ApplyOptions = { dryRun: boolean };

export type ApplyResult = {
  wouldCreate: { companies: number; people: number; prospects: number; outreaches: number };
  created: { companies: number; people: number; prospects: number; outreaches: number };
  updated: { companies: number; people: number; prospects: number; outreaches: number };
  failures: { queueId: string; error: string }[];
  warnings: string[];
};

const emptyCounts = () => ({ companies: 0, people: 0, prospects: 0, outreaches: 0 });

const upsert = async (
  client: TwentyClient, plural: string, filter: string, body: Record<string, unknown>,
  result: ApplyResult,
): Promise<string> => {
  const existing = await client.findByFilter(plural, filter);
  if (existing) {
    await client.update(plural, existing.id, body);
    result.updated[plural as keyof ApplyResult['updated']] += 1;
    return existing.id;
  }
  const created = await client.create(plural, body);
  result.created[plural as keyof ApplyResult['created']] += 1;
  return Object.values(created.data)[0].id;
};

const applyEntry = async (entry: PlanEntry, client: TwentyClient, result: ApplyResult) => {
  const companyId = await upsert(
    client, 'companies', `name[eq]:${entry.company.name}`, entry.company as never, result,
  );

  const personFilter = `name.firstName[eq]:${entry.person.name.firstName},name.lastName[eq]:${entry.person.name.lastName}`;
  const personId = await upsert(
    client, 'people', personFilter, { ...entry.person, companyId } as never, result,
  );

  const prospectId = await upsert(
    client, 'prospects', `queueId[eq]:${entry.prospect.queueId}`,
    { ...entry.prospect, companyId, personId } as never, result,
  );

  for (const outreach of entry.outreaches) {
    await upsert(
      client, 'outreaches', `title[eq]:${outreach.title}`,
      { ...outreach, prospectId } as never, result,
    );
  }
};

export const applyPlan = async (
  plan: ImportPlan, client: TwentyClient, options: ApplyOptions,
): Promise<ApplyResult> => {
  const result: ApplyResult = {
    wouldCreate: emptyCounts(), created: emptyCounts(), updated: emptyCounts(),
    failures: [], warnings: plan.warnings,
  };

  if (options.dryRun) {
    result.wouldCreate.companies = new Set(plan.entries.map((e) => e.company.name)).size;
    result.wouldCreate.people = plan.entries.length;
    result.wouldCreate.prospects = plan.entries.length;
    result.wouldCreate.outreaches = plan.entries.reduce((sum, e) => sum + e.outreaches.length, 0);
    return result;
  }

  for (const entry of plan.entries) {
    try {
      await applyEntry(entry, client, result);
    } catch (error) {
      result.failures.push({
        queueId: entry.prospect.queueId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return result;
};
```

Each row is wrapped independently so one bad record cannot abort the remaining 251. Because there is no cross-record transaction, a row that fails midway leaves a partial write — the next run reconciles it via the `queueId` upsert.

- [ ] **Step 5: Run the tests**

Run: `npx vitest run scripts/import-prospects/__tests__/apply-plan.test.ts`
Expected: 4 passed.

- [ ] **Step 6: Commit**

```bash
git add scripts/import-prospects/twenty-rest.ts scripts/import-prospects/apply-plan.ts scripts/import-prospects/__tests__/apply-plan.test.ts
git commit -m "feat(import): idempotent Twenty upserts with per-row failure isolation"
```

---

### Task 13: Run the import

**Files:**
- Create: `scripts/import-prospects/import.ts`
- Modify: `docs/runbooks/twenty-railway.md`

**Interfaces:**
- Consumes: everything from Tasks 9–12.
- Produces: 252 prospects live in Twenty.

- [ ] **Step 1: Write the CLI entry point**

```ts
import { applyPlan } from './apply-plan';
import { buildPlan } from './build-plan';
import { parseSuppressionList, parseWorkbook } from './parse-workbook';
import { createTwentyClient } from './twenty-rest';

const WORKBOOK = process.env.WORKBOOK_PATH ?? 'scripts/import-prospects/fixtures/prospects.xlsx';

const main = async () => {
  const dryRun = !process.argv.includes('--apply');

  const rows = await parseWorkbook(WORKBOOK);
  const suppressed = await parseSuppressionList(WORKBOOK);
  const plan = buildPlan(rows, suppressed);

  console.log(`Parsed ${rows.length} rows, ${suppressed.length} suppressed companies`);

  if (plan.warnings.length > 0) {
    console.log(`\n${plan.warnings.length} warnings:`);
    for (const warning of plan.warnings) console.log(`  - ${warning}`);
  }

  const result = await applyPlan(plan, createTwentyClient(), { dryRun });

  if (dryRun) {
    console.log('\nDRY RUN — nothing written. Would create:');
    console.log(result.wouldCreate);
    console.log('\nRe-run with --apply to write.');
    return;
  }

  console.log('\nCreated:', result.created);
  console.log('Updated:', result.updated);

  if (result.failures.length > 0) {
    console.log(`\n${result.failures.length} failures:`);
    for (const failure of result.failures) console.log(`  - ${failure.queueId}: ${failure.error}`);
    process.exitCode = 1;
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

- [ ] **Step 2: Dry-run against the real workbook**

Run:
```bash
export TWENTY_BASE_URL=https://crm.fraterailabs.com
export TWENTY_API_KEY=<the key from Task 1>
npm run import:prospects
```

Expected: `Parsed 252 rows, 50 suppressed companies`, and `wouldCreate` showing `companies: 218, people: 252, prospects: 252`. Read every warning before continuing.

- [ ] **Step 3: Apply**

Run: `npx tsx scripts/import-prospects/import.ts --apply`
Expected: created counts matching the dry run, zero failures.

- [ ] **Step 4: Verify counts in Twenty**

Run:
```bash
curl -fsS "$TWENTY_BASE_URL/rest/prospects?limit=1" -H "Authorization: Bearer $TWENTY_API_KEY" \
  | head -c 300
```

Then in the Twenty UI confirm: Prospects shows 252 records, all at Sourced; Companies shows 218; a spot-checked prospect has its company, person, and outreach drafts linked.

- [ ] **Step 5: Prove idempotency**

Run: `npx tsx scripts/import-prospects/import.ts --apply`

Expected: `created` all zero, `updated` non-zero. Confirm Prospects still shows **252**, not 504. This is the single most important verification in the plan — a duplicate-creating importer is worse than no importer.

- [ ] **Step 6: Apply the suppression list**

For each of the 50 suppressed companies, set `isSuppressed = true` and `suppressionReason`. Only companies that already exist in Twenty need it; the sheet showed zero overlap, so expect zero or few matches. Record the outcome in the runbook.

- [ ] **Step 7: Document and commit**

Add an "Importing prospects" section to the runbook covering the env vars, the dry-run-first rule, and the idempotency check.

```bash
git add scripts/import-prospects/import.ts docs/runbooks/twenty-railway.md
git commit -m "feat(import): add import CLI and import 252 prospects"
```

- [ ] **Step 8: Push the branch**

```bash
git push -u origin feat/twenty-crm-portal
```

---

### Task 14: Stand up the staging environment

**Files:**
- Modify: `docs/runbooks/twenty-railway.md`

**Interfaces:**
- Produces: a second Twenty instance for testing schema changes and batch operations before they touch real data.

Required by spec §8.3. Do this **before Plan C**, whose batch operations cost real money and write to real prospect records — you want somewhere to rehearse them.

- [ ] **Step 1: Create the staging environment**

In Railway, create a `staging` environment in the same project. Railway clones the service topology; give it its own Postgres and Redis volumes so staging can never write to production data.

Verify the database URLs differ before deploying anything:

```bash
railway variables --environment staging | grep PG_DATABASE_URL
railway variables --environment production | grep PG_DATABASE_URL
```

If they match, stop and fix it. A shared database makes staging worse than useless.

- [ ] **Step 2: Generate separate secrets**

Fresh `APP_SECRET` and `ENCRYPTION_KEY` for staging. Reusing production's would let a staging compromise decrypt production credentials.

- [ ] **Step 3: Give it a domain**

Add `crm-staging.fraterailabs.com` and register its callback URI on the Google OAuth client, or use the Railway-generated domain if you would rather not expose a second name in DNS.

- [ ] **Step 4: Deploy the app package to staging**

```bash
cd twenty-app && TWENTY_BASE_URL=https://crm-staging.fraterailabs.com yarn deploy
```

Confirm Prospects and Outreaches appear.

- [ ] **Step 5: Seed it with a small sample**

```bash
export TWENTY_BASE_URL=https://crm-staging.fraterailabs.com
export TWENTY_API_KEY=<staging key>
npx tsx scripts/import-prospects/import.ts --apply
```

Seeding staging with all 252 is fine and makes rehearsals realistic — it is the same public research data, in your own infrastructure.

- [ ] **Step 6: Document and commit**

Record both environments, their domains, their separate API keys, and the rule that schema and batch changes are rehearsed in staging first.

```bash
git add docs/runbooks/twenty-railway.md
git commit -m "chore(infra): add staging Twenty environment"
```

---

## Definition of Done

- `https://crm.fraterailabs.com` is reachable and only `@fraterailabs.com` Google accounts can sign in; a personal Gmail account was tested and rejected.
- A staging environment exists with its own database and secrets.
- Twenty shows 252 Prospects (all Sourced), 218 Companies, 252 People, and roughly 756 Outreach drafts.
- Re-running the importer changes no record count.
- `npm test` passes.
- No Google search URL appears in any `linkedinLink` field.
- The team can work the pipeline in Twenty; the spreadsheet is retired.
