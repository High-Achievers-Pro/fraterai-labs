import { NextResponse, type NextRequest } from 'next/server';
import { evaluateAccess } from '@/lib/server/auth-gate';
import { exchangeCodeForIdToken, verifyIdToken } from '@/lib/server/google-oauth';
import { findActiveWorkspaceMember } from '@/lib/server/membership';
import { SESSION_COOKIE_NAME, createSessionCookie } from '@/lib/server/session';

const SESSION_TTL_SECONDS = 8 * 60 * 60;

export const GET = async (request: NextRequest) => {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const expectedState = request.cookies.get('frater_oauth_state')?.value;

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(new URL('/portal/login?error=invalid_state', request.url));
  }

  try {
    const identity = await verifyIdToken(await exchangeCodeForIdToken(code));
    const member = await findActiveWorkspaceMember(identity.email);
    const decision = evaluateAccess(identity, member);

    if (!decision.allowed) {
      return NextResponse.redirect(new URL('/portal/login?error=not_authorized', request.url));
    }

    const cookie = await createSessionCookie(
      { email: identity.email, name: decision.member.name, workspaceMemberId: decision.member.id },
      SESSION_TTL_SECONDS,
    );

    const response = NextResponse.redirect(new URL('/portal', request.url));
    response.cookies.set(SESSION_COOKIE_NAME, cookie, {
      httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: SESSION_TTL_SECONDS,
    });
    response.cookies.delete('frater_oauth_state');

    return response;
  } catch {
    return NextResponse.redirect(new URL('/portal/login?error=sign_in_failed', request.url));
  }
};
