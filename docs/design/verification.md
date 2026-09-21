# Redesign verification

Verified locally on 10 September 2026. Public marketing routes use their own stylesheet; portal styling, authentication, lead endpoint and webhook implementations were not changed.

- `npm run build`: passed, including Next.js TypeScript checking and generation of 37 static pages.
- `npm test`: 37 test files, 332 tests passed after implementation.
- Targeted ESLint: passed for marketing routes, marketing/global components, and CalendlyInline.
- Impeccable detector: ran once on changed UI targets; returned no findings.
- Chrome: desktop landing page at 1280 and 1440 CSS pixels, mobile landing page and service/contact routes at 390 CSS pixels. No document overflow in the checked states.
- Model: pointer selection updates descriptive workflow; ArrowRight moves selection and focus; dropdown opens and Escape closes it.
- Mobile navigation: expanded menu and nested service list fit the viewport, lock background scrolling, and close on service navigation.
- Process: selecting Measure updates the outcome detail; mobile rail scrolls to the selected stage.
- Contact: empty submission focuses the required name field. Field names and existing API integration are preserved. Booking tab renders the existing Calendly URL with the new blue theme and a direct fallback link.
- Reduced-motion behavior is implemented in CSS and component logic. It was inspected in source; a system-preference toggle was not simulated in this browser session.
- No real lead submission or booking was sent during QA. External scheduling availability was not certified. The local production server reports missing TURNSTILE_SECRET_KEY and NEXT_PUBLIC_TURNSTILE_SITE_KEY. Contact submissions fail closed until those existing integration keys are configured; the redesign does not bypass spam protection.

Screenshots: `.impeccable/review/desktop.png`, `desktop-hero.png`, and `mobile.png`. All landing illustrations were confirmed loaded before final captures. Temporary browser viewport overrides were reset after review. A production preview runs at http://localhost:3001.

## Existing content limitations

The existing footer points to `/privacy` and `/terms`, but this repository contains no legal pages. Those links remain preserved. Approved legal content is needed before public launch. The existing resources were placeholder article links; the redesign labels these articles as in preparation and links to related, available capabilities. Reference portraits are illustrative role imagery, not customer endorsements. Reference performance metrics and testimonials are not presented as verified claims.

Standalone `tsc --noEmit` originally identified existing test typing issues (readonly NODE_ENV assignments and an internal path-to-regexp declaration). The production Next.js build's TypeScript check passes; those unrelated tests were not edited.
