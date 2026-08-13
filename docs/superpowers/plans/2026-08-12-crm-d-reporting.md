# CRM Plan D — Reporting & Follow-up (M8) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the loop on the five workflows — make follow-up automatic, make sends and replies log themselves, make conversion to a deal explicit, and replace the spreadsheet's Dashboard sheet with live reporting.

**Architecture:** Google Workspace message and calendar sync writes send and reply activity into Twenty with no manual logging. A Twenty workflow watches for silence after a send and produces a follow-up task plus a drafted follow-up. Reporting lives in Twenty's native dashboards, with a condensed rollup on the portal.

**Tech Stack:** Twenty messaging/calendar sync, Google Workspace OAuth, Twenty workflows and dashboards, Next.js portal tiles.

**Depends on:** Plan A (data model, 252 prospects), Plan B (portal, summary module), Plan C (outreach drafts).

**Spec:** `docs/superpowers/specs/2026-08-12-twenty-crm-portal-design.md` §8

## Global Constraints

- Google Workspace domain is **`fraterailabs.com`**.
- **Follow-up interval: 5 business days** after a send with no reply. This was left open in the spec; 5 business days is the default adopted here and is a single constant, changeable without touching logic.
- Follow-up drafts obey Plan C's rule: written as `DRAFT`, never sent automatically.
- Conversion from `prospect` to Opportunity is a **deliberate human action**, not an automatic stage side-effect.
- Reporting must not create a second source of truth. Twenty is authoritative; the portal only summarises.
- Branch: `feat/twenty-crm-portal`.

## Field Registry (from Plans A and C)

Reads: `prospect.stage`, `prospect.queueId`, `prospect.leadSource`, `outreach.status`, `outreach.channel`, `outreach.sentAt`, `outreach.prospect`, `person.emails`, `company.employees`.
Writes: `outreach.status` (`SENT` → `REPLIED`), `prospect.stage` (`CONTACTED`, `ENGAGED`, `CONVERTED`).

---

### Task 1: Connect Gmail and Calendar sync

**Files:**
- Modify: `docs/runbooks/twenty-railway.md`

**Interfaces:**
- Produces: automatic message and calendar-event logging against People.

- [ ] **Step 1: Enable the Google APIs**

In Google Cloud Console for the project holding your OAuth client, enable the **Gmail API** and **Google Calendar API**.

- [ ] **Step 2: Add the sync scopes**

Add to the OAuth consent screen: `gmail.readonly`, `calendar.events.readonly` (or the exact scopes your Twenty version requests — check Settings → Accounts before configuring, since scope names shift between releases).

Because the app is internal to your Workspace, it does not need Google verification. Confirm the consent screen is set to **Internal**, not External — External would require a review process you do not need.

- [ ] **Step 3: Enable sync on the server**

Set on both the Twenty server and worker services, then redeploy:

```
MESSAGING_PROVIDER_GMAIL_ENABLED=true
CALENDAR_PROVIDER_GOOGLE_ENABLED=true
```

- [ ] **Step 4: Connect one account and verify**

In Twenty: Settings → Accounts → connect your Google account. Wait for the initial sync.

Verify: open a Person you have emailed before and confirm the thread appears in their timeline. If it does not, check the **worker** logs — sync runs on the worker, and a server-only deploy shows no error while syncing nothing.

- [ ] **Step 5: Confirm the privacy boundary with the team**

Message sync imports mailbox contents into the CRM. Before connecting everyone's account, confirm the team understands what becomes visible and agrees. Note the decision and who connected in the runbook.

This is a people decision, not a technical one. Do not connect other people's mailboxes on their behalf without asking.

- [ ] **Step 6: Connect remaining accounts and commit**

```bash
git add docs/runbooks/twenty-railway.md
git commit -m "docs: record Gmail and Calendar sync configuration"
```

---

### Task 2: Detect sends and replies

**Files:**
- Create: `twenty-app/src/logic-functions/detect-outreach-activity.ts`, `twenty-app/src/logic-functions/__tests__/detect-outreach-activity.test.ts`

