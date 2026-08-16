import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  // No `sitemap` key: this branch introduced robots.txt, and with it a
  // dangling reference to a sitemap.xml that has never existed anywhere in
  // this tree (no app/sitemap.ts, no static file). See final-review.md M1
  // — removing the reference rather than generating a sitemap, per the
  // review's own "removing is fine" call.
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/portal', '/api'] }],
  };
}
