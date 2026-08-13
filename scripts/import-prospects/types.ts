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
