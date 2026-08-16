import 'server-only';
import { optionalEnv } from './env';

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/**
 * Verifies a Cloudflare Turnstile client token against Cloudflare's
 * server-to-server siteverify endpoint. The widget's client-side token
 * alone proves nothing; a request that skips the browser can present any
 * string, so this is the entire control.
 *
 * Fails closed: a missing token, a missing secret, a network error, a
 * non-2xx response, malformed JSON, or `success: false` all resolve to
 * `false`. Never throws, and never resolves `true` without Cloudflare
 * having said `success: true`.
 *
 * A missing token or a missing `TURNSTILE_SECRET_KEY` short-circuits
 * before `fetch` is called at all, so this cannot be used to generate
 * outbound traffic on demand.
 */
export const verifyTurnstileToken = async (
  token: string | undefined,
  remoteIp?: string,
): Promise<boolean> => {
  if (!token) return false;

  const secret = optionalEnv('TURNSTILE_SECRET_KEY');
  if (!secret) return false;

  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set('remoteip', remoteIp);

  try {
    const response = await fetch(SITEVERIFY_URL, { method: 'POST', body });
    if (!response.ok) return false;

    const payload = (await response.json()) as { success?: boolean };
    return payload.success === true;
  } catch {
    return false;
  }
};
