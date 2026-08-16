import 'server-only';
import { twentyRest } from './twenty-client';

export type InboundLead = {
  name: string;
  email: string;
  company: string;
  message: string;
};

export type CaptureInboundLeadResult = {
  companyId: string;
  personId: string;
  prospectId: string;
};

type ListResponse = { data: Record<string, { id: string }[]> };
type CreateResponse = { data: Record<string, { id: string } | undefined> };

// Splits "Ada Lovelace" into { firstName: 'Ada', lastName: 'Lovelace' } and
// "Ada" (no surname given) into { firstName: 'Ada', lastName: '' }. Mirrors
// scripts/import-prospects/normalize.ts's splitFullName — that module is a
// separate, unrelated tree (import.ts CLI script), so this is a small
// self-contained copy rather than a cross-tree import.
const splitFullName = (raw: string): { firstName: string; lastName: string } => {
  const parts = raw.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: '', lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
};

// The email's domain is the identity key for the Company record: it is
// stable across resubmissions from the same organization even when the
// free-text `company` field a visitor types varies ("Acme", "Acme Corp",
// "Acme Corporation, Inc."). Derived once and reused for both the lookup
// filter and the created record so a resubmission always finds the same
// company rather than drifting apart from its own filter.
const domainFromEmail = (email: string): string => email.trim().toLowerCase().split('@')[1] ?? '';

// Twenty's REST filter grammar treats a literal comma as the top-level AND
// separator between clauses — even inside a single value — because
// `field[op]:value` is auto-wrapped as `and(field[op]:value)` before
// parsing. A comma inside a value (an email domain someone typos, a company
// name like "Acme, Inc.") would otherwise silently split into a second,
// malformed clause: not an error, an *empty result*, which for a
// lookup-then-create path means a duplicate Company/Person is created
// instead of the existing one being found. Wrapping the value in double
// quotes makes Twenty's top-level splitter treat it as one token. "[" and
// "]" have no verified-safe escape (they toggle the splitter's own
// "inside brackets" state), so a value containing either is refused rather
// than risking a silently wrong match. `encodeURIComponent` alone does not
// provide any of this — it round-trips a literal comma right back to `,`,
// which is exactly the byte Twenty's parser treats as a separator.
//
// Ported (not imported) from scripts/import-prospects/twenty-rest.ts's
// escapeFilterValue, which discovered this live against the production
// Twenty instance (see that file for the full incident writeup and the
// citations into Twenty's own parser source and test suite). Duplicated
// rather than imported because scripts/import-prospects is a separate,
// unrelated CLI-script tree — pulling a Next.js server module's dependency
// from a one-off import tool is the wrong direction for that boundary, and
// this is a small, pure, six-line function.
const escapeFilterValue = (value: string): string => {
  if (/[[\]]/.test(value)) {
    throw new Error(
      'Cannot build a Twenty filter for a value containing "[" or "]" — no verified-safe '
      + `encoding exists for it: ${JSON.stringify(value)}`,
    );
  }

  if (!value.includes(',')) return value;

  if (value.includes('"')) {
    throw new Error(
      'Cannot build a Twenty filter for a value containing both "," and \'"\' — quoting the '
      + `value would end at the embedded quote and expose the comma unprotected: ${JSON.stringify(value)}`,
    );
  }

  return `"${value}"`;
};

// encodeURIComponent is applied once, here, to the entire assembled filter
// clause — never to an individual value on its own (see escapeFilterValue
// above for why that would be insufficient). Mirrors
// scripts/import-prospects/twenty-rest.ts's findByFilter, which applies the
// same discipline at the same point: encode the whole clause exactly once,
// at the moment it goes into the query string.
const findByFilter = (plural: string, filter: string): string =>
  `/${plural}?filter=${encodeURIComponent(filter)}&limit=1`;

const firstRecordId = async (path: string, plural: string): Promise<string | undefined> => {
  const response = await twentyRest<ListResponse>(path);
  const records = response.data[plural];
  return Array.isArray(records) && records.length > 0 ? records[0].id : undefined;
};

const createdId = (response: CreateResponse): string => {
  const record = Object.values(response.data)[0];
  if (!record || typeof record.id !== 'string' || record.id === '') {
    throw new Error('Twenty create returned no usable record id');
  }
  return record.id;
};

// Look up then create the Company by domain. Idempotent: a company created
// by an earlier submission (or left behind by a prior partial failure — see
// captureInboundLead) is found here rather than duplicated.
const findOrCreateCompany = async (name: string, domain: string): Promise<string> => {
  const domainUrl = domain ? `https://${domain}` : undefined;
  const filter = domainUrl
    ? `domainName.primaryLinkUrl[eq]:${escapeFilterValue(domainUrl)}`
    : `name[eq]:${escapeFilterValue(name)}`;

  const existingId = await firstRecordId(findByFilter('companies', filter), 'companies');
  if (existingId) return existingId;

  const response = await twentyRest<CreateResponse>('/companies', {
    method: 'POST',
    body: JSON.stringify({
      name,
      domainName: domainUrl ? { primaryLinkUrl: domainUrl } : undefined,
    }),
  });
  return createdId(response);
};

// Look up then create the Person by email, scoped to the company so a
// resubmission from the same address always resolves to the same person
// record (mirrors the identity scoping rationale in
// scripts/import-prospects/apply-plan.ts).
const findOrCreatePerson = async (
  lead: InboundLead, companyId: string,
): Promise<string> => {
  const filter = `emails.primaryEmail[eq]:${escapeFilterValue(lead.email)},companyId[eq]:${companyId}`;
  const existingId = await firstRecordId(findByFilter('people', filter), 'people');
  if (existingId) return existingId;

  const { firstName, lastName } = splitFullName(lead.name);
  const response = await twentyRest<CreateResponse>('/people', {
    method: 'POST',
    body: JSON.stringify({
      name: { firstName, lastName },
      emails: { primaryEmail: lead.email },
      companyId,
      directEmailStatus: 'FOUND',
    }),
  });
  return createdId(response);
};

const createProspect = async (
  companyId: string, personId: string,
): Promise<string> => {
  const response = await twentyRest<CreateResponse>('/prospects', {
    method: 'POST',
    body: JSON.stringify({
      queueId: `WEB-${Date.now()}`,
      stage: 'SOURCED',
      leadSource: 'INBOUND_WEBSITE',
      companyId,
      personId,
    }),
  });
  return createdId(response);
};

// Best-effort: the note carries the visitor's message for whoever picks up
// the prospect, but a note-creation failure must not fail the whole capture
// — the company/person/prospect already exist and are the part that matters.
const createNoteForPerson = async (lead: InboundLead, personId: string): Promise<void> => {
  try {
    const noteResponse = await twentyRest<CreateResponse>('/notes', {
      method: 'POST',
      body: JSON.stringify({
        title: `Inbound message from ${lead.name}`,
        bodyV2: { markdown: lead.message },
      }),
    });
    const noteId = createdId(noteResponse);

    await twentyRest('/noteTargets', {
      method: 'POST',
      body: JSON.stringify({ noteId, targetPersonId: personId }),
    });
  } catch (error) {
    console.error('[leads] failed to attach note to person (non-fatal)', { personId, error });
  }
};

export const captureInboundLead = async (
  lead: InboundLead,
): Promise<CaptureInboundLeadResult> => {
  const domain = domainFromEmail(lead.email);

  const companyId = await findOrCreateCompany(lead.company, domain);
  const personId = await findOrCreatePerson(lead, companyId);
  const prospectId = await createProspect(companyId, personId);

  await createNoteForPerson(lead, personId);

  return { companyId, personId, prospectId };
};
