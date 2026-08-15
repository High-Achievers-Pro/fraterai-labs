const BASE = process.env.TWENTY_BASE_URL ?? 'https://crm.fraterailabs.com';

export type TwentyRecord = { id: string; [key: string]: unknown };

// The live server rate-limits (observed: `429 Limit reached (100 tokens per
// 60000 ms)`, plus a shorter 100-per-1s bucket) and, at ~10 requests per
// imported row across company/person/prospect/outreaches, a 252-row run is
// ~2,500 requests — several times the per-minute quota. Retry-with-backoff is
// the fix, not a client-side throttle: backoff self-paces to whatever the
// server currently allows (default 100/min, or a temporarily raised limit for
// a bulk load) rather than capping throughput to a guess baked in at write
// time.
export type TwentyClientOptions = {
  // Total attempts per request, including the first. The 5th failure (not
  // the 6th) is what surfaces to the caller — a persistently failing request
  // must end up in the caller's failure accounting, not retry forever.
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  // Per-attempt request timeout. A hung socket must not stall a
  // multi-thousand-request run indefinitely; each attempt gets its own
  // budget and a fresh one on retry.
  timeoutMs?: number;
  // Injectable so tests never sleep for real. Defaults to a real setTimeout.
  sleep?: (ms: number) => Promise<void>;
};

const defaultSleep = (ms: number): Promise<void> => new Promise((resolve) => {
  setTimeout(resolve, ms);
});

// 429 (rate limit) and 5xx (server trouble, usually transient) are worth
// retrying. Any other 4xx — bad filter syntax, a field that doesn't exist,
// an invalid enum value — will fail exactly the same way on attempt 5 as on
// attempt 1; retrying it only delays the row landing in `result.failures`.
const isRetryableStatus = (status: number): boolean => status === 429 || status >= 500;

// `Retry-After` may be delta-seconds ("3") or an HTTP-date. When the server
// says how long to wait, that beats a guess — honour it over backoff.
const parseRetryAfterMs = (header: string | null): number | null => {
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const whenMs = Date.parse(header);
  if (!Number.isNaN(whenMs)) return Math.max(0, whenMs - Date.now());
  return null;
};

// Attempt 1 has no prior failure, so the first retry (before attempt 2) is
// the base delay; each subsequent retry doubles, capped at maxDelayMs.
const backoffDelayMs = (attempt: number, baseDelayMs: number, maxDelayMs: number): number =>
  Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs);

// Throws rather than defaulting to "not found" / "empty". The filter grammar
// below is unverified against a live server: if this Twenty version rejects
// `limit`, uses a different operator syntax, or nests results differently, a
// silent empty result would make every lookup miss, every record be created
// afresh, and a second run duplicate the entire import — while reporting a
// clean run with zero failures. Failing loudly on the first lookup is
// strictly better.
const recordsFor = (payload: unknown, plural: string): TwentyRecord[] => {
  const data = (payload as { data?: unknown } | null)?.data;
  const records = data && typeof data === 'object'
    ? (data as Record<string, unknown>)[plural]
    : undefined;

  if (!Array.isArray(records)) {
    const shape = data && typeof data === 'object'
      ? `data keys: ${Object.keys(data as object).join(', ') || 'none'}`
      : `data was ${data === undefined ? 'missing' : JSON.stringify(data)}`;
    throw new Error(
      `Twenty GET /${plural} returned an unexpected shape: expected data.${plural} to be an array (${shape}). `
      + 'The REST filter/response grammar does not match what this importer assumes.',
    );
  }

  return records as TwentyRecord[];
};

const firstRecord = (payload: unknown, plural: string): TwentyRecord | null => {
  const records = recordsFor(payload, plural);
  return records.length > 0 ? records[0] : null;
};

