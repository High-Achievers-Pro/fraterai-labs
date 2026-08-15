import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE_NAME } from '@/lib/server/session';

export const POST = async (request: NextRequest) => {
  // 303, not the NextResponse.redirect() default of 307: a 307 preserves the
  // POST method, so the browser would re-POST to /portal/login and hit a 405
  // there once that (static) page exists. 303 forces the follow-up to GET.
  const response = NextResponse.redirect(new URL('/portal/login', request.url), 303);
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
};
