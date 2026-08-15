import 'server-only';
import { OAuth2Client } from 'google-auth-library';
import { requireEnv } from './env';

export type GoogleIdentity = {
  email: string;
  name: string;
  hostedDomain: string | undefined;
  emailVerified: boolean;
};

const client = () =>
  new OAuth2Client(
    requireEnv('GOOGLE_CLIENT_ID'),
    requireEnv('GOOGLE_CLIENT_SECRET'),
    requireEnv('GOOGLE_REDIRECT_URI'),
  );

export const buildAuthUrl = (state: string): string =>
  client().generateAuthUrl({
    scope: ['openid', 'email', 'profile'],
    state,
    prompt: 'select_account',
    hd: requireEnv('ALLOWED_GOOGLE_DOMAIN'),
  });

export const exchangeCodeForIdToken = async (code: string): Promise<string> => {
  const { tokens } = await client().getToken(code);
  if (!tokens.id_token) throw new Error('Google did not return an id_token');
  return tokens.id_token;
};

export const verifyIdToken = async (idToken: string): Promise<GoogleIdentity> => {
  const ticket = await client().verifyIdToken({
    idToken,
    audience: requireEnv('GOOGLE_CLIENT_ID'),
  });

  const payload = ticket.getPayload();
  if (!payload?.email) throw new Error('Google token has no email');

  return {
    email: payload.email.toLowerCase(),
    name: payload.name ?? payload.email,
    hostedDomain: payload.hd,
    emailVerified: payload.email_verified === true,
  };
};
