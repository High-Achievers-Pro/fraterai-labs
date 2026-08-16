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

const encodeFilter = (filter: string): string => encodeURIComponent(filter);

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
    ? `domainName.primaryLinkUrl[eq]:${encodeFilter(domainUrl)}`
    : `name[eq]:${encodeFilter(name)}`;

  const existingId = await firstRecordId(`/companies?filter=${filter}&limit=1`, 'companies');
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
  const filter = `emails.primaryEmail[eq]:${encodeFilter(lead.email)},companyId[eq]:${companyId}`;
  const existingId = await firstRecordId(`/people?filter=${filter}&limit=1`, 'people');
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
