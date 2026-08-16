import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE_NAME, readSessionCookie } from '@/lib/server/session';

// Next.js 16 renamed the `middleware` file convention to `proxy` (file must be
// `proxy.ts` at the repo root, export named `proxy` or default). Confirmed against
// node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md
// ("Migration to Proxy" section + v16.0.0 row of the Version History table) and
// node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md
// ("`middleware` to `proxy`"). `config.matcher` itself is unchanged. See
// docs/runbooks/portal-env.md Q1 for the full citation trail.

const LOGIN_PATH = '/portal/login';

export const proxy = async (request: NextRequest) => {
  const { pathname } = request.nextUrl;

  // The matcher below is `/portal/:path*`, which — per path-to-regexp
  // semantics (`*` = zero or more segments) — matches `/portal/login` itself,
  // not just its children. Without this bypass, an unauthenticated visitor
  // hitting `/portal/login` would immediately be redirected back to
  // `/portal/login`, an infinite loop that locks everyone out. Verified
  // empirically with `curl -i` against `next dev` (see task-6-report.md).
  if (pathname === LOGIN_PATH) {
    return NextResponse.next();
  }

  // Fail closed: any exception while reading the session cookie (e.g.
  // SESSION_SECRET missing in the deploy environment, or an internal throw
  // from readSessionCookie) is treated the same as "no session" rather than
  // being allowed to propagate into an unhandled 500. Access is denied either
  // way; this just keeps the denial predictable (redirect / 401 JSON) instead
  // of an opaque framework error page.
  let session: Awaited<ReturnType<typeof readSessionCookie>> = null;
  try {
    session = await readSessionCookie(request.cookies.get(SESSION_COOKIE_NAME)?.value);
  } catch {
    session = null;
  }

  if (session) return NextResponse.next();

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.redirect(new URL(LOGIN_PATH, request.url));
};

export const config = {
  matcher: ['/portal/:path*', '/api/portal/:path*'],
};
