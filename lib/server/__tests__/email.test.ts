import { beforeEach, describe, expect, it, vi } from 'vitest';

type MailOptions = { from: string; to: string; subject: string; text: string };
type TransportOptions = {
  host: string;
  port: number;
  secure: boolean;
  auth: { user: string; pass: string };
};

const sendMail = vi.fn(async (_options: MailOptions) => ({ messageId: 'test' }));
const createTransport = vi.fn((_options: TransportOptions) => ({ sendMail }));

vi.mock('nodemailer', () => ({
  default: { createTransport },
}));

const ENV_KEYS = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_APP_PASSWORD', 'PORTAL_EMAIL_FROM'] as const;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SMTP_HOST = 'smtp.gmail.com';
  process.env.SMTP_PORT = '587';
  process.env.SMTP_USER = 'portal@fraterailabs.com';
  process.env.SMTP_APP_PASSWORD = 'test-app-password';
  process.env.PORTAL_EMAIL_FROM = 'portal@fraterailabs.com';
});

describe('sendMagicLinkEmail', () => {
  it('builds the transport from env and sends a single mail', async () => {
    const { sendMagicLinkEmail } = await import('../email');
    await sendMagicLinkEmail('contractor@partner.test', 'https://example.test/api/auth/magic-link/verify?token=abc');

    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'smtp.gmail.com',
        port: 587,
        auth: { user: 'portal@fraterailabs.com', pass: 'test-app-password' },
      }),
    );
    expect(sendMail).toHaveBeenCalledTimes(1);
  });

  it('addresses and sends to the requested recipient', async () => {
    const { sendMagicLinkEmail } = await import('../email');
    await sendMagicLinkEmail('contractor@partner.test', 'https://example.test/verify?token=abc');

    const call = sendMail.mock.calls.at(0)?.[0];
    expect(call?.to).toBe('contractor@partner.test');
    expect(call?.from).toBe('portal@fraterailabs.com');
  });

  it('states the 10-minute expiry and includes the link and an ignore-if-unrequested line', async () => {
    const { sendMagicLinkEmail } = await import('../email');
    await sendMagicLinkEmail('contractor@partner.test', 'https://example.test/verify?token=abc');

    const call = sendMail.mock.calls.at(0)?.[0];
    expect(call?.text).toContain('https://example.test/verify?token=abc');
    expect(call?.text).toMatch(/10.minute/i);
    expect(call?.text).toMatch(/ignore/i);
  });

  it('marks the transport secure only on port 465', async () => {
    process.env.SMTP_PORT = '465';
    const { sendMagicLinkEmail } = await import('../email');
    await sendMagicLinkEmail('contractor@partner.test', 'https://example.test/verify?token=abc');

    expect(createTransport).toHaveBeenCalledWith(expect.objectContaining({ secure: true }));
  });

  it.each(ENV_KEYS)('throws a clear error rather than a silent no-op when %s is missing', async (key) => {
    delete process.env[key];
    const { sendMagicLinkEmail } = await import('../email');

    await expect(sendMagicLinkEmail('contractor@partner.test', 'https://example.test/verify?token=abc'))
      .rejects.toThrow(`Missing required environment variable: ${key}`);
    expect(sendMail).not.toHaveBeenCalled();
  });
});
