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

export const normalizeHeadcountStatus = (raw: string): CompanyInput['headcountStatus'] => {
  const value = raw.trim().toLowerCase();
  if (value.includes('likely startup')) return 'LIKELY_STARTUP';
  return 'NEEDS_VERIFICATION';
};

export const splitFullName = (raw: string): { firstName: string; lastName: string } => {
  const parts = raw.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: '', lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
};

export const isSearchUrl = (raw: string): boolean =>
  raw.includes('google.com/search') || raw.includes('bing.com/search');

export const toDomainName = (raw: string): CompanyInput['domainName'] => {
  const value = raw.trim();
  return value ? { primaryLinkUrl: value } : undefined;
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
