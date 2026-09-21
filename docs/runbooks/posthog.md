# PostHog analytics

Installed September 21, 2026 with `npx -y @posthog/wizard@latest` (wizard 2.76.0), followed by a local review and regression fix.

## Project and reports

- [Analytics basics dashboard](https://us.posthog.com/project/620110/dashboard/2117892)
- [Installer setup report](https://us.posthog.com/project/620110/notebooks/6Hg0VE1X)
- [Hero messaging library and future experiment plan](../design/hero-messaging-experiments.md)
- [Official Next.js integration guide](https://posthog.com/docs/libraries/next-js)

The dashboard contains lead/meeting counts, sign-in counts by method, sign-out counts, and starter funnels. The installer report describes its initial output; the verification and hardening notes below reflect the final local changes.

## Configuration and deployment

`posthog-js` initializes in `instrumentation-client.ts`. Server events use `posthog-node` through `lib/server/posthog.ts`. Both read:

```dotenv
NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN=
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

Both values are configured in the local, git-ignored `.env.local`. The token is the browser-safe project token, not a personal API key. `.env.example` documents these names without a real token.

Before deploying, add the same project configuration to the appropriate Vercel environment and rebuild. Next.js includes `NEXT_PUBLIC_` values in the browser bundle at build time. This setup did not change Vercel settings or deploy the site.

Missing configuration disables analytics without interrupting the site. Initialization and ingestion failures are caught. Server ingestion is limited to a 1.5-second request timeout with no retry, since the installer added awaited captures inside authentication and webhook handlers.

## Events and interpretation

| Event | Trigger | Attribution / limitation |
| --- | --- | --- |
| `$pageview` and automatic browser events | Page visits and supported interactions | Anonymous browser identity until a portal member is identified. Filter out localhost/internal traffic when analyzing production results. |
| `contact_form_submitted` | Contact endpoint returns a successful HTTP response | Uses browser identity. The endpoint deliberately returns the same success to honeypot submissions, so this is an accepted-response metric, not guaranteed qualified leads. No submitted contact fields are added to the event. |
| `magic_link_requested` | Verified form is submitted, before the request completes | Measures an attempt, not proof an email was delivered. No entered email is attached. |
| `portal_signed_out` | Sign-out button is clicked; browser identity then resets | Measures the click, not proof the logout request completed. |
| `magic_link_sign_in_completed` | Successful magic-link verification creates a session | Uses verified workspace-member ID. |
| `google_sign_in_completed` | Successful Google callback creates a session | Uses verified workspace-member ID. |
| `calendly_meeting_booked` | Calendly webhook receives `invitee.created` | Personless server event; no shared browser identity or webhook contact details are sent. Existing webhook verification/configuration still applies. |

Authenticated portal visits identify with the server-verified workspace-member ID and attach the session's name and email as person properties. No contact-form message or booking payload is included in custom events. Browser exceptions are captured through SDK configuration and `app/global-error.tsx`.

The starter contact-to-meeting funnel cannot currently establish a same-person conversion: contact events use a browser ID and booking events are personless. Treat booking counts as aggregate only until attribution is implemented. Likewise, the magic-link request funnel needs an anonymous-to-member identity bridge to attribute separate-device link redemption reliably.

## Future headline experiments

No headline experiment or feature flag is active. All visitors see the selected headline in `app/(marketing)/page.tsx`. The five candidates are saved in the messaging document.

Before launching an experiment, implement stable variant assignment and exposure tracking, choose the conversion definition, and exclude internal traffic. `contact_form_submitted` is an available starting metric with the limitation noted above. Do not use the booking funnel to declare a winning headline until booking attribution is connected.

## Verification on September 21, 2026

- Desktop and 390px mobile previews render the exact selected copy without horizontal overflow.
- PostHog's installation screen reports **Installation complete** and shows an ingested **Pageview** from the running local site.
- `npm run build` passes and generates 37 static pages.
- `npm test` passes: 337 tests across 38 files.
- Regression coverage verifies missing PostHog configuration, SDK initialization failures, and ingestion failures cannot fail business actions. The existing magic-link sign-in test was observed failing before the fix and passing after it.
- Scoped lint reports two pre-existing `no-explicit-any` errors in `app/api/webhooks/calendly/route.ts`; the newly added analytics files pass.
- The six business events, authenticated identity continuity, and error ingestion were not exercised live. Doing so would require real contact submissions, sign-ins, bookings, or deliberate errors. Unit tests and the successful pageview verify only their respective boundaries.

No HubSpot data warehouse import was configured.
