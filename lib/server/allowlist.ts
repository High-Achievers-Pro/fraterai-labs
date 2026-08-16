import 'server-only';
import { optionalEnv } from './env';

// Shared by auth-gate.ts (the Google-domain door's allowlist waiver) and
// magic-link.ts (the magic-link door, checked both at request time and
// again on every token read). Previously duplicated verbatim in both
// files; moved here rather than left as two copies because a future format
// change (semicolons, wildcards, an "@domain" entry) applied to only one
// copy would make the two doors silently disagree about who is
// allowlisted. See final-review.md I6.
export const parseAllowlist = (): string[] =>
  (optionalEnv('PORTAL_EMAIL_ALLOWLIST') ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