// A live suppression-list run crashed on `name[eq]:Harts Plumbers,
// Electricians & HVAC Technicians` — a 400 whose message ("'filter' invalid
// for ' Electricians & HVAC Technicians'") gave away the cause: Twenty's REST
// filter grammar treats `,` as the top-level AND separator, and does so even
// for a single bare clause, because `field[op]:value` is auto-wrapped as
// `and(field[op]:value)` before parsing
// (packages/twenty-server/.../parse-filter-rest-request.util.ts calls
// addDefaultConjunctionIfMissing unconditionally). So a value containing a
// literal comma always splits into a second, malformed clause — this was
// never specific to the suppression list, it just happened to be the first
// place a comma-bearing value reached the wire (six of fifty suppression
// names have one; zero of the 218 already-imported company names do).
//
// Twenty's own parser test suite
// (parse-filter.util.spec.ts, "should parse string filter test 4") asserts
// `fieldText[gt]:"val,ue"` parses to the value `val,ue` — wrapping in double
// quotes makes its top-level comma-splitter treat the whole thing as one
// token, and `formatFieldValue` strips exactly one layer of matching quotes
// off the result. Confirmed against the live server with read-only GETs: a
// quoted comma value against a deliberately non-existent company name
// returns 200 with zero matches (not a 400), and an unescaped ampersand
// against a real, already-imported company ("TRAX Analytics / Mind &
// Social") returns an exact match — `&` has no special meaning to this
// grammar and needs no handling.
//
// `[` and `]` are structurally different: the same top-level splitter uses
// them to toggle an "inside brackets" flag while deciding whether a comma is
// a real separator, with no documented or verified escape. Live probes with
// a bracketed value — quoted and unquoted, against a deliberately
// non-existent company — both returned 200 with zero matches, which is
// consistent with either a correct empty search or a silently corrupted one;
// there's no way to tell without risking a wrong match against a real
// record, and Twenty has zero real values in this dataset containing a
// bracket, so refusing costs nothing today. A literal `"` inside a
// comma-bearing value has the same problem in miniature: it would close our
// own wrapping quotes early. Both cases throw, naming the offending value,
// rather than silently sending something that might update the wrong
// record — a wrong match is worse than a refusal.
export const escapeFilterValue = (value: string): string => {
  if (/[[\]]/.test(value)) {
    throw new Error(
      'Cannot build a Twenty filter for a value containing "[" or "]" — no verified-safe '
      + `encoding exists for it: ${JSON.stringify(value)}`,
    );
  }

  if (!value.includes(',')) return value;

  if (value.includes('"')) {
    throw new Error(
      'Cannot build a Twenty filter for a value containing both "," and \'"\' — quoting the '
      + `value would end at the embedded quote and expose the comma unprotected: ${JSON.stringify(value)}`,
    );
  }

  return `"${value}"`;
};

export const createTwentyClient = (options: TwentyClientOptions = {}) => {
  const {
    maxAttempts = 5,
    baseDelayMs = 2000,
    maxDelayMs = 60000,
    timeoutMs = 30000,
    sleep = defaultSleep,
  } = options;

  const request = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
    const apiKey = process.env.TWENTY_API_KEY;
    if (!apiKey) throw new Error('TWENTY_API_KEY is not set');

    for (let attempt = 1; ; attempt += 1) {
      let response: Response;
      try {
        // eslint-disable-next-line no-await-in-loop -- sequential retries are the point
        response = await fetch(`${BASE}/rest${path}`, {
          ...init,
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            ...init.headers,
          },
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (error) {
        // Network error, DNS failure, or our own timeout abort — all
        // transient in the same sense a 5xx is. Same backoff, same cap.
        if (attempt >= maxAttempts) {
          throw new Error(
            `Twenty ${init.method ?? 'GET'} ${path} failed after ${attempt} attempts (network/timeout): `
            + `${error instanceof Error ? error.message : String(error)}`,
          );
        }
        // eslint-disable-next-line no-await-in-loop -- see above
        await sleep(backoffDelayMs(attempt, baseDelayMs, maxDelayMs));
        continue;
      }

      if (response.ok) return (await response.json()) as T;

      if (!isRetryableStatus(response.status) || attempt >= maxAttempts) {
        throw new Error(`Twenty ${init.method ?? 'GET'} ${path} failed: ${response.status} ${await response.text()}`);
      }

      const retryAfterMs = response.status === 429
        ? parseRetryAfterMs(response.headers.get('Retry-After'))
        : null;
      // eslint-disable-next-line no-await-in-loop -- see above
      await sleep(retryAfterMs ?? backoffDelayMs(attempt, baseDelayMs, maxDelayMs));
    }
  };

  return {
    // Twenty's REST filter grammar varies by version (e.g. `field[eq]:value`
    // vs other operator syntaxes). Confirm the exact shape against the live
    // server before the first real run and adjust callers if it differs.
    findByFilter: async (plural: string, filter: string) =>
      firstRecord(await request(`/${plural}?filter=${encodeURIComponent(filter)}&limit=1`), plural),

    // Unfiltered listing, used for small, whole-collection lookups (workspace
    // members) rather than the per-record identity checks findByFilter does.
    // `limit` default is generous for a handful of workspace members, not a
    // pagination strategy — callers with genuinely large collections need
    // more than this.
    list: async (plural: string, limit = 200): Promise<TwentyRecord[]> =>
      recordsFor(await request(`/${plural}?limit=${limit}`), plural),

    create: async (plural: string, body: unknown) =>
      request<{ data: Record<string, TwentyRecord> }>(`/${plural}`, {
        method: 'POST', body: JSON.stringify(body),
      }),

    update: async (plural: string, id: string, body: unknown) =>
      request<{ data: Record<string, TwentyRecord> }>(`/${plural}/${id}`, {
        method: 'PATCH', body: JSON.stringify(body),
      }),
  };
};

export type TwentyClient = ReturnType<typeof createTwentyClient>;
