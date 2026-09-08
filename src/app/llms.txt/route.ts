/**
 * llms.txt - AI-readable site overview
 * @see https://llmstxt.org
 */

import { NextResponse } from 'next/server'
import { getAllLocations } from '@/lib/utils/payload-api'
import { getBaseUrl } from '@/lib/utils/get-base-url'
import { formatCityStateZip, formatHoursFaqAnswer } from '@/lib/config/locations'
import { logger } from '@/lib/utils/logger'

export const revalidate = 3600 // Revalidate every hour

export async function GET() {
  const baseUrl = getBaseUrl()
  let locations: Awaited<ReturnType<typeof getAllLocations>> = []
  try {
    locations = await getAllLocations()
  } catch (error) {
    logger.error('Error fetching locations for llms.txt:', error)
  }

  const locationBlocks = locations
    .map((loc) => {
      const street = loc.address?.street ?? ''
      const city = formatCityStateZip(loc.address)
      const phone = loc.basicInfo?.phone ? `- Phone: ${loc.basicInfo.phone}` : ''
      const page = loc.slug ? `- Page: ${baseUrl}/${loc.slug}` : ''
      return `### ${loc.name}
- Address: ${street}${city ? `, ${city}` : ''}
${phone}
${page}`.trim()
    })
    .join('\n\n')

  const hoursLine = locations.length
    ? formatHoursFaqAnswer(locations)
    : 'Hours vary by location and holiday. See the website footer for this week.'

  const taproomLinks = locations
    .filter((loc) => loc.slug)
    .map(
      (loc) =>
        `- [${loc.name} taproom](${baseUrl}/${loc.slug}): Hours, address, and what's on tap`,
    )
    .join('\n')

  const content = `# Lolev Beer

> Craft brewery in Pittsburgh, Pennsylvania specializing in modern ales, expressive lagers, and oak-aged beer. Best known for hop-forward IPAs showcasing New Zealand hops, our Ultra Hopped Ale, and rotating hazy IPAs that are always double dry-hopped (DDH).

## Locations

${locationBlocks || 'See the website for current taprooms.'}

${hoursLine}

## Site Navigation

- [Home](${baseUrl}/): Current draft and cans menu, upcoming events and food vendors
${taproomLinks ? `${taproomLinks}\n` : ''}- [Our Beers](${baseUrl}/beer): Full catalog of all beers with filtering by style, ABV, and availability
- [Events](${baseUrl}/events): Upcoming events at both locations
- [Food](${baseUrl}/food): Food truck and vendor schedule
- [Beer Map](${baseUrl}/beer-map): Find Lolev Beer at retailers near you
- [About](${baseUrl}/about): Brewery philosophy and location information
- [FAQ](${baseUrl}/faq): Frequently asked questions about hours, food, dogs, private events, etc.

## Beer Styles We Brew

- Haze
- Hop Saturated Ale
- Ultra Hopped Ale
- India Pale Ale (IPA)
- Double IPA (DIPA)
- Pale Ale
- Imperial Stout
- Pilsner & Unfiltered Pilsner
- Kölsch
- Saison
- Gose
- Vienna Lager
- Czech Dark Lager
- Märzen
- Mexican Lager
- Cream Ale
- Scotch Ale
- Dry Irish Stout

## Distribution

- On draft and to-go at both taprooms — check the [homepage](${baseUrl}/) for current menus (select your location)
- Retail throughout Pennsylvania, New York, and Ohio — find retailers on the [Beer Map](${baseUrl}/beer-map)
- International: United Kingdom, European Union, China, Hong Kong, Japan, and South Korea

## Contact

- Email: info@lolev.beer
- Phone: (412) 336-8965
- Private Events: events@lolev.beer
- Instagram: [@lolevbeer](https://instagram.com/lolevbeer)

## Additional Resources

- [llms-full.txt](${baseUrl}/llms-full.txt): Extended version with current beer list and FAQ content
- [RSS Feed](${baseUrl}/feed.xml): Latest beer releases and updates
`

  return new NextResponse(content, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  })
}