**Interfaces:**
- Produces: `classifyMessageActivity(message, outreaches)` → `{ outreachId, newStatus } | null`, and a cron-triggered logic function `frater_detect_outreach_activity`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { classifyMessageActivity } from '../detect-outreach-activity';

const outreach = {
  id: 'o1', channel: 'COLD_EMAIL' as const, status: 'SENT' as const,
  subject: 'Workflow idea for Acme', personEmail: 'ada@acme.test',
  sentAt: '2026-08-01T10:00:00Z',
};

describe('classifyMessageActivity', () => {
  it('marks an inbound reply from the prospect as REPLIED', () => {
    const message = {
      direction: 'INCOMING' as const, fromEmail: 'ada@acme.test',
      subject: 'Re: Workflow idea for Acme', receivedAt: '2026-08-02T09:00:00Z',
    };
    expect(classifyMessageActivity(message, [outreach])).toEqual({ outreachId: 'o1', newStatus: 'REPLIED' });
  });

  it('ignores our own outgoing mail', () => {
    const message = {
      direction: 'OUTGOING' as const, fromEmail: 'seth@fraterailabs.com',
      subject: 'Workflow idea for Acme', receivedAt: '2026-08-01T10:00:00Z',
    };
    expect(classifyMessageActivity(message, [outreach])).toBeNull();
  });

  it('ignores a reply from someone unrelated', () => {
    const message = {
      direction: 'INCOMING' as const, fromEmail: 'stranger@other.test',
      subject: 'Re: Workflow idea for Acme', receivedAt: '2026-08-02T09:00:00Z',
    };
    expect(classifyMessageActivity(message, [outreach])).toBeNull();
  });

  it('ignores messages received before the outreach was sent', () => {
    const message = {
      direction: 'INCOMING' as const, fromEmail: 'ada@acme.test',
      subject: 'Unrelated earlier thread', receivedAt: '2026-07-20T09:00:00Z',
    };
    expect(classifyMessageActivity(message, [outreach])).toBeNull();
  });

  it('does not downgrade an outreach already marked REPLIED', () => {
    const replied = { ...outreach, status: 'REPLIED' as const };
    const message = {
      direction: 'INCOMING' as const, fromEmail: 'ada@acme.test',
      subject: 'Re: Workflow idea for Acme', receivedAt: '2026-08-03T09:00:00Z',
    };
    expect(classifyMessageActivity(message, [replied])).toBeNull();
  });

  it('ignores automated bounce and out-of-office replies', () => {
    const bounce = {
      direction: 'INCOMING' as const, fromEmail: 'mailer-daemon@acme.test',
      subject: 'Undeliverable: Workflow idea for Acme', receivedAt: '2026-08-01T10:05:00Z',
    };
    expect(classifyMessageActivity(bounce, [outreach])).toBeNull();
  });
});
```

The out-of-office case matters: counting an auto-reply as engagement would inflate your reply rate and stop the follow-up that should still happen.

- [ ] **Step 2: Run it and confirm it fails**

Run: `cd twenty-app && npx vitest run src/logic-functions/__tests__/detect-outreach-activity.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement the classifier**

```ts
export type OutreachSummary = {
  id: string;
  channel: 'LINKEDIN_CONNECTION' | 'LINKEDIN_FOLLOW_UP' | 'COLD_EMAIL';
  status: 'DRAFT' | 'APPROVED' | 'SENT' | 'REPLIED' | 'BOUNCED';
  subject: string;
  personEmail: string;
  sentAt: string;
};

export type MessageSummary = {
  direction: 'INCOMING' | 'OUTGOING';
  fromEmail: string;
  subject: string;
  receivedAt: string;
};

const AUTOMATED_SENDERS = ['mailer-daemon', 'postmaster', 'no-reply', 'noreply'];

export const classifyMessageActivity = (
  message: MessageSummary,
  outreaches: OutreachSummary[],
): { outreachId: string; newStatus: 'REPLIED' } | null => {
  if (message.direction !== 'INCOMING') return null;

  const from = message.fromEmail.toLowerCase();
  if (AUTOMATED_SENDERS.some((prefix) => from.startsWith(prefix))) return null;

  const match = outreaches.find(
    (outreach) =>
      outreach.status === 'SENT' &&
      outreach.personEmail.toLowerCase() === from &&
      new Date(message.receivedAt) > new Date(outreach.sentAt),
  );

  return match ? { outreachId: match.id, newStatus: 'REPLIED' } : null;
};
```

