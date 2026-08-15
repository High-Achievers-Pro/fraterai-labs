import 'server-only';
import { requireEnv } from './env';

export class TwentyError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = 'TwentyError';
  }
}

const baseUrl = () => requireEnv('TWENTY_BASE_URL').replace(/\/$/, '');

const authHeaders = () => ({
  Authorization: `Bearer ${requireEnv('TWENTY_API_KEY')}`,
  'Content-Type': 'application/json',
});

export const twentyGraphQL = async <T>(
  query: string,
  variables: Record<string, unknown> = {},
): Promise<T> => {
  const response = await fetch(`${baseUrl()}/graphql`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ query, variables }),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new TwentyError(`Twenty GraphQL request failed with ${response.status}`, response.status);
  }

  const payload = (await response.json()) as { data?: T; errors?: { message: string }[] };

  if (payload.errors?.length) {
    throw new TwentyError(payload.errors.map((e) => e.message).join('; '));
  }
  if (!payload.data) throw new TwentyError('Twenty returned no data');

  return payload.data;
};

export const twentyRest = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
  const response = await fetch(`${baseUrl()}/rest${path}`, {
    ...init,
    headers: { ...authHeaders(), ...init.headers },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new TwentyError(`Twenty REST ${init.method ?? 'GET'} ${path} failed with ${response.status}`, response.status);
  }

  return (await response.json()) as T;
};
