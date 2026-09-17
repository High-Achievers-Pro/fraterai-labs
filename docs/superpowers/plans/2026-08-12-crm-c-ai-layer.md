# CRM Plan C — AI Layer (M6–M7) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unblock all 252 prospects by automating enrichment, qualification, and outreach drafting — with a human approval gate before anything is sent — and add an external research service for long-running sweeps and new-prospect discovery.

**Architecture:** Hybrid. Three Twenty-native agents defined as code in `twenty-app/` run on Twenty's agent runtime with Claude as the provider, using Exa and People Data Labs as tools. A separate Claude Agent SDK service runs on Railway's private network for work that exceeds a serverless function's limits, reached only by Twenty logic functions.

**Tech Stack:** Twenty agent runtime, Anthropic Claude (`claude-sonnet-5`, `claude-opus-5`), Exa, People Data Labs, `twenty-sdk`, Claude Agent SDK, Railway private networking.

**Depends on:** Plan A (objects, fields, 252 prospects imported).

**Spec:** `docs/superpowers/specs/2026-08-12-twenty-crm-portal-design.md` §7

## Global Constraints

- **Agents never send outreach.** Every generated `outreach` record is written at `status: 'DRAFT'` with `generatedBy: 'AGENT'`. Sending is a human action.
- **Placement rule:** work that must finish inside one user interaction runs on Twenty's agent runtime; work running minutes across many records runs in the research service.
- **Write only confident matches.** A low-confidence enrichment sets `directEmailStatus: 'LOW_CONFIDENCE'` and writes no email. A wrong email is worse than a missing one.
- **PDL "not found" is a normal outcome**, not an error: set `directEmailStatus: 'NOT_FOUND'` and stop. No retry loop.
- **Every batch operation carries a spend cap.**
- The research service has **no public domain**. Railway private network only.
- ICP is **50–500 headcount**.
- LinkedIn connection notes must be **≤200 characters**.
- Branch: `feat/twenty-crm-portal`.

## Field Registry (from Plan A — use verbatim)

| Object | Fields written by this plan |
|---|---|
| `person` | `emails`, `linkedinLink`, `directEmailStatus`, `researchLinks` |
| `company` | `domainName`, `linkedinLink`, `employees`, `headcountStatus` |
| `prospect` | `stage`, `qualificationStatus`, `disqualificationReason` |
| `outreach` | `title`, `channel`, `subject`, `body`, `characterCount`, `status`, `generatedBy`, `model`, `prospect` |

Enum values: `directEmailStatus` ∈ `ENRICHMENT_REQUIRED|FOUND|NOT_FOUND|LOW_CONFIDENCE`; `headcountStatus` ∈ `NEEDS_VERIFICATION|LIKELY_STARTUP|VERIFIED_IN_ICP|VERIFIED_OUTSIDE_ICP`; `stage` ∈ `SOURCED|EVIDENCE_VERIFIED|ICP_QUALIFIED|ENRICHED|OUTREACH_DRAFTED|CONTACTED|ENGAGED|CONVERTED|DISQUALIFIED`.

## File Structure

```
twenty-app/src/
├── agents/
│   ├── enrichment.agent.ts
│   ├── qualification.agent.ts
│   └── outreach.agent.ts
├── logic-functions/
│   ├── resolve-research-links.ts     search URL → real profile URL
│   ├── enrich-prospect.ts            PDL wrapper, confidence-gated
│   ├── draft-outreach.ts             writes DRAFT outreach records
│   └── run-research-sweep.ts         calls the private research service
├── command-menu-items/
│   ├── enrich-prospect.command-menu-item.ts
│   └── draft-outreach.command-menu-item.ts
└── constants/ai-identifiers.ts

services/research-agent/
├── package.json
├── Dockerfile
├── src/server.ts            private HTTP listener
├── src/sweep.ts             checkpointed batch runner
├── src/twenty.ts            Twenty API client
├── src/agent.ts             Claude Agent SDK orchestration
└── src/__tests__/
```

---

### Task 1: Configure Claude and the tool apps

**Files:**
- Modify: `docs/runbooks/twenty-railway.md`

**Interfaces:**
- Produces: a working model provider and the Exa + PDL tools available to agents.

- [ ] **Step 1: Add the Anthropic key**

Set on both the Twenty server and worker services, then redeploy:

```
ANTHROPIC_API_KEY=<key>
```

Twenty ships Anthropic as a first-class provider; no code change is needed.

- [ ] **Step 2: Confirm the available models**

