import 'server-only';

import { PostHog } from 'posthog-node';

let posthogClient: PostHog | undefined;

const getPostHogClient = (): PostHog | undefined => {
  if (posthogClient) return posthogClient;

  const projectToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;

  if (!projectToken || !host) return undefined;

  posthogClient = new PostHog(projectToken, {
    host,
    enableExceptionAutocapture: true,
    flushAt: 1,
    flushInterval: 0,
    // These events run in request handlers; keep ingestion outages bounded.
    requestTimeout: 1500,
    fetchRetryCount: 0,
  });

  return posthogClient;
};

export const captureServerEvent = async (event: string, distinctId?: string): Promise<void> => {
  try {
    const posthog = getPostHogClient();
    if (!posthog) return;

    posthog.capture({ event, distinctId });
    await posthog.flush();
  } catch (error) {
    console.error('[posthog] failed to capture server event', error);
  }
};
