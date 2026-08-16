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

// Fix round 1, Important-2: Twenty's REST filter grammar treats a literal
// comma as a top-level AND separator (even inside a single value), so an
// unescaped comma in a filter value doesn't error — it silently returns
// zero matches. On a lookup-then-create path that means a duplicate
// Company/Person gets created on every resubmission instead of the
// existing one being found. These tests exercise that path directly rather
// than trusting the general shape of the earlier tests to cover it.
describe('captureInboundLead filter escaping', () => {
  it('sends the domain filter unquoted when it has nothing to escape', async () => {
    vi.mocked(twentyRest).mockImplementation(async (path: string) => {
      if (path.startsWith('/companies?')) return { data: { companies: [] } } as never;
      if (path.startsWith('/people?')) return { data: { people: [] } } as never;
      if (path === '/companies') return { data: { createCompany: { id: 'c1' } } } as never;
      if (path === '/people') return { data: { createPerson: { id: 'p1' } } } as never;
      if (path === '/prospects') return { data: { createProspect: { id: 'pr1' } } } as never;
      return { data: {} } as never;
    });

    await captureInboundLead({
      name: 'Ada Lovelace', email: 'ada@acme.test',
      company: 'Acme, Inc.', message: 'hi',
    });

    const lookupCall = vi.mocked(twentyRest).mock.calls.find(
      (c) => typeof c[0] === 'string' && c[0].startsWith('/companies?'),
    );
    const rawPath = lookupCall?.[0] as string;
    const filterParam = new URL(`http://x${rawPath}`).searchParams.get('filter');
    // The lookup here filters by domain (acme.test has no comma), so the
    // comma-bearing *company name* never reaches this particular filter —
    // confirming the domain branch is unaffected by it. The company NAME
    // filter branch, where a comma really is in the filtered value, is
    // exercised by the next test, where there is no domain to prefer.
    expect(filterParam).toBe('domainName.primaryLinkUrl[eq]:https://acme.test');
  });

  it('quotes a comma-bearing company name in the filter when there is no domain to key on', async () => {
    vi.mocked(twentyRest).mockImplementation(async (path: string) => {
      if (path.startsWith('/companies?')) return { data: { companies: [] } } as never;
      if (path.startsWith('/people?')) return { data: { people: [] } } as never;
      return { data: { x: { id: 'id' } } } as never;
    });

    // An email with no "@" (never reaches captureInboundLead through the
    // route's own validation, which requires EMAIL_SHAPE — this exercises
    // the function directly, the way leads.ts must still behave defensively
    // regardless of what validation sits in front of it elsewhere) derives
    // an empty domain, forcing the name[eq] fallback branch.
    await captureInboundLead({
      name: 'Ada Lovelace', email: 'no-domain',
      company: 'Acme, Inc.', message: 'hi',
    });

    const lookupCall = vi.mocked(twentyRest).mock.calls.find(
      (c) => typeof c[0] === 'string' && c[0].startsWith('/companies?'),
    );
    const rawPath = lookupCall?.[0] as string;
    const filterParam = new URL(`http://x${rawPath}`).searchParams.get('filter');
    expect(filterParam).toBe('name[eq]:"Acme, Inc."');
  });

  it('quotes a comma-bearing email in the person lookup filter', async () => {
    vi.mocked(twentyRest).mockImplementation(async (path: string) => {
      if (path.startsWith('/companies?')) return { data: { companies: [] } } as never;
      if (path.startsWith('/people?')) return { data: { people: [] } } as never;
      return { data: { x: { id: 'id' } } } as never;
    });

    await captureInboundLead({
      name: 'Ada Lovelace', email: 'weird,addr@acme.test',
      company: 'Acme', message: 'hi',
    });

    const lookupCall = vi.mocked(twentyRest).mock.calls.find(
      (c) => typeof c[0] === 'string' && c[0].startsWith('/people?'),
    );
    const rawPath = lookupCall?.[0] as string;
    const filterParam = new URL(`http://x${rawPath}`).searchParams.get('filter');
    expect(filterParam).toContain('emails.primaryEmail[eq]:"');
    expect(filterParam).toContain(',');
  });

  it('refuses (throws) rather than silently sending a bracket-bearing filter value', async () => {
    vi.mocked(twentyRest).mockResolvedValue({ data: { companies: [], people: [] } } as never);

    await expect(captureInboundLead({
      name: 'Ada Lovelace', email: 'ada@[acme].test',
      company: 'Acme', message: 'hi',
    })).rejects.toThrow(/\[.*\]/);

    // The refusal must happen before any create — a bracketed value must
    // never reach a create body under a name that could pass validation
    // elsewhere and then never be found again on lookup.
    const paths = vi.mocked(twentyRest).mock.calls.map((c) => c[0]);
    expect(paths).not.toContain('/companies');
  });
});