Only `SENT` outreaches are candidates, so a draft can never jump to `REPLIED`, and the timestamp comparison prevents an older unrelated thread from being read as a response.

- [ ] **Step 4: Wire the cron function**

Define `frater_detect_outreach_activity` with `cronTriggerSettings: { pattern: '*/30 * * * *' }`. It loads messages synced in the last hour, loads `SENT` outreaches for the matching people, applies `classifyMessageActivity`, and for each hit sets `outreach.status = 'REPLIED'` and advances `prospect.stage` to `ENGAGED`.

- [ ] **Step 5: Run the tests, deploy, verify**

```bash
cd twenty-app && npx vitest run src/logic-functions/__tests__/detect-outreach-activity.test.ts
yarn typecheck && yarn deploy
```

Send yourself a test email from a second address, mark a test outreach `SENT`, reply, and confirm the status flips within 30 minutes.

- [ ] **Step 6: Commit**

```bash
git add twenty-app/src/logic-functions/detect-outreach-activity.ts twenty-app/src/logic-functions/__tests__/detect-outreach-activity.test.ts
git commit -m "feat(followup): detect replies and advance prospects to Engaged"
```

---

### Task 3: Automatic follow-up after silence

**Files:**
- Create: `twenty-app/src/logic-functions/schedule-follow-ups.ts`, `twenty-app/src/logic-functions/__tests__/schedule-follow-ups.test.ts`, `twenty-app/src/constants/follow-up.ts`

**Interfaces:**
- Produces: `FOLLOW_UP_BUSINESS_DAYS`, `businessDaysBetween(from, to)`, `selectProspectsNeedingFollowUp(outreaches, now)`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { businessDaysBetween, selectProspectsNeedingFollowUp } from '../schedule-follow-ups';

describe('businessDaysBetween', () => {
  it('excludes weekends', () => {
    // Friday 2026-08-07 to Monday 2026-08-10
    expect(businessDaysBetween(new Date('2026-08-07'), new Date('2026-08-10'))).toBe(1);
  });

  it('counts a full working week as five', () => {
    expect(businessDaysBetween(new Date('2026-08-03'), new Date('2026-08-10'))).toBe(5);
  });

  it('returns zero for the same day', () => {
    expect(businessDaysBetween(new Date('2026-08-03'), new Date('2026-08-03'))).toBe(0);
  });
});