In Twenty: Settings → AI. Confirm Claude models appear. Note which ids your server version offers — `claude-sonnet-5` and `claude-opus-5` are expected, but the pinned `ai-providers.json` is authoritative. Record the exact ids in the runbook; Task 3 references them.

- [ ] **Step 3: Install Exa**

Install the Exa app from Twenty's app catalogue and set its `EXA_API_KEY` server variable (Settings → Applications → Exa). Get the key from `exa.ai`.

- [ ] **Step 4: Install People Data Labs**

Install the PDL app and set `PDL_API_KEY` from `peopledatalabs.com`.

Because you supply your own key on a self-hosted instance, you are billed by PDL directly, not through Twenty credits. Budget roughly **$85** for a person-match pass over all 252 (~$0.336 each); company matches are ~$0.12.

- [ ] **Step 5: Verify both tools work**

Open Twenty's AI chat and ask it to run a web search, then to enrich one Person record. Confirm both return results.

If a tool is missing from chat, its role lacks permission — check Settings → Roles rather than assuming the install failed.

- [ ] **Step 6: Record and commit**

Document key locations, budget, and per-match costs in the runbook.

```bash
git add docs/runbooks/twenty-railway.md
git commit -m "docs: record AI provider and enrichment tool configuration"
```

---

### Task 2: Resolve research links into real URLs

**Files:**
- Create: `twenty-app/src/constants/ai-identifiers.ts`, `twenty-app/src/logic-functions/resolve-research-links.ts`, `twenty-app/src/logic-functions/__tests__/resolve-research-links.test.ts`

**Interfaces:**
- Produces: logic function `frater_resolve_research_links`, taking `{ prospectId }` and returning `{ success, personLinkedInUrl?, companyDomain?, message }`.

This must run before enrichment. All 252 `researchLinks` are Google **search** URLs, and PDL matches on real LinkedIn URLs and domains — feeding it a search URL yields nothing.

- [ ] **Step 1: Generate identifiers**

Run: `for i in $(seq 1 12); do uuidgen | tr 'A-Z' 'a-z'; done`

Create `twenty-app/src/constants/ai-identifiers.ts` exporting `RESOLVE_RESEARCH_LINKS_FN_ID`, `ENRICH_PROSPECT_FN_ID`, `DRAFT_OUTREACH_FN_ID`, `RUN_RESEARCH_SWEEP_FN_ID`, `ENRICHMENT_AGENT_ID`, `QUALIFICATION_AGENT_ID`, `OUTREACH_AGENT_ID`, `ENRICH_COMMAND_ITEM_ID`, `DRAFT_COMMAND_ITEM_ID`.

- [ ] **Step 2: Write the failing test for the pure extractors**

```ts
import { describe, expect, it } from 'vitest';
import { extractLinkedInUrl, extractDomain, isConfidentMatch } from '../resolve-research-links';

describe('extractLinkedInUrl', () => {
  it('picks a personal profile URL from search results', () => {
    const results = [
      { url: 'https://example.test/blog', title: 'Blog' },
      { url: 'https://www.linkedin.com/in/ada-lovelace', title: 'Ada Lovelace | LinkedIn' },
    ];
    expect(extractLinkedInUrl(results, 'person')).toBe('https://www.linkedin.com/in/ada-lovelace');
  });

  it('picks a company page for company lookups', () => {
    const results = [{ url: 'https://www.linkedin.com/company/acme', title: 'Acme | LinkedIn' }];
    expect(extractLinkedInUrl(results, 'company')).toBe('https://www.linkedin.com/company/acme');
  });

  it('does not return a company page when a person is wanted', () => {
    const results = [{ url: 'https://www.linkedin.com/company/acme', title: 'Acme' }];
    expect(extractLinkedInUrl(results, 'person')).toBeNull();
  });

  it('ignores search URLs', () => {
    const results = [{ url: 'https://www.google.com/search?q=linkedin.com/in/ada', title: 'search' }];
    expect(extractLinkedInUrl(results, 'person')).toBeNull();
  });

  it('returns null with no results', () => {
    expect(extractLinkedInUrl([], 'person')).toBeNull();
  });
});

describe('extractDomain', () => {
  it('returns the registrable host', () => {
    expect(extractDomain('https://www.acme.test/about')).toBe('acme.test');
  });

  it('rejects aggregators that are never a company domain', () => {
    expect(extractDomain('https://www.linkedin.com/company/acme')).toBeNull();
    expect(extractDomain('https://www.google.com/search?q=acme')).toBeNull();
  });

  it('returns null for junk', () => {
    expect(extractDomain('not a url')).toBeNull();
  });
});

describe('isConfidentMatch', () => {
  it('requires the surname to appear in the profile slug', () => {
    expect(isConfidentMatch('https://www.linkedin.com/in/ada-lovelace', 'Ada', 'Lovelace')).toBe(true);
    expect(isConfidentMatch('https://www.linkedin.com/in/bob-smith', 'Ada', 'Lovelace')).toBe(false);
  });

  it('handles multi-word surnames', () => {
    expect(isConfidentMatch('https://www.linkedin.com/in/sean-hengxiao-tao', 'Sean', 'Hengxiao Tao')).toBe(true);
  });
});
```

