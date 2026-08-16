// Field-name constants shared between app/api/leads/inbound/route.ts (server)
// and the public contact form (app/(marketing)/contact/page.tsx, a Client
// Component). Deliberately its own dependency-free module rather than
// living in the route file: the route transitively imports 'server-only'
// (via lib/server/leads.ts, hubspot-mirror.ts, and turnstile.ts), and
// Next.js refuses to bundle anything that imports 'server-only' into a
// Client Component — importing these two constants straight from the route
// file breaks `next build` with "'server-only' cannot be imported from a
// Client Component module". Keeping the constants here lets both the route
// and the client form import the same source of truth without dragging the
// server-only chain into the browser bundle.
//
// `HONEYPOT_FIELD_NAME` names a hidden input a genuine visitor never sees or
// fills; `PAGE_URI_FIELD_NAME` is optional — the route falls back to the
// `Referer` header when the client omits it.
export const HONEYPOT_FIELD_NAME = 'website';
export const PAGE_URI_FIELD_NAME = 'pageUri';
