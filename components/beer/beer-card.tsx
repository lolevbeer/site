/**
 * Beer cards for the full catalog and compact grid.
 */

'use client'

import React from 'react'
import Link from 'next/link'
import { Beer } from '@/lib/types/beer'
import { useLocationContext } from '@/components/location/location-provider'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { BeerImage } from './beer-image'
import { getBeerSlug, getBeerAvailability, getBeerPricing } from '@/lib/utils/formatters'
import { trackBeerView } from '@/lib/analytics/events'
import { TopBeerDropsLink } from '@/components/beer/top-beer-drops-link'
import { UntappdRating } from '@/components/beer/untappd-rating'
import { MotionCard } from '@/components/motion'

function LiveDot() {
  return (
    <span aria-hidden="true" className="relative mr-1 flex h-2 w-2">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-75 [animation-iteration-count:3]" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-current" />
    </span>
  )
}

interface BeerCardProps {
  beer: Beer
  showLocation?: boolean
  showPricing?: boolean
  showAvailability?: boolean
  className?: string
  variant?: 'full' | 'minimal'
  priority?: boolean
}

export const BeerCard = React.memo(function BeerCard({
  beer,
  showLocation = true,
  showPricing = true,
  showAvailability = true,
  className = '',
  variant = 'full',
  priority = false,
}: BeerCardProps) {
  const { currentLocation } = useLocationContext()
  const beerSlug = getBeerSlug(beer)

  // Don't show beer if it's hidden from site
  if (beer.availability.hideFromSite) {
    return null
  }

  // Minimal variant matches the simpler homepage cans card.
  if (variant === 'minimal') {
    const beerHref = showLocation ? `/${currentLocation}/beer/${beerSlug}` : `/beer/${beerSlug}`

    return (
      <MotionCard glow>
        {/* Stretched link, not a wrapper: this card contains its own anchor (the
            Top Beer Drops icon) and a View Details button, and nesting either
            inside an <a> is invalid. See BeerLinkWrapper for the same pattern. */}
        <div className="group relative flex flex-col cursor-pointer transition-transform duration-200">
          <div className="relative h-64 w-full flex-shrink-0 mb-4 transition-transform duration-200">
            <BeerImage
              beer={beer}
              className="w-full h-full"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
              priority={priority}
            />
          </div>
          <div className="mb-3">
            <h3 className="text-xl font-semibold text-center mb-2">{beer.name}</h3>
            <div className="flex items-center justify-center gap-2">
              <UntappdRating rating={beer.untappdRating} />
              <Badge variant="outline" className="text-xs">
                {beer.type}
              </Badge>
              {beer.topBeerDrops && (
                <TopBeerDropsLink
                  url={beer.topBeerDrops}
                  className="h-6 w-6 text-foreground hover:text-primary transition-colors"
                />
              )}
            </div>
          </div>
          <Button
            variant="outline"
            className="w-full btn-arrow group-hover:bg-muted/50 hover:translate-y-0"
            tabIndex={-1}
          >
            View Details
          </Button>
          <Link
            href={beerHref}
            onClick={() => trackBeerView(beer.name, beer.type)}
            aria-label={beer.name}
            className="absolute inset-0 rounded-[inherit] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
        </div>
      </MotionCard>
    )
  }

  return (
    <MotionCard glow>
      <Card
        className={cn(
          'group p-6 transition-all duration-200 hover:translate-y-0 hover:shadow-md',
          className,
        )}
      >
        <div className="space-y-4">
          <div className="relative">
            <BeerImage
              beer={beer}
              className="aspect-square w-full mb-4 rounded-lg"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              priority={priority}
            />
            <UntappdRating
              rating={beer.untappdRating}
              variant="overlay"
              className="absolute bottom-6 left-2 z-10"
            />
            {beer.topBeerDrops && (
              <div className="absolute bottom-6 right-2 z-10">
                <TopBeerDropsLink
                  url={beer.topBeerDrops}
                  beerName={beer.name}
                  className="h-7 w-7 text-foreground hover:text-primary transition-colors drop-shadow-md"
                />
              </div>
            )}
            {beer.glutenFree && (
              <div className="absolute top-2 right-2 z-10">
                <Badge
                  variant="secondary"
                  className="bg-green-100 px-2 py-0.5 text-xs text-green-800 dark:bg-green-900 dark:text-green-100"
                >
                  GF
                </Badge>
              </div>
            )}
          </div>

          <div>
            <h3 className="font-semibold text-lg line-clamp-2 min-h-[2.5rem]">{beer.name}</h3>
            <p className="text-sm text-muted-foreground font-medium mt-1">{beer.type}</p>
          </div>

          <p className="text-sm text-muted-foreground line-clamp-3">{beer.description}</p>

          {beer.hops && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Hops:</p>
              <p className="text-sm">{beer.hops}</p>
            </div>
          )}

          <div className="space-y-2">
            {showAvailability && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Available:</span>
                <span className="font-medium">{getBeerAvailability(beer)}</span>
              </div>
            )}

            {showPricing && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Pricing:</span>
                <span className="font-medium">{getBeerPricing(beer)}</span>
              </div>
            )}
          </div>

          <div className="w-full flex items-center justify-between pt-4 border-t">
            <div className="flex flex-wrap gap-1.5">
              {beer.availability.cansAvailable && (
                <Badge variant="outline" className="px-2 py-0.5 text-xs">
                  <LiveDot />
                  Cans
                </Badge>
              )}
              {beer.availability.tap && (
                <Badge className="px-2 py-0.5 text-xs">
                  <LiveDot />
                  Tap {beer.availability.tap}
                </Badge>
              )}
              {beer.pricing.salePrice && (
                <Badge variant="destructive" className="px-2 py-0.5 text-xs">
                  Sale
                </Badge>
              )}
            </div>

            <Button asChild variant="outline" size="sm" className="ml-auto hover:translate-y-0">
              <Link
                href={showLocation ? `/${currentLocation}/beer/${beerSlug}` : `/beer/${beerSlug}`}
                className="no-underline"
                onClick={() => trackBeerView(beer.name, beer.type)}
              >
                Details
              </Link>
            </Button>
          </div>
        </div>
      </Card>
    </MotionCard>
  )
})
export default BeerCard