describe('selectProspectsNeedingFollowUp', () => {
  const now = new Date('2026-08-13T12:00:00Z');

  it('selects a send with no reply after the threshold', () => {
    const outreaches = [{
      id: 'o1', prospectId: 'p1', status: 'SENT' as const,
      sentAt: '2026-08-05T10:00:00Z', channel: 'COLD_EMAIL' as const,
    }];
    expect(selectProspectsNeedingFollowUp(outreaches, now)).toEqual(['p1']);
  });

  it('ignores a send inside the threshold', () => {
    const outreaches = [{
      id: 'o1', prospectId: 'p1', status: 'SENT' as const,
      sentAt: '2026-08-12T10:00:00Z', channel: 'COLD_EMAIL' as const,
    }];
    expect(selectProspectsNeedingFollowUp(outreaches, now)).toEqual([]);
  });

  it('ignores prospects who replied', () => {
    const outreaches = [{
      id: 'o1', prospectId: 'p1', status: 'REPLIED' as const,
      sentAt: '2026-08-01T10:00:00Z', channel: 'COLD_EMAIL' as const,
    }];
    expect(selectProspectsNeedingFollowUp(outreaches, now)).toEqual([]);
  });

  it('ignores bounced sends', () => {
    const outreaches = [{
      id: 'o1', prospectId: 'p1', status: 'BOUNCED' as const,
      sentAt: '2026-08-01T10:00:00Z', channel: 'COLD_EMAIL' as const,
    }];
    expect(selectProspectsNeedingFollowUp(outreaches, now)).toEqual([]);
  });

  it('does not select the same prospect twice for multiple stale sends', () => {
    const outreaches = [
      { id: 'o1', prospectId: 'p1', status: 'SENT' as const, sentAt: '2026-08-01T10:00:00Z', channel: 'COLD_EMAIL' as const },
      { id: 'o2', prospectId: 'p1', status: 'SENT' as const, sentAt: '2026-08-04T10:00:00Z', channel: 'LINKEDIN_CONNECTION' as const },
    ];
    expect(selectProspectsNeedingFollowUp(outreaches, now)).toEqual(['p1']);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `cd twenty-app && npx vitest run src/logic-functions/__tests__/schedule-follow-ups.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
export const FOLLOW_UP_BUSINESS_DAYS = 5;

export const businessDaysBetween = (from: Date, to: Date): number => {
  let count = 0;
  const cursor = new Date(from);
  cursor.setUTCHours(0, 0, 0, 0);

  const end = new Date(to);
  end.setUTCHours(0, 0, 0, 0);

  while (cursor < end) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) count += 1;
  }

  return count;
};

type OutreachRow = {
  id: string;
  prospectId: string;
  status: 'DRAFT' | 'APPROVED' | 'SENT' | 'REPLIED' | 'BOUNCED';
  sentAt: string;
  channel: 'LINKEDIN_CONNECTION' | 'LINKEDIN_FOLLOW_UP' | 'COLD_EMAIL';
};

export const selectProspectsNeedingFollowUp = (
  outreaches: OutreachRow[],
  now: Date,
): string[] => {
  const replied = new Set(
    outreaches.filter((o) => o.status === 'REPLIED').map((o) => o.prospectId),
  );

  const due = new Set<string>();

  for (const outreach of outreaches) {
    if (outreach.status !== 'SENT') continue;
    if (replied.has(outreach.prospectId)) continue;
    if (businessDaysBetween(new Date(outreach.sentAt), now) < FOLLOW_UP_BUSINESS_DAYS) continue;
    due.add(outreach.prospectId);
  }

  return [...due];
};
```

A reply on *any* outreach suppresses follow-up for the whole prospect — otherwise someone who replied on LinkedIn would still get chased by email.

- [ ] **Step 4: Wire the daily cron**

Define `frater_schedule_follow_ups` with `cronTriggerSettings: { pattern: '0 8 * * 1-5' }` (weekday mornings). For each due prospect it creates a Task assigned to the owner and invokes the Plan C outreach agent to write a follow-up `DRAFT`.

It creates a task and a draft. It does not send. Same rule as Plan C.

- [ ] **Step 5: Guard against duplicate chasing**

Before creating a task, check whether an open follow-up task already exists for that prospect. Without this, the daily cron creates a new task every morning for the same silent prospect.

- [ ] **Step 6: Run the tests, deploy, verify**

```bash
cd twenty-app && npx vitest run src/logic-functions/__tests__/schedule-follow-ups.test.ts
yarn typecheck && yarn deploy
```

Backdate a test outreach's `sentAt` by six business days, trigger the function, and confirm exactly one task and one draft appear. Trigger it again and confirm no duplicates.

- [ ] **Step 7: Commit**

```bash
git add twenty-app/src/logic-functions/schedule-follow-ups.ts twenty-app/src/logic-functions/__tests__/schedule-follow-ups.test.ts
git commit -m "feat(followup): schedule follow-up tasks and drafts after five business days"
```

---

### Task 4: Convert a prospect into an opportunity

**Files:**
- Create: `twenty-app/src/logic-functions/convert-prospect.ts`, `twenty-app/src/command-menu-items/convert-prospect.command-menu-item.ts`, `twenty-app/src/logic-functions/__tests__/convert-prospect.test.ts`

**Interfaces:**
- Produces: `buildOpportunityInput(prospect, company, person)`, logic function `frater_convert_prospect`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { buildOpportunityInput, canConvert } from '../convert-prospect';

const prospect = {
  id: 'p1', queueId: 'EV-001', stage: 'ENGAGED' as const,
  recommendedAiWorkflow: 'customer support triage',
};
const company = { id: 'c1', name: 'Acme Co' };
const person = { id: 'pe1', name: 'Ada Lovelace' };

describe('canConvert', () => {
  it('allows conversion from ENGAGED', () => {
    expect(canConvert({ ...prospect, stage: 'ENGAGED' }).ok).toBe(true);
  });

  it('refuses conversion from SOURCED', () => {
    const result = canConvert({ ...prospect, stage: 'SOURCED' });
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('SOURCED');
  });

  it('refuses to convert twice', () => {
    expect(canConvert({ ...prospect, stage: 'CONVERTED' }).ok).toBe(false);
  });

  it('refuses a disqualified prospect', () => {
    expect(canConvert({ ...prospect, stage: 'DISQUALIFIED' }).ok).toBe(false);
  });
});

describe('buildOpportunityInput', () => {
  it('names the opportunity after the company and workflow', () => {
    const input = buildOpportunityInput(prospect, company, person);
    expect(input.name).toBe('Acme Co — customer support triage');
  });

  it('links company and point of contact', () => {
    const input = buildOpportunityInput(prospect, company, person);
    expect(input.companyId).toBe('c1');
    expect(input.pointOfContactId).toBe('pe1');
  });

  it('falls back to the company name when no workflow is recorded', () => {
    const input = buildOpportunityInput({ ...prospect, recommendedAiWorkflow: '' }, company, person);
    expect(input.name).toBe('Acme Co');
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `cd twenty-app && npx vitest run src/logic-functions/__tests__/convert-prospect.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Write `canConvert` allowing only `CONTACTED` and `ENGAGED`, and `buildOpportunityInput` producing `{ name, companyId, pointOfContactId }`. The handler creates the Opportunity, sets `prospect.stage = 'CONVERTED'`, and returns the new opportunity id.

Conversion stays gated and explicit. Auto-converting on reply would put unqualified deals into the forecast — precisely the outcome the separate `prospect` object exists to prevent.

- [ ] **Step 4: Add the command menu item**

A "Convert to opportunity" action on the `prospect` object, so conversion is a visible human decision.

- [ ] **Step 5: Run the tests, deploy, verify**

```bash
cd twenty-app && npx vitest run src/logic-functions/__tests__/convert-prospect.test.ts
yarn typecheck && yarn deploy
```

Convert one test prospect; confirm the Opportunity appears linked to the right company and contact, and that converting again is refused.

- [ ] **Step 6: Commit**

```bash
git add twenty-app/src/logic-functions/convert-prospect.ts twenty-app/src/command-menu-items/convert-prospect.command-menu-item.ts twenty-app/src/logic-functions/__tests__/convert-prospect.test.ts
git commit -m "feat(pipeline): add gated prospect-to-opportunity conversion"
```

---

### Task 5: Dashboards in Twenty

**Files:**
- Create: `twenty-app/src/page-layouts/pipeline-dashboard.page-layout.ts`

**Interfaces:**
- Produces: a dashboard replacing the spreadsheet's Dashboard sheet.

- [ ] **Step 1: Read a working dashboard example**

Dashboard and widget manifests vary by SDK version. Copy the structure from `packages/twenty-apps/internal/real-estate/src/page-layouts/agency-dashboard.page-layout.ts` in a `twentyhq/twenty` checkout rather than guessing.

- [ ] **Step 2: Define the widgets**

Build a dashboard covering what the Dashboard sheet tracked, plus what it could not:

| Widget | Shows |
|---|---|
| Prospects by stage | Funnel across all nine stages |
| Enrichment progress | `FOUND` / `NOT_FOUND` / `LOW_CONFIDENCE` / `ENRICHMENT_REQUIRED` split |
| Outreach funnel | Drafted → Approved → Sent → Replied, by channel |
| Reply rate | Replied ÷ Sent, by channel — the number that tells you whether the copy works |
| Prospects by school | CMU vs Emory |
| ICP fit | Verified in ICP vs outside vs unverified |
| Awaiting approval | Count of `DRAFT` outreaches, so the queue never goes unnoticed |

- [ ] **Step 3: Deploy and sanity-check**

Run: `cd twenty-app && yarn typecheck && yarn deploy`

Cross-check the totals against the REST API:

```bash
curl -fsS "$TWENTY_BASE_URL/rest/prospects?limit=1" -H "Authorization: Bearer $TWENTY_API_KEY"
```

A dashboard that disagrees with the records is worse than no dashboard. Reconcile before moving on.

- [ ] **Step 4: Commit**

```bash
git add twenty-app/src/page-layouts/pipeline-dashboard.page-layout.ts
git commit -m "feat(reporting): add pipeline dashboard replacing the spreadsheet Dashboard sheet"
```

---

### Task 6: Extend the portal rollups

**Files:**
- Modify: `lib/server/summary.ts`, `lib/server/__tests__/summary.test.ts`, `app/portal/page.tsx`

**Interfaces:**
- Extends Plan B's `PortalSummary` with `replyRate`, `awaitingApproval`, `followUpsDue`.

- [ ] **Step 1: Write the failing test for the new fields**

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getPortalSummary } from '../summary';

vi.mock('../twenty-client', () => ({ twentyGraphQL: vi.fn() }));
const { twentyGraphQL } = await import('../twenty-client');

afterEach(() => vi.resetAllMocks());

describe('getPortalSummary reporting fields', () => {
  it('computes reply rate from sent and replied counts', async () => {
    vi.mocked(twentyGraphQL).mockResolvedValue({
      prospects: { totalCount: 252, edges: [] },
      sentOutreaches: { totalCount: 40 },
      repliedOutreaches: { totalCount: 10 },
      draftOutreaches: { totalCount: 7 },
    } as never);

    const summary = await getPortalSummary();
    expect(summary.replyRate).toBeCloseTo(0.25);
    expect(summary.awaitingApproval).toBe(7);
  });

  it('reports a zero reply rate rather than dividing by zero', async () => {
    vi.mocked(twentyGraphQL).mockResolvedValue({
      prospects: { totalCount: 252, edges: [] },
      sentOutreaches: { totalCount: 0 },
      repliedOutreaches: { totalCount: 0 },
      draftOutreaches: { totalCount: 0 },
    } as never);

    expect((await getPortalSummary()).replyRate).toBe(0);
  });
});
```

The divide-by-zero case is the state you are actually in today — zero sends — so it is the first thing the portal will render.

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run lib/server/__tests__/summary.test.ts`
Expected: the two new tests fail.

- [ ] **Step 3: Implement**

Extend the GraphQL query with aliased counts for sent, replied, and draft outreaches. Compute `replyRate` as `sent === 0 ? 0 : replied / sent`. Keep the existing `unavailable` fallback behaviour from Plan B, and add the new fields to the exported type:

```ts
export type PortalSummary = {
  totalProspects: number;
  byStage: Record<string, number>;
  enrichmentProgress: number;
  outreachThisWeek: number;
  unavailable: boolean;
  replyRate: number;        // 0-1; 0 when nothing has been sent
  awaitingApproval: number; // DRAFT outreaches
  followUpsDue: number;
};
```

**This replaces Plan B's single `outreaches` alias with three aliases.** Plan B's existing test mocks `outreaches: { totalCount: 5 }`, which will no longer match. Update that mock in the same commit — otherwise Plan B's test fails for a reason unrelated to any real defect.

- [ ] **Step 4: Add the tiles**

Add Reply rate, Awaiting approval, and Follow-ups due to `app/portal/page.tsx`. Make "Awaiting approval" a link into the Twenty view filtered to `DRAFT` outreaches, so the tile is actionable rather than decorative.

- [ ] **Step 5: Run the tests and verify**

Run: `npx vitest run lib/server/__tests__/summary.test.ts`
Expected: all passed. Then load `/portal` and confirm the tiles render with real values.

- [ ] **Step 6: Commit**

```bash
git add lib/server/summary.ts lib/server/__tests__/summary.test.ts app/portal/page.tsx
git commit -m "feat(reporting): add reply rate and approval queue to portal rollups"
```

---

### Task 7: Weekly digest to Slack

**Files:**
- Create: `twenty-app/src/logic-functions/weekly-digest.ts`, `twenty-app/src/logic-functions/__tests__/weekly-digest.test.ts`

**Interfaces:**
- Produces: `formatDigest(stats)` and a cron-triggered `frater_weekly_digest`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { formatDigest } from '../weekly-digest';

describe('formatDigest', () => {
  it('summarises the week', () => {
    const text = formatDigest({
      enriched: 40, contacted: 12, replied: 3, converted: 1, awaitingApproval: 7, followUpsDue: 5,
    });
    expect(text).toContain('40');
    expect(text).toContain('3');
    expect(text).toContain('Awaiting approval');
  });

  it('says so plainly when nothing happened', () => {
    const text = formatDigest({
      enriched: 0, contacted: 0, replied: 0, converted: 0, awaitingApproval: 0, followUpsDue: 0,
    });
    expect(text).toContain('No pipeline activity');
  });
});
```

A digest that renders a wall of zeroes every week gets muted, and then a real signal gets missed with it.

- [ ] **Step 2: Run it and confirm it fails**

Run: `cd twenty-app && npx vitest run src/logic-functions/__tests__/weekly-digest.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Write `formatDigest` returning a short Slack-formatted string, with an explicit "No pipeline activity this week." when every counter is zero. Define the function with `cronTriggerSettings: { pattern: '0 9 * * 1' }` (Monday mornings), posting to `SLACK_WEBHOOK_URL` from a secret `serverVariable`.

- [ ] **Step 4: Run the tests, deploy, verify**

```bash
cd twenty-app && npx vitest run src/logic-functions/__tests__/weekly-digest.test.ts
yarn typecheck && yarn deploy
```

Trigger it manually once and confirm the Slack message arrives and reads well.

- [ ] **Step 5: Commit and push**

```bash
git add twenty-app/src/logic-functions/weekly-digest.ts twenty-app/src/logic-functions/__tests__/weekly-digest.test.ts
git commit -m "feat(reporting): add weekly pipeline digest to Slack"
git push
```

---

### Task 8: Retire the spreadsheet

**Files:**
- Modify: `docs/runbooks/twenty-railway.md`, `docs/FEATURES.md`

- [ ] **Step 1: Reconcile one final time**

Compare Twenty against the workbook: 252 prospects, 218 companies, every `Queue ID` present.

```bash
npx tsx scripts/import-prospects/import.ts
```

The dry run reports what would change. Expect no creations.

- [ ] **Step 2: Archive the workbook**

Move it to read-only storage with a dated name. Do not delete it — it is the provenance record for all 252 rows.

- [ ] **Step 3: Announce the cutover**

Tell the team the CRM is authoritative and the sheet is archived. Point them at `/portal`.

- [ ] **Step 4: Update project docs**

Refresh `docs/FEATURES.md`, which still describes the pre-CRM "High Achievers" project state, and record the cutover date in the runbook.

- [ ] **Step 5: Commit and push**

```bash
git add docs/runbooks/twenty-railway.md docs/FEATURES.md
git commit -m "docs: record CRM cutover and archive the prospect spreadsheet"
git push
```

---

## Definition of Done

- Gmail and Calendar sync are connected, with team consent recorded; emails and meetings log against People automatically.
- Replies flip `outreach.status` to `REPLIED` and advance prospects to `ENGAGED`, ignoring bounces and auto-replies.
- Silence for five business days produces exactly one follow-up task and one draft per prospect, with no duplicates on repeat runs.
- Conversion to Opportunity is gated to `CONTACTED`/`ENGAGED` and cannot run twice.
- The Twenty dashboard reconciles with the underlying records.
- The portal shows reply rate, approval queue, and follow-ups due; the approval tile links into the filtered view.
- The weekly digest posts to Slack and stays quiet when nothing happened.
- The spreadsheet is archived and the team works exclusively in Twenty.
