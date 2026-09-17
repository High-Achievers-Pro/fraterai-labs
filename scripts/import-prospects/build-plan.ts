import {
  buildResearchLinks, countCharacters, isSearchUrl, normalizeAlumniPath, normalizeHeadcountStatus,
  normalizeSchool, splitFullName, toDomainName,
} from './normalize';
import type { ImportPlan, OutreachInput, ParsedRow, PlanEntry } from './types';

const LINKEDIN_NOTE_LIMIT = 200;

// Warnings that can only be seen by looking across rows, not at one row.
const crossRowWarnings = (rows: ParsedRow[]): string[] => {
  const out: string[] = [];

  // A repeated queue id would silently no-op on the second occurrence (the
  // upsert cache is keyed on it), quietly dropping a row. The real sheet has
  // none; this guards the single most important identity guarantee against a
  // future edit.
  const queueIdCounts = new Map<string, number>();
  for (const row of rows) {
    queueIdCounts.set(row.queueId, (queueIdCounts.get(row.queueId) ?? 0) + 1);
  }
  for (const [queueId, count] of queueIdCounts) {
    if (count > 1) {
      out.push(
        `${queueId}: duplicate queue id — appears in ${count} rows; only the first will create a prospect`,
      );
    }
  }

  // The same person name under more than one company is either a data error
  // or genuinely different people who share a name. Either way a human must
  // decide: they are imported as separate people (person identity is scoped
  // to the company) and surfaced here rather than merged silently.
  const byName = new Map<string, { label: string; companies: string[]; queueIds: string[] }>();
  for (const row of rows) {
    const key = row.leadPerson.trim().toLowerCase();
    if (!key) continue;
    const seen = byName.get(key)
      ?? { label: row.leadPerson.trim(), companies: [], queueIds: [] };
    if (!seen.companies.includes(row.company)) seen.companies.push(row.company);
    seen.queueIds.push(row.queueId);
    byName.set(key, seen);
  }
  for (const { label, companies, queueIds } of byName.values()) {
    if (companies.length > 1) {
      out.push(
        `${queueIds.join(', ')}: person name "${label}" appears under ${companies.length} companies `
        + `(${companies.join('; ')}) — imported as separate people, confirm whether they are the same person`,
      );
    }
  }

  return out;
};

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
  const warnings: string[] = crossRowWarnings(rows);

  const entries: PlanEntry[] = rows.map((row) => {
    const alumniPath = normalizeAlumniPath(row.alumniPath);
    if (alumniPath === null && row.alumniPath.trim()) {
      warnings.push(`${row.queueId}: unmapped alumni path "${row.alumniPath}"`);
    }

    const school = normalizeSchool(row.school);
    if (school === null && row.school.trim()) {
      warnings.push(`${row.queueId}: unmapped school "${row.school}"`);
    }

    const headcountStatus = normalizeHeadcountStatus(row.headcountStatus);
    if (headcountStatus === null && row.headcountStatus.trim()) {
      warnings.push(`${row.queueId}: unmapped headcount status "${row.headcountStatus}"`);
    }

    // A search-URL Website is a placeholder, not a domain. Keep it as a
    // research link so the lookup is not lost, but never let it reach
    // domainName, which drives enrichment matching.
    const domainName = toDomainName(row.website);
    const rejectedWebsite = isSearchUrl(row.website) ? row.website.trim() : '';
    if (rejectedWebsite) {
      warnings.push(
        `${row.queueId}: Website is a search URL, not a domain — routed to researchLinks `
        + `and left out of domainName ("${rejectedWebsite}")`,
      );
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
        domainName,
        segment: row.segment,
        region: row.region,
        country: row.country,
        headcountStatus,
        researchLinks: buildResearchLinks([row.companyLinkedInLookup, rejectedWebsite]),
      },
      person: {
        name: splitFullName(row.leadPerson),
        jobTitle: row.leadTitle,
        school,
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
