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
