const BASE = process.env.TWENTY_BASE_URL ?? 'https://crm.fraterailabs.com';

export type TwentyRecord = { id: string; [key: string]: unknown };

const request = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
  const apiKey = process.env.TWENTY_API_KEY;
  if (!apiKey) throw new Error('TWENTY_API_KEY is not set');

  const response = await fetch(`${BASE}/rest${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`Twenty ${init.method ?? 'GET'} ${path} failed: ${response.status} ${await response.text()}`);
  }

  return (await response.json()) as T;
};

// Throws rather than defaulting to "not found". The filter grammar below is
// unverified against a live server: if this Twenty version rejects `limit`,
// uses a different operator syntax, or nests results differently, a silent
// `null` would make every lookup miss, every record be created afresh, and a
// second run duplicate the entire import — while reporting a clean run with
// zero failures. Failing loudly on the first lookup is strictly better.
const firstRecord = (payload: unknown, plural: string): TwentyRecord | null => {
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

  return records.length > 0 ? (records[0] as TwentyRecord) : null;
};

export const createTwentyClient = () => ({
  // Twenty's REST filter grammar varies by version (e.g. `field[eq]:value` vs
  // other operator syntaxes). Confirm the exact shape against the live server
  // before the first real run and adjust callers if it differs.
  findByFilter: async (plural: string, filter: string) =>
    firstRecord(await request(`/${plural}?filter=${encodeURIComponent(filter)}&limit=1`), plural),

  create: async (plural: string, body: unknown) =>
    request<{ data: Record<string, TwentyRecord> }>(`/${plural}`, {
      method: 'POST', body: JSON.stringify(body),
    }),

  update: async (plural: string, id: string, body: unknown) =>
    request<{ data: Record<string, TwentyRecord> }>(`/${plural}/${id}`, {
      method: 'PATCH', body: JSON.stringify(body),
    }),
});

export type TwentyClient = ReturnType<typeof createTwentyClient>;
