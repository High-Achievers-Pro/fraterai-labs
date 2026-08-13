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
