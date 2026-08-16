import 'server-only';
import { requireEnv } from './env';
import { parseAllowlist } from './allowlist';
import type { GoogleIdentity } from './google-oauth';
import type { WorkspaceMember } from './membership';

export type AccessDecision =
  | { allowed: true; member: WorkspaceMember }
  | { allowed: false; reason: string };

export const evaluateAccess = (
  identity: GoogleIdentity,
  member: WorkspaceMember | null,
): AccessDecision => {
  const domain = requireEnv('ALLOWED_GOOGLE_DOMAIN').toLowerCase();
  const email = identity.email.toLowerCase();

  if (!identity.emailVerified) return { allowed: false, reason: 'Email is not verified' };

  // slice(lastIndexOf('@') + 1), not split('@')[1]: the latter takes the
  // segment after the FIRST '@', so "a@fraterailabs.com@evil.com" would
  // read as domain "fraterailabs.com" instead of the real, malformed
  // domain. Not exploitable as traced (Google won't issue such an email
  // claim, and this path also requires the hd claim to match), but this is
  // the auth boundary and the correct derivation costs nothing.
  const isDomainMember =
    identity.hostedDomain?.toLowerCase() === domain &&
    email.slice(email.lastIndexOf('@') + 1) === domain;

  const isAllowlisted = parseAllowlist().includes(email);

  if (!isDomainMember && !isAllowlisted) {
    return { allowed: false, reason: 'Not on the Frater AI Labs domain and not allowlisted' };
  }

  // Membership is required on BOTH paths. The allowlist waives the domain
  // requirement, never the membership requirement.
  if (!member) return { allowed: false, reason: 'Not an active Twenty workspace member' };

  return { allowed: true, member };
};
