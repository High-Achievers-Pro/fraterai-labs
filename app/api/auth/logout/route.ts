import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE_NAME } from '@/lib/server/session';

export const POST = async (request: NextRequest) => {
  const response = NextResponse.redirect(new URL('/portal/login', request.url));
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
};
