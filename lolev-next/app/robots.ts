/**
 * Dynamic robots.txt generation for Next.js
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/metadata/robots
 */

import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = 'https://lolev.beer';

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/_next/',
          '/api/',
          '/test-error/',
        ],
      },
      // Specific crawl rate for search engines
      {
        userAgent: 'Googlebot',
        allow: '/',
        disallow: [
          '/_next/',
          '/api/',
          '/test-error/',
        ],
        crawlDelay: 1,
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
