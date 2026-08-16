import { after, NextResponse, type NextRequest } from 'next/server';
import { captureInboundLead, type InboundLead } from '@/lib/server/leads';
import { mirrorToHubSpot } from '@/lib/server/hubspot-mirror';
import { verifyTurnstileToken } from '@/lib/server/turnstile';
// Relative, not '@/', import: vitest.config.ts has no '@/' alias configured
// (only 'server-only' is stubbed there) — the other '@/lib/server/*'
// imports above only resolve under test because every test that loads this
// route mocks them by literal specifier via vi.mock, so real resolution is
// never attempted. This constant has no mock, so it must resolve for real,
// which the alias cannot do without editing vitest.config.ts (out of
// scope for this task).
import {
  HONEYPOT_FIELD_NAME,
  PAGE_URI_FIELD_NAME,
  TURNSTILE_TOKEN_FIELD_NAME,
} from '../../../../lib/lead-form-fields';

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_MESSAGE_LENGTH = 5000;

// Re-exported so Task 9 (the public contact form) can still import these
// field names from one obvious place. They are defined in
// lib/lead-form-fields.ts, not here, because that module is dependency-free
// while this route transitively imports 'server-only' — importing straight
// from this file would break `next build` for the Client Component form
// (see lib/lead-form-fields.ts for the full explanation). Import them
// rather than re-typing the strings — a typo or drift between the two would
// either break the honeypot silently (a bot filling the real field name
// would sail through) or lose the page context HubSpot's mirror wants.
export { HONEYPOT_FIELD_NAME, PAGE_URI_FIELD_NAME, TURNSTILE_TOKEN_FIELD_NAME };

// request.json() has no compile-time guarantee about shape — it's parsed
// from an untrusted request body — so each field is checked to actually be
// a string before use rather than trusted from a destructure. Same house
// pattern as app/api/auth/magic-link/request/route.ts.
const readStringField = (body: unknown, key: string): string | undefined => {
  if (typeof body !== 'object' || body === null) return undefined;
  const value = (body as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : undefined;
};

const badRequest = (message: string) => NextResponse.json({ error: message }, { status: 400 });

// Both the honeypot path and a genuine success return this exact response —
// same status, same body — so nothing here tells a bot it was caught rather
// than merely slow, offline, or blocked by something else entirely.
const okResponse = () => NextResponse.json({ ok: true }, { status: 200 });

export const POST = async (request: NextRequest) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid request body.');
  }

  // Verify Turnstile before any work that costs something: before the
  // honeypot check, before the field validation, before the Twenty lookups
  // and creates, and certainly before the HubSpot mirror. Mirrors the
  // ordering in app/api/auth/magic-link/request/route.ts.
  const turnstileToken = readStringField(body, TURNSTILE_TOKEN_FIELD_NAME);
  const remoteIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const turnstileOk = await verifyTurnstileToken(turnstileToken, remoteIp);
  if (!turnstileOk) return badRequest('Verification failed.');

  // Honeypot: a hidden form field a genuine visitor never sees or fills in,
  // wired up by the client the same way the magic-link and turnstile fields
  // are. Any non-empty value here means an automated submission — return
  // the identical success response and do no work, rather than a distinct
  // status/body that would tell the bot it was caught (and invite it to
  // adapt).
  const honeypot = readStringField(body, HONEYPOT_FIELD_NAME);
  if (honeypot) return okResponse();

  const name = readStringField(body, 'name')?.trim();
  const email = readStringField(body, 'email')?.trim();
  // Company is optional on the public form — task 9 restored this; the
  // pre-existing HubSpot form never required it either, and the brief
  // says this task changes only where the data goes, not what the form
  // demands of a visitor. Defaulted to '' (never undefined) so downstream
  // code always has a string to work with.
  const rawCompany = readStringField(body, 'company')?.trim() ?? '';
  const message = readStringField(body, 'message');

  if (!name || !email || !message) {
    return badRequest('All fields are required.');
  }
  if (!EMAIL_SHAPE.test(email)) {
    return badRequest('Invalid email address.');
  }
  if (message.length >= MAX_MESSAGE_LENGTH) {
    return badRequest('Message is too long.');
  }

  // captureInboundLead's findOrCreateCompany (lib/server/leads.ts) still
  // needs *some* name for a first-time domain: passing through '' would
  // create a genuinely nameless Company record in Twenty, which shows
  // blank in every list, search, and report in the CRM — bad data that
  // outlives this one submission. Fall back to the verified email's
  // domain, which is already the identity key findOrCreateCompany uses to
  // de-duplicate by domain (see domainFromEmail there), so this is a
  // legible placeholder ("acme.com"), not blank. EMAIL_SHAPE already
  // guarantees an '@' followed by a non-empty domain at this point, so the
  // split is safe without an extra fallback.
  //
  // Known limitation, not fixed here: findOrCreateCompany's lookup-then-
  // create never updates an existing record's name, so if this domain's
  // first-ever submission has no company name, the domain-derived
  // placeholder sticks even after a later submission from the same domain
  // supplies a real one. Pre-existing behavior of that lookup — out of
  // scope for this task, which only decides what to pass in.
  const company = rawCompany || email.split('@')[1].toLowerCase();

  const lead: InboundLead = { name, email, company, message };
  const pageUri = readStringField(body, PAGE_URI_FIELD_NAME) ?? request.headers.get('referer') ?? '';

  try {
    await captureInboundLead(lead);
  } catch (error) {
    // Never echo internal detail (a TwentyError message, a stack, a field
    // name from the CRM) back to an anonymous caller — log it server-side
    // for whoever watches the logs, return a fixed generic message.
    console.error('[leads] failed to capture inbound lead', error);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again later.' },
      { status: 500 },
    );
  }

  // Twenty is authoritative and already has the record at this point — the
  // capture above was awaited and succeeded before this line runs, so a
  // HubSpot outage (or a bug inside the mirror itself) cannot cost a lead.
  // after() — not a bare un-awaited call as the brief's prose put it — is
  // required on a serverless platform: any promise still pending when the
  // response is returned is killed, so a fire-and-forget call here would
  // silently never complete. Same fix as deliverMagicLinkIfEligible in
  // app/api/auth/magic-link/request/route.ts (see task-5b-report.md).
  //
  // mirrorToHubSpot already swallows every failure inside its own try/catch
  // by design. This wrapper exists only to catch a *different* class of bug
  // — a synchronous throw before that try/catch is entered — so it can never
  // surface as an unhandled rejection. Either way the lead itself is safe:
  // it was already written to Twenty above.
  after(async () => {
    try {
      await mirrorToHubSpot(lead, pageUri);
    } catch (error) {
      console.error('[leads] HubSpot mirror threw despite being designed not to (non-fatal)', error);
    }
  });

  return okResponse();
};
