/**
 * llms-full.txt - Extended AI-readable site content
 * Includes dynamic beer list and FAQ content
 * @see https://llmstxt.org
 */

import { NextResponse } from 'next/server'
import { getAllBeersFromPayload, getActiveFAQs } from '@/lib/utils/payload-api'
import { breweryFAQs } from '@/lib/utils/faq-schema'

export const revalidate = 3600 // Revalidate every hour

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lolev.beer'

  // Fetch dynamic content
  let beers: Awaited<ReturnType<typeof getAllBeersFromPayload>> = []
  let cmsFAQs: Awaited<ReturnType<typeof getActiveFAQs>> = []

  try {
    beers = await getAllBeersFromPayload()
  } catch (error) {
    console.error('Error fetching beers for llms-full.txt:', error)
  }

  try {
    cmsFAQs = await getActiveFAQs()
  } catch (error) {
    console.error('Error fetching FAQs for llms-full.txt:', error)
  }

  // Filter visible beers and sort by name
  const visibleBeers = beers
    .filter(beer => !beer.hideFromSite && beer.name)
    .sort((a, b) => a.name.localeCompare(b.name))

  // Combine static and CMS FAQs
  const allFAQs = [
    ...breweryFAQs,
    ...cmsFAQs.map(faq => ({ question: faq.question, answer: faq.answer }))
  ]

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

### Lawrenceville (Flagship Brewery & Taproom)
- Address: 5247 Butler Street, Pittsburgh, PA 15201
- Hours: Mon-Thu 4pm-10pm, Fri-Sat 12pm-12am, Sun 12pm-9pm
- Phone: (412) 336-8965
- Features: Production brewery, taproom, outdoor seating, dog-friendly, family-friendly

### Zelienople (Taproom)
- Address: 111 South Main Street, Zelienople, PA 16063
- Hours: Mon-Thu 5pm-10pm, Fri-Sat 12pm-12am, Sun 12pm-9pm
- Features: Historic building (former Barq's bottling facility), taproom, outdoor seating, dog-friendly, family-friendly, free parking lot

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

Our flagship location in Lawrenceville is both our production brewery and taproom, where visitors can experience our beers in the space where they're created. Our Zelienople location occupies a historic building that previously housed a Barq's bottling facility until the 1970s.

Both locations offer a curated selection of our freshest draft beers and canned offerings. We regularly host food trucks, live events, and community gatherings.
`

  return new NextResponse(content, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  })
}
