import 'server-only';
import { optionalEnv, requireEnv } from './env';
import type { GoogleIdentity } from './google-oauth';
import type { WorkspaceMember } from './membership';

export type AccessDecision =
  | { allowed: true; member: WorkspaceMember }
  | { allowed: false; reason: string };

const parseAllowlist = (): string[] =>
  (optionalEnv('PORTAL_EMAIL_ALLOWLIST') ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

export const evaluateAccess = (
  identity: GoogleIdentity,
  member: WorkspaceMember | null,
): AccessDecision => {
  const domain = requireEnv('ALLOWED_GOOGLE_DOMAIN').toLowerCase();
  const email = identity.email.toLowerCase();

  if (!identity.emailVerified) return { allowed: false, reason: 'Email is not verified' };

  const isDomainMember =
    identity.hostedDomain?.toLowerCase() === domain &&
    email.split('@')[1] === domain;

  const isAllowlisted = parseAllowlist().includes(email);

  if (!isDomainMember && !isAllowlisted) {
    return { allowed: false, reason: 'Not on the Frater AI Labs domain and not allowlisted' };
  }

  // Membership is required on BOTH paths. The allowlist waives the domain
  // requirement, never the membership requirement.
  if (!member) return { allowed: false, reason: 'Not an active Twenty workspace member' };

  return { allowed: true, member };
};
