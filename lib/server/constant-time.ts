import 'server-only';

// XOR-and-OR every character rather than stopping (or even branching) at
// the first mismatch — a length-only or early-exit comparison leaks the
// correct value one byte at a time through response timing. Shared by the
// session/magic-link token signatures (via signed-token.ts) and the Twenty
// webhook signature (webhook-verify.ts). Those three sign different bytes
// with different secrets and different digest encodings, so only this
// comparison — not the signing itself — is common ground between them. See
// final-review.md I5.
export const constantTimeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
};
