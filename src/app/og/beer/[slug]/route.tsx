/**
 * Generated social card for one beer. 404 for missing or hidden beers.
 */
import { getBeerBySlug } from '@/lib/utils/payload-api'
import { getBeerImageUrl } from '@/lib/utils/media-utils'
import { ogNotFound, renderOgCard } from '@/lib/og/card'

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const beer = await getBeerBySlug(slug)
  if (!beer || beer.hideFromSite) return ogNotFound()

  const style = typeof beer.style === 'object' ? beer.style.name : undefined
  const subtitle = [style, beer.abv ? `${beer.abv}% ABV` : undefined].filter(Boolean).join(' · ')
  return renderOgCard({
    title: beer.name,
    subtitle,
    imageUrl: getBeerImageUrl(beer.image, beer.slug),
  })
}