- [ ] **Step 3: Run it and confirm it fails**

Run: `cd twenty-app && npx vitest run src/logic-functions/__tests__/resolve-research-links.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement the extractors and handler**

```ts
import { defineLogicFunction } from 'twenty-sdk/define';
import { RESOLVE_RESEARCH_LINKS_FN_ID } from '../constants/ai-identifiers';

export type SearchResult = { url: string; title: string };

const NON_COMPANY_HOSTS = [
  'linkedin.com', 'google.com', 'bing.com', 'facebook.com',
  'twitter.com', 'x.com', 'crunchbase.com', 'wikipedia.org',
];

export const extractLinkedInUrl = (
  results: SearchResult[],
  kind: 'person' | 'company',
): string | null => {
  const marker = kind === 'person' ? '/in/' : '/company/';

  for (const result of results) {
    if (result.url.includes('google.com/search') || result.url.includes('bing.com/search')) continue;
    if (result.url.includes('linkedin.com') && result.url.includes(marker)) return result.url;
  }

  return null;
};

export const extractDomain = (url: string): string | null => {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    if (NON_COMPANY_HOSTS.some((blocked) => host.endsWith(blocked))) return null;
    return host;
  } catch {
    return null;
  }
};

export const isConfidentMatch = (
  profileUrl: string, firstName: string, lastName: string,
): boolean => {
  if (!lastName.trim()) return false;

  const slug = profileUrl.toLowerCase();
  const surnameParts = lastName.toLowerCase().split(/\s+/).filter(Boolean);

  return surnameParts.every((part) => slug.includes(part));
};

const handler = async (parameters: { prospectId: string }) => {
  // Load the prospect with its person and company, call the Exa tool with the
  // stored researchLinks query text, then apply the extractors above.
  // Write person.linkedinLink and company.domainName only when
  // isConfidentMatch passes; otherwise leave them unset and report why.
  return { success: true, message: 'resolved', prospectId: parameters.prospectId };
};

export default defineLogicFunction({
  universalIdentifier: RESOLVE_RESEARCH_LINKS_FN_ID,
  name: 'frater_resolve_research_links',
  label: 'Resolve research links',
  description: 'Turns stored Google search URLs into verified LinkedIn profile and company domain URLs',
  handler,
  timeoutSeconds: 30,
});
```

Complete the handler body against the record-CRUD helpers your `twenty-sdk` version exposes — run `cd twenty-app && ls node_modules/twenty-sdk/dist/` and read the logic-function typings. Keep the three exported extractors pure and unchanged; they are the tested surface.

`isConfidentMatch` is the guard that stops a plausible-but-wrong profile being written. Without it the agent will confidently attach the wrong person to an account.

- [ ] **Step 5: Run the tests**

Run: `cd twenty-app && npx vitest run src/logic-functions/__tests__/resolve-research-links.test.ts`
Expected: all passed.

- [ ] **Step 6: Deploy and try one prospect**

Run: `cd twenty-app && yarn typecheck && yarn deploy`

Invoke the function against a single known prospect. Verify the resolved LinkedIn URL is genuinely that person before running it widely.

- [ ] **Step 7: Commit**

```bash
git add twenty-app/src/constants/ai-identifiers.ts twenty-app/src/logic-functions/resolve-research-links.ts twenty-app/src/logic-functions/__tests__
git commit -m "feat(ai): resolve research search URLs into verified profile links"
```

---

### Task 3: Enrichment agent

**Files:**
- Create: `twenty-app/src/logic-functions/enrich-prospect.ts`, `twenty-app/src/agents/enrichment.agent.ts`, `twenty-app/src/command-menu-items/enrich-prospect.command-menu-item.ts`

**Interfaces:**
- Produces: agent `frater_enrichment`, logic function `frater_enrich_prospect`.

- [ ] **Step 1: Write the enrichment logic function**

Wrap PDL so the confidence rule lives in code rather than in a prompt:

- Require a resolved `linkedinLink` or company domain; if neither exists, return early asking for Task 2 to run first.
- Call PDL person enrich.
- If PDL returns no match → set `person.directEmailStatus = 'NOT_FOUND'`, return success. **Not an error.**
- If PDL returns a match below your confidence threshold → set `LOW_CONFIDENCE`, write **no** email, return success.
- On a confident match → write `person.emails.primaryEmail`, set `FOUND`, and write `company.employees` when returned.
- Set `company.headcountStatus` to `VERIFIED_IN_ICP` when employees is 50–500, otherwise `VERIFIED_OUTSIDE_ICP`.
- Advance `prospect.stage` to `ENRICHED` only when `directEmailStatus === 'FOUND'`.

- [ ] **Step 2: Define the agent**

```ts
import { defineAgent } from 'twenty-sdk/define';
import { ENRICHMENT_AGENT_ID } from '../constants/ai-identifiers';
import { DEFAULT_ROLE_UNIVERSAL_IDENTIFIER } from '../constants/universal-identifiers';

