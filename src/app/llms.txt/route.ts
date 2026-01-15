/**
 * llms.txt - AI-readable site overview
 * @see https://llmstxt.org
 */

import { NextResponse } from 'next/server'

export const revalidate = 3600 // Revalidate every hour

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lolev.beer'

  const content = `# Lolev Beer

> Craft brewery in Pittsburgh, Pennsylvania specializing in modern ales, expressive lagers, and oak-aged beer.

## Locations

### Lawrenceville (Flagship Brewery & Taproom)
- Address: 5247 Butler Street, Pittsburgh, PA 15201
- Hours: Mon-Thu 4pm-10pm, Fri-Sat 12pm-12am, Sun 12pm-9pm
- Phone: (412) 336-8965

### Zelienople (Taproom)
- Address: 111 South Main Street, Zelienople, PA 16063
- Hours: Mon-Thu 5pm-10pm, Fri-Sat 12pm-12am, Sun 12pm-9pm

## Site Navigation

- [Home](${baseUrl}/): Current draft and cans menu, upcoming events and food vendors
- [Our Beers](${baseUrl}/beer): Full catalog of all beers with filtering by style, ABV, and availability
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

## Contact

- Email: info@lolev.beer
- Phone: (412) 336-8965
- Private Events: events@lolev.beer
- Instagram: [@lolevbeer](https://instagram.com/lolevbeer)

## Additional Resources

- [llms-full.txt](${baseUrl}/llms-full.txt): Extended version with current beer list and FAQ content
`

  return new NextResponse(content, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  })
}
