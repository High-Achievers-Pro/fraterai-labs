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

const firstRecord = (payload: unknown, plural: string): TwentyRecord | null => {
  const data = (payload as { data?: Record<string, TwentyRecord[]> }).data;
  const records = data?.[plural] ?? [];
  return records.length > 0 ? records[0] : null;
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