export default defineAgent({
  universalIdentifier: ENRICHMENT_AGENT_ID,
  name: 'frater_enrichment',
  label: 'Prospect enrichment',
  icon: 'IconAddressBook',
  description: 'Finds verified contact details for a prospect',
  modelId: 'claude-sonnet-5',
  roleUniversalIdentifier: DEFAULT_ROLE_UNIVERSAL_IDENTIFIER,
  responseFormat: { type: 'text' },
  prompt: `You enrich prospects for Frater AI Labs, an AI workflow automation consultancy.

Your job is to find a verified direct email and headcount for a prospect.

Process:
1. Call frater_resolve_research_links to turn stored search URLs into a real
   LinkedIn profile and company domain. Do not skip this: the stored links are
   Google search URLs, not profiles.
2. Call frater_enrich_prospect to run People Data Labs against those resolved URLs.
3. Report exactly what was found.

Hard rules:
- Never invent or guess an email address. Never construct one from a naming
  pattern such as first.last@domain. If enrichment returns nothing, say so.
- Never overwrite an existing verified email.
- A "not found" result is a normal, acceptable outcome. Report it plainly.
- The ideal customer profile is 50-500 employees. State whether the company
  falls inside or outside that range, but never disqualify on your own - only
  the qualification agent changes stage to DISQUALIFIED.

Be concise: report what you found, what you could not find, and why.`,
});
```

The prompt forbids pattern-guessed emails explicitly because that is the most likely failure mode — a model asked to find an email will happily invent `first.last@company.com`, which bounces and damages sender reputation.

- [ ] **Step 3: Add the command menu item**

Define a command menu item on the `prospect` object labelled "Enrich prospect" that invokes the agent, so the team can run it one record at a time from the UI.

- [ ] **Step 4: Deploy and test on five prospects**

Run: `cd twenty-app && yarn typecheck && yarn deploy`

Run enrichment on five prospects with different characteristics (a large company, a startup, a common name, an unusual name, one likely to fail). For each, manually verify the email against an independent source before trusting the pipeline.

Five verified-by-hand results is the gate for running the remaining 247. Do not batch before this passes.

- [ ] **Step 5: Commit**

```bash
git add twenty-app/src/logic-functions/enrich-prospect.ts twenty-app/src/agents/enrichment.agent.ts twenty-app/src/command-menu-items/enrich-prospect.command-menu-item.ts
git commit -m "feat(ai): add enrichment agent with confidence-gated PDL matching"
```

---

### Task 4: Qualification agent

**Files:**
- Create: `twenty-app/src/agents/qualification.agent.ts`

**Interfaces:**
- Produces: agent `frater_qualification`.

- [ ] **Step 1: Define the agent**

```ts
import { defineAgent } from 'twenty-sdk/define';
import { QUALIFICATION_AGENT_ID } from '../constants/ai-identifiers';
import { DEFAULT_ROLE_UNIVERSAL_IDENTIFIER } from '../constants/universal-identifiers';

