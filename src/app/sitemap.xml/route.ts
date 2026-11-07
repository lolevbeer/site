/**
 * /sitemap.xml as a plain route handler, the same shape as feed.xml. A
 * `sitemap.ts` metadata route looks equivalent, but on Vercel it behaved like a
 * static file (etag, last-modified, HIT for days): neither `revalidate` nor its
 * cache tags refreshed it, so crawlers kept getting past events that 404.
 */
import { NextResponse } from 'next/server'
import type { MetadataRoute } from 'next'
import { getSitemapEntries } from '@/lib/seo/sitemap-entries'
import { escapeHtml } from '@/lib/utils/escape-html'

export const revalidate = 3600

function urlElement({
  url,
  lastModified,
  changeFrequency,
  priority,
}: MetadataRoute.Sitemap[number]): string {
  const lines = [`<loc>${escapeHtml(url)}</loc>`]
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
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  })
}
