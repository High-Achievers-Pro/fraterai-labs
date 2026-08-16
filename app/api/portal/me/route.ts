import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE_NAME, readSessionCookie } from '@/lib/server/session';

export const GET = async (request: NextRequest) => {
  const session = await readSessionCookie(request.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  return NextResponse.json({
    email: session.email,
    name: session.name,
    workspaceMemberId: session.workspaceMemberId,
  });
};