export default defineAgent({
  universalIdentifier: QUALIFICATION_AGENT_ID,
  name: 'frater_qualification',
  label: 'Prospect qualification',
  icon: 'IconCheckbox',
  description: 'Verifies alumni evidence and ICP fit, then advances or disqualifies',
  modelId: 'claude-sonnet-5',
  roleUniversalIdentifier: DEFAULT_ROLE_UNIVERSAL_IDENTIFIER,
  responseFormat: { type: 'text' },
  prompt: `You qualify prospects for Frater AI Labs.

A prospect qualifies only when ALL of the following hold:
1. The named person currently works at the named company.
2. That person is a CMU or Emory alum, OR is a credible referral path to one.
3. The evidence URL on the person record still supports that claim today.
4. The company has 50-500 employees.

Process:
- Read the person's evidenceUrl and evidenceSummary.
- Use web search to confirm the person still holds that role and that the
  evidence page still says what the summary claims. Pages go stale and people
  change jobs; a stale claim is a fail, not a pass.
- Confirm headcount from a credible source.

Then set exactly one outcome:
- All four hold -> set prospect.stage to ICP_QUALIFIED and write what you
  verified into qualificationStatus.
- Evidence holds but headcount is outside 50-500 -> set stage to DISQUALIFIED
  with disqualificationReason naming the actual headcount.
- The person has left, or the evidence no longer supports the claim -> set
  stage to DISQUALIFIED with disqualificationReason explaining precisely what
  changed.
- You cannot determine something -> leave the stage unchanged and say what you
  could not verify. Do not guess.

Never mark ICP_QUALIFIED on partial evidence. An unverified prospect left at its
current stage is fine; a wrongly qualified one wastes an irreplaceable first
contact with a named alum.`,
});
```

- [ ] **Step 2: Deploy and test the three outcomes**

Run: `cd twenty-app && yarn typecheck && yarn deploy`

Verify each branch fires: one prospect that should qualify, one whose company is clearly outside 50–500, and one whose evidence is thin. Confirm the third leaves the stage unchanged rather than guessing.

- [ ] **Step 3: Commit**

```bash
git add twenty-app/src/agents/qualification.agent.ts
git commit -m "feat(ai): add qualification agent with explicit ICP and evidence gates"
```

---

### Task 5: Outreach drafting agent with an approval gate

**Files:**
- Create: `twenty-app/src/logic-functions/draft-outreach.ts`, `twenty-app/src/agents/outreach.agent.ts`, `twenty-app/src/command-menu-items/draft-outreach.command-menu-item.ts`, `twenty-app/src/logic-functions/__tests__/draft-outreach.test.ts`

**Interfaces:**
- Produces: agent `frater_outreach`, logic function `frater_draft_outreach` taking `{ prospectId, connectionNote, followUp, emailSubject, emailBody }`.

- [ ] **Step 1: Write the failing test for the write guard**

The guarantee that nothing auto-sends must be enforced in code, not only in a prompt.

```ts
import { describe, expect, it } from 'vitest';
import { buildOutreachRecords, LINKEDIN_NOTE_LIMIT } from '../draft-outreach';

const input = {
  prospectId: 'p1', queueId: 'EV-001', model: 'claude-sonnet-5',
  connectionNote: 'Hi Ada, noticed your work.', followUp: 'Following up.',
  emailSubject: 'Workflow idea', emailBody: 'Hi Ada,',
};

