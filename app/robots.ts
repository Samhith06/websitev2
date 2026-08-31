import type { MetadataRoute } from 'next';

/**
 * Indexing is off until the legal review lands and the geo-block list exists —
 * the same switch that drives the `noindex` meta tag in the root layout, kept
 * in step so the two can never say different things to a crawler.
 */
export default function robots(): MetadataRoute.Robots {
  const allowed = process.env.ALLOW_INDEXING === 'true';

  return {
    rules: allowed
      ? {
          userAgent: '*',
          allow: '/',
          // Never worth crawling: one is private, the others are per-account.
          disallow: ['/admin', '/admin/', '/api/', '/me'],
        }
      : { userAgent: '*', disallow: '/' },
    sitemap: allowed ? 'https://mattyspins.com/sitemap.xml' : undefined,
  };
}
