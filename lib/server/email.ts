import 'server-only';
import nodemailer from 'nodemailer';
import { requireEnv } from './env';

// Google Workspace SMTP with an app password (chosen over a transactional-
// email API — see task-5b-report.md for the trade-off). requireEnv() means a
// missing host/port/user/app-password throws a clear "Missing required
// environment variable" error rather than nodemailer failing silently or
// sendMail() swallowing the problem.
const buildTransport = () => {
  const port = Number(requireEnv('SMTP_PORT'));
  return nodemailer.createTransport({
    host: requireEnv('SMTP_HOST'),
    port,
    // 465 is implicit TLS; every other port (587, 25) starts in plaintext and
    // upgrades via STARTTLS, which nodemailer does automatically when
    // `secure` is false.
    secure: port === 465,
    auth: {
      user: requireEnv('SMTP_USER'),
      pass: requireEnv('SMTP_APP_PASSWORD'),
    },
  });
};

export const sendMagicLinkEmail = async (email: string, url: string): Promise<void> => {
  const transport = buildTransport();

  await transport.sendMail({
    from: requireEnv('PORTAL_EMAIL_FROM'),
    to: email,
    subject: 'Your Frater Portal sign-in link',
    text: [
      'Use this link to sign in to the Frater Portal:',
      '',
      url,
      '',
      'This link expires in 10 minutes.',
      '',
      'If you did not request this email, you can safely ignore it.',
    ].join('\n'),
  });
};
