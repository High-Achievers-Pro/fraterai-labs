import { beforeEach, describe, expect, it } from 'vitest';
import { evaluateAccess } from '../auth-gate';

const member = { id: 'wm-1', userEmail: 'a@fraterailabs.com', name: 'A B' };
const identity = {
  email: 'a@fraterailabs.com', name: 'A B',
  hostedDomain: 'fraterailabs.com', emailVerified: true,
};

beforeEach(() => { process.env.ALLOWED_GOOGLE_DOMAIN = 'fraterailabs.com'; });

describe('evaluateAccess', () => {
  it('allows a verified in-domain workspace member', () => {
    expect(evaluateAccess(identity, member)).toEqual({ allowed: true, member });
  });

  it('denies a personal Gmail account even if somehow a member', () => {
    const outsider = { ...identity, email: 'someone@gmail.com', hostedDomain: undefined };
    expect(evaluateAccess(outsider, member).allowed).toBe(false);
  });

  it('denies an in-domain account that is not a workspace member', () => {
    expect(evaluateAccess(identity, null).allowed).toBe(false);
  });

  it('denies an unverified email', () => {
    expect(evaluateAccess({ ...identity, emailVerified: false }, member).allowed).toBe(false);
  });

  it('denies a lookalike domain', () => {
    const lookalike = {
      ...identity, email: 'a@notfraterailabs.com', hostedDomain: 'notfraterailabs.com',
    };
    expect(evaluateAccess(lookalike, member).allowed).toBe(false);
  });

  it('denies when the email domain and hd claim disagree', () => {
    expect(evaluateAccess({ ...identity, email: 'a@gmail.com' }, member).allowed).toBe(false);
  });

  it('denies an in-domain email with no hd claim', () => {
    expect(evaluateAccess({ ...identity, hostedDomain: undefined }, member).allowed).toBe(false);
  });

  it('denies an in-domain email with an empty-string hd claim', () => {
    expect(evaluateAccess({ ...identity, hostedDomain: '' }, member).allowed).toBe(false);
  });

  it('allows an allowlisted outside address that is also a workspace member', () => {
    process.env.PORTAL_EMAIL_ALLOWLIST = 'contractor@partner.test';
    const outside = {
      ...identity, email: 'contractor@partner.test', hostedDomain: undefined,
    };
    expect(evaluateAccess(outside, member).allowed).toBe(true);
  });

  it('still denies an allowlisted address that is NOT a workspace member', () => {
    process.env.PORTAL_EMAIL_ALLOWLIST = 'contractor@partner.test';
    const outside = {
      ...identity, email: 'contractor@partner.test', hostedDomain: undefined,
    };
    expect(evaluateAccess(outside, null).allowed).toBe(false);
  });

  it('matches the allowlist case-insensitively', () => {
    process.env.PORTAL_EMAIL_ALLOWLIST = 'Contractor@Partner.test';
    const outside = {
      ...identity, email: 'contractor@partner.test', hostedDomain: undefined,
    };
    expect(evaluateAccess(outside, member).allowed).toBe(true);
  });

  it('does not treat an allowlist entry as a domain suffix', () => {
    process.env.PORTAL_EMAIL_ALLOWLIST = 'contractor@partner.test';
    const other = {
      ...identity, email: 'someone-else@partner.test', hostedDomain: undefined,
    };
    expect(evaluateAccess(other, member).allowed).toBe(false);
  });

  it('denies everyone outside the domain when the allowlist is empty', () => {
    process.env.PORTAL_EMAIL_ALLOWLIST = '';
    const outside = { ...identity, email: 'x@gmail.com', hostedDomain: undefined };
    expect(evaluateAccess(outside, member).allowed).toBe(false);
  });
});
