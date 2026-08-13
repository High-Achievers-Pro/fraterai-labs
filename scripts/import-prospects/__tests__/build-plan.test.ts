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

  it('routes person search URLs to researchLinks and never to a profile field', () => {
    const [entry] = buildPlan([row()], []).entries;
    expect(entry.person.researchLinks?.primaryLinkUrl).toContain('google.com/search');
    expect(entry.person.evidenceUrl).toEqual({ primaryLinkUrl: 'https://evidence.test/a' });
    expect(JSON.stringify(entry.person)).not.toContain('linkedinLink');
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
