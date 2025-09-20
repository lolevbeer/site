import { NextResponse } from 'next/server';

export function GET() {
  const robotsTxt = `User-agent: *
Allow: /

# Specific pages
Allow: /beer
Allow: /events
Allow: /food
Allow: /api/data/*

# Disallow admin or sensitive areas (if any)
Disallow: /api/admin/
Disallow: /_next/
Disallow: /admin/

# Sitemap
Sitemap: https://next.lolev.beer/sitemap.xml

# Crawl delay (optional)
Crawl-delay: 1`;

  return new NextResponse(robotsTxt, {
    headers: {
      'Content-Type': 'text/plain',
      'Cache-Control': 'public, max-age=86400', // Cache for 1 day
    },
  });
}