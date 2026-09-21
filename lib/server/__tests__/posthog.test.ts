import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  capture: vi.fn(),
  flush: vi.fn(),
  construct: vi.fn(),
}));

vi.mock('posthog-node', () => ({
  PostHog: vi.fn(function () {
    mocks.construct();
    return { capture: mocks.capture, flush: mocks.flush };
  }),
}));

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  vi.stubEnv('NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN', 'phc_test');
  vi.stubEnv('NEXT_PUBLIC_POSTHOG_HOST', 'https://us.i.posthog.com');
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('optional server analytics', () => {
  it.each(['NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN', 'NEXT_PUBLIC_POSTHOG_HOST'])(
    'does not interrupt a business action when %s is missing',
    async (variable) => {
      vi.stubEnv(variable, '');
      const { captureServerEvent } = await import('../posthog');
      await expect(captureServerEvent('google_sign_in_completed', 'member-123')).resolves.toBeUndefined();
      expect(mocks.construct).not.toHaveBeenCalled();
    },
  );

  it('does not propagate SDK initialization failures to authentication', async () => {
    mocks.construct.mockImplementation(() => { throw new Error('SDK unavailable'); });
    const { captureServerEvent } = await import('../posthog');
    await expect(captureServerEvent('google_sign_in_completed', 'member-123')).resolves.toBeUndefined();
  });

  it('does not propagate ingestion failures to authentication', async () => {
    mocks.flush.mockRejectedValue(new Error('PostHog unreachable'));
    const { captureServerEvent } = await import('../posthog');
    await expect(captureServerEvent('google_sign_in_completed', 'member-123')).resolves.toBeUndefined();
  });

  it('delivers configured events with the supplied stable identity', async () => {
    const { captureServerEvent } = await import('../posthog');
    await captureServerEvent('google_sign_in_completed', 'member-123');
    expect(mocks.capture).toHaveBeenCalledWith({
      event: 'google_sign_in_completed',
      distinctId: 'member-123',
    });
    expect(mocks.flush).toHaveBeenCalledOnce();
  });
});
