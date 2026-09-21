# Social link preview

The sharing card follows the approved September 2026 website: warm paper, academic blue engraving, compass-star wordmark, and the current hero headline.

- Delivered asset: `public/social/fraterai-preview-v2.jpg` (1200 × 630, optimized JPEG).
- Original generated master: `/Users/migueltwahirwa/.codex/generated_images/01a0c119-e7cd-7cd0-baec-154b6a1cffce/exec-eb1abe16-60da-4bde-850e-734af4220b02.png`.
- Method: built-in image generation, using the existing library engraving and approved brand board as references; Sharp resized and encoded the delivery image. No additional runtime dependency.
- Wiring: marketing layout exports matching Open Graph and Twitter large-image metadata, with absolute HTTPS URL, dimensions, MIME type, and alt text. Description matches the current hero.
- Removed the old file-based `opengraph-image.png`, which otherwise overrides configured Open Graph images in Next.js.
- Versioned URL gives the new artwork its own cache identity. Future replacements should use a new filename and update the layout.

## Verification and platform scope

Inspect rendered HTML with social crawler user agents and confirm one `og:image`, matching `twitter:image`, `summary_large_image`, correct dimensions and image content type, and no old positioning. Fetch the image without authentication and compare its bytes with the checked-in artifact after deployment.

Verified locally against the production build on 2026-09-21: metadata is present in the HTML head for Twitterbot, facebookexternalhit, LinkedInBot, WhatsApp, and Applebot user agents; a nested service page inherits the card; the image returns HTTP 200 with `image/jpeg` and matches the checked-in artifact byte-for-byte (183,569 bytes). Production build and targeted layout lint pass. These checks exercise the site's crawler responses, not the receiving apps' actual rendered previews.

The site supplies preview metadata; each receiving app decides whether to display it and how to crop it. Existing conversations and posts may retain cached previews. This does not attach an image to plain SMS or create an Instagram feed post. No messages or posts were sent as part of verification.

## Exact generation prompt

Create ONE finished social link preview card for FraterAI, landscape aspect ratio 1200:630 (1.905:1), ideally exactly 1200x630 pixels. Use case: ads-marketing. Reference image 1 is our existing blue engraved fictional university library illustration. Reference image 2 is our approved brand board, use ONLY its eight-separated-ray compass-star and precise FraterAI serif wordmark, NOT its layout, labels or navigation.

Design: premium understated editorial consultancy, warm near-white paper #faf9f6, Prussian academic blue #205577, dark ink #17212b. Flat full-bleed rectangular card, no rounded outer corners, no mockup, no phone, no shadows. Left 62 percent mostly clean paper, right 38 percent features the library engraving from image1, delicately fading into paper towards center so no lines behind headline. Architectural illustration cropped at right and bottom, recognizable rotunda; preserve refined fine engraving, no photorealism or modern office.

Composition on a 1200x630 design grid: ample 64px outer safe margin. At x64 y58 a blue compass-star plus FraterAI wordmark spanning about 330px wide, matching the reference logo. Main headline at x64 y230 in elegant readable large editorial serif, 60px equivalent, dark ink, exact 3 lines:
"Your next business"
"advantage,"
"built with AI."
Keep all text sharp and readable as a small shared-link preview. At x66 y510 one modest sans-serif line "AI & machine learning. Measurable progress." about 19px. At x66 y568 small domain "fraterailabs.com" about 17px in muted blue. No other text. Overall restrained, confident, spacious, polished, matches a high-end paper-and-blue engraved website. Do not include any wording from the old website or brand-board annotations.
