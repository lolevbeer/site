/**
 * /sitemap.xml as a plain route handler. A `sitemap.ts` metadata route looked
 * equivalent, but on Vercel it behaved like a static file (etag, last-modified,
 * HIT for days), so crawlers kept getting past events that 404. An ISR route
 * handler froze the same way, so this one renders on request behind the CDN;
 * see lib/seo/crawler-route.ts.
 */
import { NextResponse } from 'next/server'
import type { MetadataRoute } from 'next'
import { getSitemapEntries } from '@/lib/seo/sitemap-entries'
import { escapeXml } from '@/lib/utils/escape-xml'
import { CRAWLER_ROUTE_CACHE_CONTROL } from '@/lib/seo/crawler-route'

export const dynamic = 'force-dynamic'

function urlElement({
  url,
  lastModified,
  changeFrequency,
  priority,
}: MetadataRoute.Sitemap[number]): string {
  const lines = [`<loc>${escapeXml(url)}</loc>`]
  if (lastModified) lines.push(`<lastmod>${new Date(lastModified).toISOString()}</lastmod>`)
  if (changeFrequency) lines.push(`<changefreq>${changeFrequency}</changefreq>`)
  if (priority !== undefined) lines.push(`<priority>${priority}</priority>`)
  return `<url>\n${lines.join('\n')}\n</url>`
}

export async function GET() {
  const entries = await getSitemapEntries()
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.map(urlElement).join('\n')}
</urlset>
`
  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': CRAWLER_ROUTE_CACHE_CONTROL,
    },
  })
}
