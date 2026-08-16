import { NextResponse, type NextRequest } from 'next/server';
import { readMagicToken } from '@/lib/server/magic-link';
import { findActiveWorkspaceMember } from '@/lib/server/membership';
import { SESSION_COOKIE_NAME, createSessionCookie } from '@/lib/server/session';

// Matches the Google-callback session lifetime (app/api/auth/google/callback/route.ts).
const SESSION_TTL_SECONDS = 8 * 60 * 60;

const invalidLinkRedirect = (request: NextRequest) =>
  NextResponse.redirect(new URL('/portal/login?error=link_invalid', request.url));

export const GET = async (request: NextRequest) => {
  const token = new URL(request.url).searchParams.get('token');

  try {
    // readMagicToken (lib/server/magic-link.ts) already validates, in order:
    // signature -> expiry -> purpose === 'magic-link' -> current allowlist
    // membership. A null result here means one of those failed; no detail is
    // surfaced about which.
    const payload = await readMagicToken(token ?? undefined);
    if (!payload) return invalidLinkRedirect(request);

    // Re-query membership at redemption time (not the membership at request
    // time) — this is what makes revocation immediate. Removing someone from
    // the Twenty workspace after the link was emailed still blocks them here.
    const member = await findActiveWorkspaceMember(payload.email);
    if (!member) return invalidLinkRedirect(request);

    const cookie = await createSessionCookie(
      { email: payload.email, name: member.name, workspaceMemberId: member.id },
      SESSION_TTL_SECONDS,
    );

    const response = NextResponse.redirect(new URL('/portal', request.url));
    response.cookies.set(SESSION_COOKIE_NAME, cookie, {
      httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: SESSION_TTL_SECONDS,
    });
    return response;
  } catch {
    return invalidLinkRedirect(request);
  }
};
