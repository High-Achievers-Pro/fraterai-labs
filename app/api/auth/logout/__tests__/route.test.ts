import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { SESSION_COOKIE_NAME } from '@/lib/server/session';

// lib/server/session is intentionally NOT mocked — this test exists
// specifically to catch a real regression the __Host- rename (I4)
// introduced: response.cookies.delete(SESSION_COOKIE_NAME) with no
// options omits `Secure` from the serialized Set-Cookie header.
// ResponseCookies is an in-memory map with no prefix validation, so
// asserting against res.cookies.get(...) would pass either way and MISS
// this bug — the browser is what rejects a __Host--prefixed Set-Cookie
// without Secure, deletions included. So this asserts the actual
// serialized header string, the way a browser would see it.
const buildRequest = () =>
  new NextRequest('https://www.fraterailabs.com/api/auth/logout', { method: 'POST' });

describe('POST /api/auth/logout', () => {
  it('serializes the session-cookie deletion with Secure, Path=/, and an expired date', async () => {
    const { POST } = await import('../route');

    const res = await POST(buildRequest());
    const setCookieHeaders = res.headers.getSetCookie();
    const sessionCookieHeader = setCookieHeaders.find((h) => h.startsWith(`${SESSION_COOKIE_NAME}=`));

    expect(sessionCookieHeader).toBeDefined();
    // The exact property a browser enforces for a __Host--prefixed
    // Set-Cookie header: without this, the deletion is rejected outright
    // and the session survives.
    expect(sessionCookieHeader).toContain('Secure');
    expect(sessionCookieHeader).toContain('Path=/');
    expect(sessionCookieHeader).toContain('Expires=Thu, 01 Jan 1970');
  });

  it('redirects to /portal/login with a 303 (so the browser follow-up GETs, not re-POSTs)', async () => {
    const { POST } = await import('../route');

    const res = await POST(buildRequest());

    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toContain('/portal/login');
  });
});
