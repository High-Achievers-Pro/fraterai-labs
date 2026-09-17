import { describe, expect, it } from 'vitest';
import robots from '../robots';

// M1: robots.ts previously advertised a sitemap.xml that has never existed
// anywhere in this tree. Pins that the dangling reference stays removed.
describe('robots', () => {
  it('disallows /portal and /api, and does not advertise a sitemap', () => {
    const result = robots();

    expect(result.rules).toEqual([{ userAgent: '*', allow: '/', disallow: ['/portal', '/api'] }]);
    expect(result.sitemap).toBeUndefined();
  });
});
