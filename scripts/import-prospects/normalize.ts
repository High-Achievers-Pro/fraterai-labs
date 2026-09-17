import type { CompanyInput, PersonInput } from './types';

export const normalizeAlumniPath = (raw: string): PersonInput['alumniPath'] => {
  const value = raw.trim().toLowerCase();
  if (!value) return null;
  if (value.startsWith('decision-maker')) return 'DECISION_MAKER';
  if (value.startsWith('referral')) return 'REFERRAL';
  return null;
};

export const normalizeSchool = (raw: string): PersonInput['school'] => {
  const value = raw.trim().toUpperCase();
  if (value === 'CMU') return 'CMU';
  if (value === 'EMORY') return 'EMORY';
  return null;
};

// Returns null for anything unrecognized rather than defaulting, so the caller
// can warn instead of silently asserting a headcount claim the sheet never
// made. Mirrors normalizeAlumniPath / normalizeSchool.
export const normalizeHeadcountStatus = (raw: string): CompanyInput['headcountStatus'] => {
  const value = raw.trim().toLowerCase();
  if (value.includes('likely startup')) return 'LIKELY_STARTUP';
  if (value.includes('needs headcount verification')) return 'NEEDS_VERIFICATION';
  return null;
};

export const splitFullName = (raw: string): { firstName: string; lastName: string } => {
  const parts = raw.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: '', lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
};

export const isSearchUrl = (raw: string): boolean =>
  raw.includes('google.com/search') || raw.includes('bing.com/search');

// domainName is the People Data Labs enrichment match key, so it must only
// ever hold a real company URL. A third of the sheet's Website cells are
// "google.com/search?q=<Company>+official+website" placeholders; those are
// rejected here and the caller routes them to researchLinks instead.
export const toDomainName = (raw: string): CompanyInput['domainName'] => {
  const value = raw.trim();
  if (!value || isSearchUrl(value)) return undefined;
  return { primaryLinkUrl: value };
};

export const buildResearchLinks = (
  candidates: string[],
): CompanyInput['researchLinks'] => {
  const urls = candidates.map((c) => c.trim()).filter(Boolean);
  if (urls.length === 0) return undefined;
  const [primaryLinkUrl, ...rest] = urls;
  return rest.length > 0
    ? { primaryLinkUrl, secondaryLinks: rest.map((url) => ({ url })) }
    : { primaryLinkUrl };
};

export const countCharacters = (body: string, _sheetValue: string): number | null =>
  body.trim() ? body.length : null;
