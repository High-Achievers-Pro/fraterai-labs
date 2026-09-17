import { NextResponse } from 'next/server';
import { buildAuthUrl } from '@/lib/server/google-oauth';

export const GET = async () => {
  const state = crypto.randomUUID();

  const response = NextResponse.redirect(buildAuthUrl(state));
  response.cookies.set('frater_oauth_state', state, {
    httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 600,
  });

  return response;
};
