import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL
    || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '')
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '')
    || 'https://lolev.beer'

  return {
    rules: {
      userAgent: '*',
      disallow: ['/inventory', '/distributors', '/sarene', '/qr/', '/barcode/', '/admin', '/m/'],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
