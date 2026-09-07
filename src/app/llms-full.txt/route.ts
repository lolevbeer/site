/**
 * llms-full.txt - Extended AI-readable site content
 * Includes dynamic beer list and FAQ content
 * @see https://llmstxt.org
 */

import { NextResponse } from 'next/server'
import { getAllBeersFromPayload, getActiveFAQs, getAllLocations } from '@/lib/utils/payload-api'
import { getBreweryFAQs } from '@/lib/utils/faq-schema'
import { getBaseUrl } from '@/lib/utils/get-base-url'
import { formatHoursFaqAnswer } from '@/lib/config/locations'
import { logger } from '@/lib/utils/logger'

export const revalidate = 3600 // Revalidate every hour

export async function GET() {
  const baseUrl = getBaseUrl()

  let beers: Awaited<ReturnType<typeof getAllBeersFromPayload>> = []
  let cmsFAQs: Awaited<ReturnType<typeof getActiveFAQs>> = []
  let locations: Awaited<ReturnType<typeof getAllLocations>> = []

  try {
    beers = await getAllBeersFromPayload()
  } catch (error) {
    logger.error('Error fetching beers for llms-full.txt:', error)
  }

  try {
    cmsFAQs = await getActiveFAQs()
  } catch (error) {
    logger.error('Error fetching FAQs for llms-full.txt:', error)
  }

  try {
    locations = await getAllLocations()
  } catch (error) {
    logger.error('Error fetching locations for llms-full.txt:', error)
  }

  // Filter visible beers and sort by name
  const visibleBeers = beers
    .filter(beer => !beer.hideFromSite && beer.name)
    .sort((a, b) => a.name.localeCompare(b.name))

  // Combine static and CMS FAQs
  const allFAQs = [
    ...getBreweryFAQs(locations),
    ...cmsFAQs.map(faq => ({ question: faq.question, answer: faq.answer }))
  ]

  const locationBlocks = locations
    .map((loc) => {
      const street = loc.address?.street ?? ''
      const city = [loc.address?.city, loc.address?.state, loc.address?.zip].filter(Boolean).join(' ')
      const page = loc.slug ? `- Page: ${baseUrl}/${loc.slug}` : ''
      return `### ${loc.name}
- Address: ${street}${city ? `, ${city}` : ''}
${page}`.trim()
    })
    .join('\n\n')

  const hoursLine = locations.length ? formatHoursFaqAnswer(locations) : ''

  // Build beer list markdown
  const beerList = visibleBeers.map(beer => {
    const parts = [`### ${beer.name}`]
    if (beer.style) {
      const styleName = typeof beer.style === 'object' ? beer.style.name : beer.style
      parts.push(`- **Style:** ${styleName}`)
    }
    if (beer.abv) parts.push(`- **ABV:** ${beer.abv}%`)
    if (beer.description) parts.push(`- **Description:** ${beer.description}`)
    if (beer.hops) parts.push(`- **Hops:** ${beer.hops}`)
    if (beer.slug) parts.push(`- **Details:** ${baseUrl}/beer/${beer.slug}`)
    return parts.join('\n')
  }).join('\n\n')

  // Build FAQ markdown
  const faqList = allFAQs.map(faq =>
    `### ${faq.question}\n${faq.answer}`
  ).join('\n\n')

  const content = `# Lolev Beer

> Craft brewery in Pittsburgh, Pennsylvania specializing in modern ales, expressive lagers, and oak-aged beer.

## Locations

${locationBlocks}

${hoursLine}

## Site Navigation

- [Home](${baseUrl}/): Current draft and cans menu, upcoming events and food vendors
- [Our Beers](${baseUrl}/beer): Full catalog of all beers with filtering by style, ABV, and availability
- [Events](${baseUrl}/events): Upcoming events at both locations
- [Food](${baseUrl}/food): Food truck and vendor schedule
- [Beer Map](${baseUrl}/beer-map): Find Lolev Beer at retailers near you
- [About](${baseUrl}/about): Brewery philosophy and location information
- [FAQ](${baseUrl}/faq): Frequently asked questions

## Current Beer List

${beerList || 'Beer list currently unavailable.'}

## Frequently Asked Questions

${faqList}

## Contact Information

- **General Inquiries:** info@lolev.beer
- **Phone:** (412) 336-8965
- **Private Events:** events@lolev.beer
- **Instagram:** [@lolevbeer](https://instagram.com/lolevbeer)
- **Facebook:** [facebook.com/lolevbeer](https://facebook.com/lolevbeer)

## About Lolev Beer

We focus on creating beers that are purposeful and refined. Our approach combines traditional brewing techniques with modern innovation, always in service of flavor and quality. We source the finest ingredients, obsess over every detail of the brewing process, and refine our recipes.

${locations
    .map((loc) => {
      const city = loc.address?.city
      return `${loc.name}${city ? ` (${city})` : ''} is a Lolev Beer taproom.`
    })
    .join(' ')}

Our taprooms offer a curated selection of our freshest draft beers and canned offerings. We regularly host food trucks, live events, and community gatherings.
`

  return new NextResponse(content, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  })
}