describe('buildOutreachRecords', () => {
  it('always writes DRAFT status', () => {
    const records = buildOutreachRecords(input);
    expect(records.every((r) => r.status === 'DRAFT')).toBe(true);
  });

  it('always marks the records as agent-generated', () => {
    expect(buildOutreachRecords(input).every((r) => r.generatedBy === 'AGENT')).toBe(true);
  });

  it('never sets sentAt', () => {
    expect(buildOutreachRecords(input).every((r) => !('sentAt' in r) || r.sentAt === null)).toBe(true);
  });

  it('creates one record per non-empty channel', () => {
    expect(buildOutreachRecords(input).map((r) => r.channel)).toEqual([
      'LINKEDIN_CONNECTION', 'LINKEDIN_FOLLOW_UP', 'COLD_EMAIL',
    ]);
    expect(buildOutreachRecords({ ...input, followUp: '' })).toHaveLength(2);
  });

  it('records the true character count', () => {
    const [note] = buildOutreachRecords(input);
    expect(note.characterCount).toBe(input.connectionNote.length);
  });

  it('rejects an over-limit connection note rather than truncating', () => {
    expect(() => buildOutreachRecords({ ...input, connectionNote: 'x'.repeat(LINKEDIN_NOTE_LIMIT + 1) }))
      .toThrow(/200/);
  });

  it('records the model that produced the draft', () => {
    expect(buildOutreachRecords(input).every((r) => r.model === 'claude-sonnet-5')).toBe(true);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `cd twenty-app && npx vitest run src/logic-functions/__tests__/draft-outreach.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement the builder and function**

```ts
import { defineLogicFunction } from 'twenty-sdk/define';
import { DRAFT_OUTREACH_FN_ID } from '../constants/ai-identifiers';

export const LINKEDIN_NOTE_LIMIT = 200;

export type DraftInput = {
  prospectId: string; queueId: string; model: string;
  connectionNote: string; followUp: string; emailSubject: string; emailBody: string;
};

export type OutreachRecord = {
  title: string;
  channel: 'LINKEDIN_CONNECTION' | 'LINKEDIN_FOLLOW_UP' | 'COLD_EMAIL';
  subject: string;
  body: string;
  characterCount: number;
  status: 'DRAFT';
  generatedBy: 'AGENT';
  model: string;
  sentAt: null;
};

export const buildOutreachRecords = (input: DraftInput): OutreachRecord[] => {
  if (input.connectionNote.length > LINKEDIN_NOTE_LIMIT) {
    throw new Error(
      `LinkedIn connection note is ${input.connectionNote.length} characters, over the ${LINKEDIN_NOTE_LIMIT} limit. Shorten it rather than truncating.`,
    );
  }

  const base = { status: 'DRAFT', generatedBy: 'AGENT', model: input.model, sentAt: null } as const;
  const records: OutreachRecord[] = [];

  if (input.connectionNote.trim()) {
    records.push({
      ...base, title: `${input.queueId} · LinkedIn connection`,
      channel: 'LINKEDIN_CONNECTION', subject: '',
      body: input.connectionNote, characterCount: input.connectionNote.length,
    });
  }
  if (input.followUp.trim()) {
    records.push({
      ...base, title: `${input.queueId} · LinkedIn follow-up`,
      channel: 'LINKEDIN_FOLLOW_UP', subject: '',
      body: input.followUp, characterCount: input.followUp.length,
    });
  }
  if (input.emailBody.trim()) {
    records.push({
      ...base, title: `${input.queueId} · Cold email`,
      channel: 'COLD_EMAIL', subject: input.emailSubject,
      body: input.emailBody, characterCount: input.emailBody.length,
    });
  }

  return records;
};

const handler = async (parameters: DraftInput) => {
  const records = buildOutreachRecords(parameters);
  // Persist each record against parameters.prospectId, then set
  // prospect.stage to OUTREACH_DRAFTED.
  return { success: true, message: `Created ${records.length} draft(s)`, count: records.length };
};

export default defineLogicFunction({
  universalIdentifier: DRAFT_OUTREACH_FN_ID,
  name: 'frater_draft_outreach',
  label: 'Save outreach drafts',
  description: 'Persists generated outreach copy as DRAFT records awaiting owner approval',
  handler,
  timeoutSeconds: 30,
});
```

`status`, `generatedBy`, and `sentAt` are set by this function, never by the model. The agent supplies copy; it cannot choose a status.

- [ ] **Step 4: Define the outreach agent**

Create `frater_outreach` with `modelId: 'claude-opus-5'` (drafting quality matters more here than latency) and a prompt that:

- Reads the prospect, person, company, `evidenceSummary`, and `recommendedAiWorkflow`
- Writes a connection note **under 200 characters** referencing the shared CMU/Emory connection specifically, not generically
- Writes a follow-up assuming the connection was accepted but nothing else has happened
- Writes a cold email subject and body leading with the `recommendedAiWorkflow` for that account
- Calls `frater_draft_outreach` with the results
- Is told explicitly: *"You are drafting for human review. You cannot send. Do not claim anything has been sent. Never fabricate a shared connection, mutual contact, or prior interaction that is not in the record."*

- [ ] **Step 5: Run the tests**

Run: `cd twenty-app && npx vitest run src/logic-functions/__tests__/draft-outreach.test.ts`
Expected: 7 passed.

- [ ] **Step 6: Deploy and review five drafts by hand**

Run: `cd twenty-app && yarn typecheck && yarn deploy`

Generate drafts for five prospects and read every one. Check specifically for invented shared history, generic filler, and notes over 200 characters. Confirm all records are `DRAFT` and none has `sentAt`.

- [ ] **Step 7: Commit**

```bash
git add twenty-app/src/logic-functions/draft-outreach.ts twenty-app/src/agents/outreach.agent.ts twenty-app/src/command-menu-items/draft-outreach.command-menu-item.ts twenty-app/src/logic-functions/__tests__/draft-outreach.test.ts
git commit -m "feat(ai): add outreach drafting agent with enforced approval gate"
```

---

### Task 6: Research service scaffold

**Files:**
- Create: `services/research-agent/package.json`, `Dockerfile`, `src/server.ts`, `src/twenty.ts`, `src/__tests__/server.test.ts`
- Modify: `.gitignore`

**Interfaces:**
- Produces: a private HTTP service exposing `GET /healthz` and `POST /sweep`.

- [ ] **Step 1: Scaffold the service**

`services/research-agent/package.json` with dependencies `@anthropic-ai/claude-agent-sdk` and `express` (or the Node built-in HTTP server), devDependencies `vitest`, `tsx`, `typescript`, and scripts `dev`, `start`, `test`.

- [ ] **Step 2: Write the failing test for shared-secret auth**

Private networking is the primary control, but a second check means a misconfigured service is not wide open to anything else in the project.

```ts
import { describe, expect, it } from 'vitest';
import { isAuthorized } from '../server';

describe('isAuthorized', () => {
  it('accepts the configured secret', () => {
    expect(isAuthorized('s3cret', 's3cret')).toBe(true);
  });

  it('rejects a wrong or missing secret', () => {
    expect(isAuthorized('wrong', 's3cret')).toBe(false);
    expect(isAuthorized(undefined, 's3cret')).toBe(false);
  });

  it('rejects everything when no secret is configured', () => {
    expect(isAuthorized('anything', undefined)).toBe(false);
  });
});
```

The last case is deliberate fail-closed behaviour: an unconfigured service accepts nothing.

- [ ] **Step 3: Implement the server**

Export `isAuthorized(provided, expected)` using a constant-time comparison, and mount:

- `GET /healthz` → `200 {"status":"ok"}` (no auth; Railway needs it)
- `POST /sweep` → requires the `x-frater-secret` header, enqueues a sweep, returns `202` with a run id

Bind to `0.0.0.0` on `process.env.PORT`.

- [ ] **Step 4: Add the Dockerfile**

A Node 24 slim base, install dependencies, build, run `node dist/server.js`, expose `$PORT`.

- [ ] **Step 5: Deploy to Railway — without a public domain**

Create a `research-agent` service **in the same Railway project** as Twenty, with root directory `services/research-agent`. Set `RESEARCH_SERVICE_SECRET`, `ANTHROPIC_API_KEY`, `TWENTY_BASE_URL`, and `TWENTY_API_KEY`.

**Do not generate a public domain.** The service must be reachable only at `research-agent.railway.internal`. If Railway created one automatically, remove it and verify the URL 404s from outside.

- [ ] **Step 6: Verify private reachability**

From another service in the project (a Railway shell on the Twenty service):

```bash
curl -fsS http://research-agent.railway.internal:$PORT/healthz
```
Expected: `{"status":"ok"}`. The same request from your laptop must fail.

- [ ] **Step 7: Commit**

```bash
git add services/research-agent .gitignore
git commit -m "feat(research): scaffold private research service"
```

---

### Task 7: Checkpointed sweeps

**Files:**
- Create: `services/research-agent/src/sweep.ts`, `services/research-agent/src/agent.ts`, `services/research-agent/src/__tests__/sweep.test.ts`

**Interfaces:**
- Produces: `runSweep(prospectIds, options)` with per-prospect checkpointing and a spend cap.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it, vi } from 'vitest';
import { runSweep } from '../sweep';

const processor = (fail?: string) => vi.fn(async (id: string) => {
  if (id === fail) throw new Error('boom');
  return { id, ok: true };
});

describe('runSweep', () => {
  it('processes every prospect', async () => {
    const process = processor();
    const result = await runSweep(['a', 'b', 'c'], { process, maxSpendUsd: 10, costPerItemUsd: 0.1 });
    expect(result.processed).toEqual(['a', 'b', 'c']);
    expect(result.failed).toHaveLength(0);
  });

  it('continues past a failure and records it', async () => {
    const result = await runSweep(['a', 'b', 'c'], { process: processor('b'), maxSpendUsd: 10, costPerItemUsd: 0.1 });
    expect(result.processed).toEqual(['a', 'c']);
    expect(result.failed).toEqual([{ id: 'b', error: 'boom' }]);
  });

  it('stops when the spend cap would be exceeded', async () => {
    const result = await runSweep(['a', 'b', 'c'], { process: processor(), maxSpendUsd: 0.25, costPerItemUsd: 0.1 });
    expect(result.processed).toHaveLength(2);
    expect(result.stoppedReason).toBe('spend_cap');
  });

  it('resumes from a checkpoint without redoing work', async () => {
    const process = processor();
    const result = await runSweep(['a', 'b', 'c'], {
      process, maxSpendUsd: 10, costPerItemUsd: 0.1, alreadyProcessed: ['a'],
    });
    expect(process).not.toHaveBeenCalledWith('a');
    expect(result.processed).toEqual(['b', 'c']);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `cd services/research-agent && npx vitest run src/__tests__/sweep.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
export type SweepOptions = {
  process: (id: string) => Promise<unknown>;
  maxSpendUsd: number;
  costPerItemUsd: number;
  alreadyProcessed?: string[];
  onCheckpoint?: (id: string) => Promise<void>;
};

export type SweepResult = {
  processed: string[];
  failed: { id: string; error: string }[];
  spentUsd: number;
  stoppedReason: 'complete' | 'spend_cap';
};

export const runSweep = async (ids: string[], options: SweepOptions): Promise<SweepResult> => {
  const done = new Set(options.alreadyProcessed ?? []);
  const processed: string[] = [];
  const failed: { id: string; error: string }[] = [];
  let spentUsd = 0;

  for (const id of ids) {
    if (done.has(id)) continue;

    if (spentUsd + options.costPerItemUsd > options.maxSpendUsd) {
      return { processed, failed, spentUsd, stoppedReason: 'spend_cap' };
    }

    try {
      await options.process(id);
      spentUsd += options.costPerItemUsd;
      processed.push(id);
      await options.onCheckpoint?.(id);
    } catch (error) {
      failed.push({ id, error: error instanceof Error ? error.message : String(error) });
    }
  }

  return { processed, failed, spentUsd, stoppedReason: 'complete' };
};
```

The cap is checked *before* each item, so it can never be overshot. Checkpoints are written after each success, so a crash resumes rather than restarting — and never double-charges for completed work.

- [ ] **Step 4: Implement the agent orchestration**

`src/agent.ts` uses the Claude Agent SDK to run the multi-step research chain for a single prospect: search for corroborating evidence, verify the alumni claim across sources, verify headcount, and write results back through `src/twenty.ts`. Persist the checkpoint as a field on the prospect or a run record in Twenty, so state survives a restart without a database.

- [ ] **Step 5: Run the tests**

Run: `cd services/research-agent && npx vitest run`
Expected: all passed.

- [ ] **Step 6: Add the calling logic function**

Create `twenty-app/src/logic-functions/run-research-sweep.ts` (`frater_run_research_sweep`) that POSTs to `http://research-agent.railway.internal:$PORT/sweep` with the shared secret and returns the run id. Set `RESEARCH_SERVICE_SECRET` and the internal URL as `serverVariables` on the Frater app so they are injected as secrets.

- [ ] **Step 7: End-to-end test with a small batch**

Trigger a sweep over five prospects. Verify results are written back, the checkpoint advances, and a deliberately induced mid-run restart resumes rather than reprocessing.

- [ ] **Step 8: Commit**

```bash
git add services/research-agent/src twenty-app/src/logic-functions/run-research-sweep.ts
git commit -m "feat(research): add checkpointed sweeps with spend caps"
```

---

### Task 8: Run the full enrichment pass

**Files:**
- Modify: `docs/runbooks/twenty-railway.md`

- [ ] **Step 1: Set the budget**

Set the sweep spend cap to **$120** — above the ~$85 expected for 252 person matches, leaving headroom for company matches without risking a runaway.

- [ ] **Step 2: Run link resolution across all 252**

Batch `frater_resolve_research_links`. Expect meaningful failures: some people will have left, some names are ambiguous. Record how many resolved.

- [ ] **Step 3: Run enrichment across everything that resolved**

Monitor spend as it runs. Stop immediately if the found-rate looks implausibly high — a near-100% match rate usually means guessed emails, not good data.

- [ ] **Step 4: Audit a random sample of 20**

Independently verify 20 enriched emails. Compute the true accuracy rate.

If accuracy is below 90%, stop and tighten the confidence threshold before anyone sends anything. Bounced cold emails on a new domain damage deliverability for every later campaign.

- [ ] **Step 5: Record the outcome**

Document in the runbook: how many resolved, how many enriched `FOUND` / `NOT_FOUND` / `LOW_CONFIDENCE`, sampled accuracy, and total spend.

- [ ] **Step 6: Commit and push**

```bash
git add docs/runbooks/twenty-railway.md
git commit -m "docs: record full enrichment pass results"
git push
```

---

## Definition of Done

- Claude, Exa, and People Data Labs are configured and callable from agents.
- All 252 prospects have been through link resolution and enrichment; results are recorded with a measured accuracy rate from a 20-record audit.
- Outreach drafts exist as `DRAFT` records with `generatedBy = AGENT`; **no** record has `sentAt` set by an agent.
- The research service has no public domain and is reachable only at `research-agent.railway.internal`.
- Sweeps resume from checkpoint after a restart and stop at the spend cap.
- Tests pass in both `twenty-app/` and `services/research-agent/`.
