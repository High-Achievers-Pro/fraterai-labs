import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { captureServerEvent } from '@/lib/server/posthog';

/**
 * Calendly Webhook Handler API Route
 * Handles invitee.created and invitee.canceled webhook notifications
 * and syncs lead/booking activity to HubSpot CRM.
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signatureHeader = req.headers.get('calendly-webhook-signature');
    const signingKey = process.env.CALENDLY_WEBHOOK_SIGNING_KEY;

    // Verify webhook signature if signing key is configured
    if (signingKey && signatureHeader) {
      const parts = signatureHeader.split(',');
      const tPart = parts.find((p) => p.startsWith('t='));
      const v1Part = parts.find((p) => p.startsWith('v1='));

      if (tPart && v1Part) {
        const timestamp = tPart.substring(2);
        const signature = v1Part.substring(3);
        const payloadToSign = `${timestamp}.${rawBody}`;

        const expectedSignature = crypto
          .createHmac('sha256', signingKey)
          .update(payloadToSign)
          .digest('hex');

        if (crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
          console.log('[Calendly Webhook] Verified signature successfully.');
        } else {
          console.warn('[Calendly Webhook] Invalid webhook signature detected.');
          return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
        }
      }
    }

    const eventData = JSON.parse(rawBody);
    const eventType = eventData.event; // e.g. 'invitee.created' or 'invitee.canceled'
    const payload = eventData.payload;

    console.log(`[Calendly Webhook Received] Event: ${eventType}`, payload?.email || payload?.name);

    if (eventType === 'invitee.created') {
      await captureServerEvent('calendly_meeting_booked');

      const inviteeName = payload.name || '';
      const inviteeEmail = payload.email || '';
      const questionsAndAnswers = payload.questions_and_answers || [];

      // Extract Company if available in Q&A
      const companyAnswer = questionsAndAnswers.find(
        (qa: any) => qa.question?.toLowerCase().includes('company') || qa.question?.toLowerCase().includes('organization')
      );
      const company = companyAnswer ? companyAnswer.answer : '';

      const nameParts = inviteeName.trim().split(' ');
      const firstname = nameParts[0] || '';
      const lastname = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

      // Sync to HubSpot Form API
      const hubspotPortalId = process.env.HUBSPOT_PORTAL_ID || '245673738';
      const hubspotFormGuid = process.env.HUBSPOT_CALENDLY_FORM_GUID || '7aaf12d7-5cc8-43a9-91ce-2fcb0961ab4c';

      const hubspotPayload = {
        fields: [
          { name: 'email', value: inviteeEmail },
          { name: 'firstname', value: firstname },
          { name: 'lastname', value: lastname },
          { name: 'company', value: company },
          { name: 'message', value: `[Calendly Scheduled] Event: ${payload.event_type_name || 'Meeting'}, Time: ${payload.start_time}` },
        ],
        context: {
          pageUri: 'https://www.fraterailabs.com/contact',
          pageName: 'Calendly Scheduled Meeting',
        },
      };

      try {
        const hsRes = await fetch(
          `https://api.hsforms.com/submissions/v3/integration/submit/${hubspotPortalId}/${hubspotFormGuid}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(hubspotPayload),
          }
        );
        if (hsRes.ok) {
          console.log('[HubSpot Sync] Successfully synced Calendly booking to HubSpot.');
        } else {
          console.warn('[HubSpot Sync] HubSpot returned status:', hsRes.status);
        }
      } catch (hsErr) {
        console.error('[HubSpot Sync Error]', hsErr);
      }
    }

    return NextResponse.json({ success: true, event: eventType });
  } catch (error: any) {
    console.error('[Calendly Webhook Exception]', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
