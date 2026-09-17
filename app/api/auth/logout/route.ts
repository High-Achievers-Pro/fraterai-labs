import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE_NAME } from '@/lib/server/session';

export const POST = async (request: NextRequest) => {
  // 303, not the NextResponse.redirect() default of 307: a 307 preserves the
  // POST method, so the browser would re-POST to /portal/login and hit a 405
  // there once that (static) page exists. 303 forces the follow-up to GET.
  const response = NextResponse.redirect(new URL('/portal/login', request.url), 303);
  // response.cookies.delete(SESSION_COOKIE_NAME) (bare name) would emit
  // "<name>=; Path=/; Expires=<epoch>" with NO `Secure` attribute —
  // ResponseCookies.delete only forwards attributes it's explicitly given,
  // it does not infer them from the name. A __Host- prefixed cookie's
  // Set-Cookie header is rejected outright by the browser's prefix
  // validation when Secure is absent, deletions included, so that would
  // silently fail to clear the session cookie: the user sees the redirect
  // to /portal/login but keeps a fully valid session until the TTL expires.
  // Passing path/secure explicitly here (matching the attributes the
  // cookie was set with) is what makes the deletion itself valid.
  response.cookies.delete({ name: SESSION_COOKIE_NAME, path: '/', secure: true });
  return response;
};
