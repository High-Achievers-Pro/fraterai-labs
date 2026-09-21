import { NextResponse, type NextRequest } from 'next/server';
import { readMagicToken } from '@/lib/server/magic-link';
import { findActiveWorkspaceMember } from '@/lib/server/membership';
import { SESSION_COOKIE_NAME, SESSION_TTL_SECONDS, createSessionCookie } from '@/lib/server/session';
import { captureServerEvent } from '@/lib/server/posthog';

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

    // Re-query membership at redemption time (not the membership when the
    // link was requested) so someone removed from the Twenty workspace
    // between requesting the link and clicking it is blocked here. This
    // does NOT make revocation immediate for the life of the session that
    // gets minted below — nothing revisits Twenty again until the session
    // expires (SESSION_TTL_SECONDS, up to 8 hours) unless something else
    // re-checks. That something else is the portal surface itself
    // (lib/server/portal-access.ts, used by the portal page and
    // app/api/portal/*), which re-checks membership on every request —
    // see final-review.md I1 for why this comment previously overclaimed
    // "immediate" and what closes the gap.
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
    await captureServerEvent('magic_link_sign_in_completed', member.id);
    return response;
  } catch (error) {
    console.error('[auth/magic-link] verification failed', error);
    return invalidLinkRedirect(request);
  }
};
