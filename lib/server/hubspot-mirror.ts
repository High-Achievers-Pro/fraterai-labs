import 'server-only';
import { optionalEnv } from './env';
import type { InboundLead } from './leads';

export const mirrorToHubSpot = async (lead: InboundLead, pageUri: string): Promise<void> => {
  const portalId = optionalEnv('HUBSPOT_PORTAL_ID');
  const formGuid = optionalEnv('HUBSPOT_FORM_GUID');
  if (!portalId || !formGuid) return;

  const [firstname, ...rest] = lead.name.trim().split(/\s+/);

  try {
    await fetch(`https://api.hsforms.com/submissions/v3/integration/submit/${portalId}/${formGuid}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: [
          { name: 'email', value: lead.email },
          { name: 'firstname', value: firstname ?? '' },
          { name: 'lastname', value: rest.join(' ') },
          { name: 'company', value: lead.company },
          { name: 'message', value: lead.message },
        ],
        context: { pageUri, pageName: 'Contact' },
      }),
    });
  } catch (error) {
    console.error('HubSpot mirror failed (non-fatal)', error);
  }
};
