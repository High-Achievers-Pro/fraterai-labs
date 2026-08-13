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

  // 86 of the 252 real Website cells are Google-search placeholders. domainName
  // is the enrichment match key, so a search URL there silently poisons
  // enrichment for a third of accounts while looking merely odd in the UI.
  describe('when the Website cell is a search URL, not a domain', () => {
    const searchUrl = 'https://www.google.com/search?q=Acme+Co+official+website';
    const plan = () => buildPlan([row({ website: searchUrl })], []);

    it('leaves domainName empty', () => {
      expect(plan().entries[0].company.domainName).toBeUndefined();
      expect(JSON.stringify(plan().entries[0].company.domainName ?? '')).not.toContain('search');
    });

    it('keeps the URL as a research link alongside the LinkedIn lookup', () => {
      const links = plan().entries[0].company.researchLinks;
      expect(links?.primaryLinkUrl).toBe('https://www.google.com/search?q=acme');
      expect(links?.secondaryLinks).toEqual([{ url: searchUrl }]);
    });

    it('warns, naming the queue id', () => {
      expect(plan().warnings.some((w) => w.startsWith('EV-001:') && w.includes('search URL'))).toBe(true);
    });

    it('does not warn for a real domain', () => {
      expect(buildPlan([row()], []).warnings.some((w) => w.includes('search URL'))).toBe(false);
    });
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

  it('warns on an unmapped school but still imports the row', () => {
    const plan = buildPlan([row({ school: 'Georgia Tech' })], []);
    expect(plan.entries[0].person.school).toBeNull();
    expect(plan.warnings.some((w) => w.includes('EV-001') && w.includes('school'))).toBe(true);
  });

  it('warns on an unmapped headcount status instead of asserting NEEDS_VERIFICATION', () => {
    const plan = buildPlan([row({ headcountStatus: '600 employees' })], []);
    expect(plan.entries[0].company.headcountStatus).toBeNull();
    expect(plan.warnings.some((w) => w.includes('EV-001') && w.includes('headcount status'))).toBe(true);
  });

  it('does not warn about blank school or headcount cells', () => {
    const plan = buildPlan([row({ school: '', headcountStatus: '' })], []);
    expect(plan.warnings.filter((w) => w.includes('unmapped'))).toEqual([]);
  });

  // The real sheet has one name spanning ten distinct companies. These rows
  // must reach a human, not be merged or dropped.
  it('warns when one person name appears under more than one company', () => {
    const plan = buildPlan([
      row({ queueId: 'CMU-033', leadPerson: 'Founder Name', company: 'Alpha Inc' }),
      row({ queueId: 'CMU-034', leadPerson: 'Founder Name', company: 'Beta Inc' }),
    ], []);
    const warning = plan.warnings.find((w) => w.includes('Founder Name'));
    expect(warning).toBeDefined();
    expect(warning).toContain('CMU-033');
    expect(warning).toContain('CMU-034');
    expect(warning).toContain('Alpha Inc');
    expect(warning).toContain('Beta Inc');
    // Surfaced, never dropped or merged.
    expect(plan.entries).toHaveLength(2);
  });

  it('does not warn when the same name appears twice under one company', () => {
    const plan = buildPlan([
      row({ queueId: 'EV-001' }),
      row({ queueId: 'EV-002' }),
    ], []);
    expect(plan.warnings.some((w) => w.includes('appears under'))).toBe(false);
  });

  // A repeated queue id silently no-ops on the second row (the upsert cache is
  // keyed on it), so it must never pass unnoticed.
  it('warns when a queue id repeats', () => {
    const plan = buildPlan([row(), row({ company: 'Other Co' })], []);
    expect(plan.warnings.some((w) => w.includes('EV-001') && w.includes('duplicate queue id'))).toBe(true);
  });

  it('does not warn about queue ids when they are all distinct', () => {
    const plan = buildPlan([row(), row({ queueId: 'EV-002' })], []);
    expect(plan.warnings.some((w) => w.includes('duplicate queue id'))).toBe(false);
  });

  it('passes the suppression list through', () => {
    const plan = buildPlan([row()], [{ name: 'Excluded Corp', reason: 'Exclude' }]);
    expect(plan.suppressedCompanies).toEqual([{ name: 'Excluded Corp', reason: 'Exclude' }]);
  });
});
