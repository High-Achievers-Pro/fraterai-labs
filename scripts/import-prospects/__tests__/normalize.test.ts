import { describe, expect, it } from 'vitest';
import {
  normalizeAlumniPath, normalizeSchool, normalizeHeadcountStatus,
  splitFullName, isSearchUrl, toDomainName, buildResearchLinks, countCharacters,
} from '../normalize';

describe('normalizeAlumniPath', () => {
  it('maps all six observed variants to two values', () => {
    expect(normalizeAlumniPath('Decision-maker alumni')).toBe('DECISION_MAKER');
    expect(normalizeAlumniPath('Referral alumni')).toBe('REFERRAL');
    expect(normalizeAlumniPath('Decision-maker / CMU connection')).toBe('DECISION_MAKER');
    expect(normalizeAlumniPath('Referral / Goizueta advisory connection')).toBe('REFERRAL');
    expect(normalizeAlumniPath('Referral / company-level alumni startup')).toBe('REFERRAL');
    expect(normalizeAlumniPath('Decision-maker/referral alumni')).toBe('DECISION_MAKER');
  });

  it('returns null for unknown input rather than guessing', () => {
    expect(normalizeAlumniPath('')).toBeNull();
    expect(normalizeAlumniPath('Something else')).toBeNull();
  });
});

describe('normalizeSchool', () => {
  it('maps school names', () => {
    expect(normalizeSchool('Emory')).toBe('EMORY');
    expect(normalizeSchool('CMU')).toBe('CMU');
    expect(normalizeSchool('unknown')).toBeNull();
  });
});

describe('normalizeHeadcountStatus', () => {
  it('maps the two observed statuses', () => {
    expect(normalizeHeadcountStatus('Needs headcount verification')).toBe('NEEDS_VERIFICATION');
    expect(normalizeHeadcountStatus('Likely startup; verify 50-500')).toBe('LIKELY_STARTUP');
    expect(normalizeHeadcountStatus('Likely startup; verify 50–500')).toBe('LIKELY_STARTUP');
  });

  it('defaults to needing verification', () => {
    expect(normalizeHeadcountStatus('')).toBe('NEEDS_VERIFICATION');
  });
});

describe('splitFullName', () => {
  it('splits on the first space', () => {
    expect(splitFullName('Ada Lovelace')).toEqual({ firstName: 'Ada', lastName: 'Lovelace' });
  });

  it('keeps multi-word surnames intact', () => {
    expect(splitFullName('Sean Hengxiao Tao')).toEqual({ firstName: 'Sean', lastName: 'Hengxiao Tao' });
  });

  it('handles a single name', () => {
    expect(splitFullName('Cher')).toEqual({ firstName: 'Cher', lastName: '' });
  });
});

describe('isSearchUrl', () => {
  it('detects Google search URLs', () => {
    expect(isSearchUrl('https://www.google.com/search?q=site%3Alinkedin.com')).toBe(true);
  });

  it('does not flag real profile URLs', () => {
    expect(isSearchUrl('https://www.linkedin.com/in/someone')).toBe(false);
    expect(isSearchUrl('')).toBe(false);
  });
});

describe('toDomainName', () => {
  it('produces a Twenty LINKS value', () => {
    expect(toDomainName('https://acme.test/')).toEqual({ primaryLinkUrl: 'https://acme.test/' });
  });

  it('returns undefined for blanks', () => {
    expect(toDomainName('')).toBeUndefined();
  });
});

describe('buildResearchLinks', () => {
  it('collects search URLs into one LINKS value', () => {
    const links = buildResearchLinks([
      'https://www.google.com/search?q=a',
      'https://www.google.com/search?q=b',
      '',
    ]);
    expect(links).toEqual({
      primaryLinkUrl: 'https://www.google.com/search?q=a',
      secondaryLinks: [{ url: 'https://www.google.com/search?q=b' }],
    });
  });

  it('returns undefined when there is nothing to store', () => {
    expect(buildResearchLinks(['', ''])).toBeUndefined();
  });
});

describe('countCharacters', () => {
  it('prefers the actual body length over the sheet value', () => {
    expect(countCharacters('hello', '99')).toBe(5);
  });

  it('returns null with no body', () => {
    expect(countCharacters('', '12')).toBeNull();
  });
});
