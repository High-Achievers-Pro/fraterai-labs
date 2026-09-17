import { after, NextResponse, type NextRequest } from 'next/server';
import { optionalEnv } from '@/lib/server/env';
import {
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  verifyWebhookSignature,
} from '@/lib/server/webhook-verify';

// In-process dedup only. A Node process handling this route can see the
// same event id twice within its own lifetime (Twenty retries a delivery
// it didn't get a fast-enough 2xx for) and this Set catches that case. It
// does NOT protect against duplicate delivery across separate serverless
// instances or across a cold start — this state is not shared and does not
// survive either. See task-10-report.md for the full statement of what
// this does and does not guarantee.
//
// Bounded so a long-lived process cannot leak memory from an ever-growing
// set of ids: once the cap is reached, the oldest entry is evicted (a Set
// iterates in insertion order in JS, so `.values().next()` is the oldest).
const MAX_SEEN_EVENT_IDS = 500;
const seenEventIds = new Set<string>();

// Returns true if `eventId` was already seen (i.e. this delivery is a
// duplicate). Otherwise records it and returns false.
const isDuplicateEvent = (eventId: string): boolean => {
  if (seenEventIds.has(eventId)) return true;
  seenEventIds.add(eventId);
  if (seenEventIds.size > MAX_SEEN_EVENT_IDS) {
    const oldest = seenEventIds.values().next().value;
    if (oldest !== undefined) seenEventIds.delete(oldest);
  }
  return false;
};

// ASSUMED AND UNVERIFIED, for the same reason as lib/server/webhook-verify.ts:
// the exact field carrying Twenty's event id is unknown because a real
// payload could not be captured (see task-10-report.md). Checked in order
// of how likely each name is on a webhook-style payload. If none matches,
// the event is still processed — under-deduplicating (one possible extra
// Slack post on a retried delivery) is preferable to dropping a real event
// because of a guessed field name — but a line is logged so the gap stays
// visible until the real field name is confirmed.
const extractEventId = (event: unknown): string | undefined => {
  if (typeof event !== 'object' || event === null || Array.isArray(event)) return undefined;
  const record = event as Record<string, unknown>;
  for (const key of ['id', 'eventId', 'event_id']) {
    const value = record[key];
    if (typeof value === 'string' && value) return value;
  }
  return undefined;
};

const extractEventName = (event: unknown): string => {
  if (typeof event !== 'object' || event === null || Array.isArray(event)) return 'unknown event';
  const value = (event as Record<string, unknown>).eventName;
  return typeof value === 'string' && value ? value : 'unknown event';
};

const okResponse = () => NextResponse.json({ ok: true }, { status: 200 });

// Never throws: the caller (after(), below) has nothing to react to a
// rejection with, and this must not become an unhandled-rejection crash.
const postToSlackIfConfigured = async (event: unknown, eventId: string | undefined): Promise<void> => {
  const webhookUrl = optionalEnv('SLACK_WEBHOOK_URL');
  if (!webhookUrl) return;

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `Twenty webhook received: ${extractEventName(event)}${eventId ? ` (${eventId})` : ''}`,
      }),
    });
  } catch (error) {
    console.error('[webhooks/twenty] Slack post failed (non-fatal)', error);
  }
};

export const POST = async (request: NextRequest) => {
  // Raw body text, read before any JSON parsing. Parsing and
  // re-serialising would change the exact bytes the signature covers, so
  // the signature would no longer match even for a genuine, untampered
  // request from Twenty.
  const rawBody = await request.text();
  const signature = request.headers.get(SIGNATURE_HEADER) ?? undefined;
  const timestamp = request.headers.get(TIMESTAMP_HEADER) ?? undefined;

  if (!verifyWebhookSignature(rawBody, signature, timestamp)) {
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 401 });
  }

  // Everything below this line runs only after verification has already
  // succeeded — Twenty has proven it sent this request. From here on, no
  // path may return anything other than 200: a non-2xx status for a
  // request Twenty already delivered successfully puts it into a retry
  // storm for an event we already have. Any failure is logged, not
  // surfaced as an error status.
  try {
    let event: unknown;
    try {
      event = JSON.parse(rawBody);
    } catch (error) {
      console.error('[webhooks/twenty] verified payload was not valid JSON', error);
      return okResponse();
    }

    const eventId = extractEventId(event);
    if (eventId === undefined) {
      console.error('[webhooks/twenty] could not find an event id on the payload; skipping dedup for this delivery');
    } else if (isDuplicateEvent(eventId)) {
      return okResponse();
    }

    after(() => postToSlackIfConfigured(event, eventId));

    return okResponse();
  } catch (error) {
    console.error('[webhooks/twenty] unexpected error processing verified webhook', error);
    return okResponse();
  }
};
