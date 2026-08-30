/**
 * Draft Beer Card Component
 * Row-style layout focused on draft-specific information: tap number, glass type, ABV, and hops
 */

'use client'

import React from 'react'
import { BeerLinkWrapper } from '@/components/beer/beer-link-wrapper'
import { GlassType, type Beer } from '@/lib/types/beer'
import { useLocationContext } from '@/components/location/location-provider'
import { getBeerSlug } from '@/lib/utils/formatters'
import { GlassIcon } from '@/lib/utils/beer-icons'
import { Badge } from '@/components/ui/badge'
import { TopBeerDropsLink } from '@/components/beer/top-beer-drops-link'
import { UntappdRating } from '@/components/beer/untappd-rating'
import { getBeerBadgeLabel } from '@/lib/types/beer'
import { TV_TYPE, TV_COL, TV_BADGE_STYLE } from '@/lib/config/tv-display'

interface DraftBeerCardProps {
  beer: Beer
  showLocation?: boolean
  className?: string
  /** Show tap number and pricing (for fullscreen menu displays) */
  showTapAndPrice?: boolean
  /** Show glass icon (default: true) */
  showGlass?: boolean
  /** Show tap number column (default: true) */
  showTap?: boolean
  /** Show ABV column (default: true) */
  showAbv?: boolean
  /** Show Just Released badge (default: true) */
  showJustReleased?: boolean
  /** Show Untappd rating (default: false for menu displays, true for homepage) */
  showRating?: boolean
  /** Accent color for the beer name (dark mode cycling effect) */
  accentColor?: string
}

export const DraftBeerCard = React.memo(function DraftBeerCard({
  beer,
  showLocation = true,
  className = '',
  showTapAndPrice = false,
  showGlass = true,
  showTap = true,
  showAbv = true,
  showJustReleased = true,
  showRating = false,
  accentColor,
}: DraftBeerCardProps) {
  const { currentLocation } = useLocationContext()
  const beerSlug = getBeerSlug(beer)
  const isStein = beer.glass === GlassType.STEIN
  const glassOpticalClass = isStein ? '-translate-x-[0.8vh] scale-[1.08]' : ''
  const badgeLabel = showJustReleased ? getBeerBadgeLabel(beer) : null
  const isProduct = 'isProduct' in beer && beer.isProduct === true

  // Fullscreen mode uses viewport-relative sizing
  if (showTapAndPrice) {
    const showRatingInRail = showRating && !isProduct
    const showTapRail = showTap || showGlass || showRatingInRail
    const collabInDetails = Boolean(beer.collab && badgeLabel && (beer.description || beer.hops))
    const titleBadgeLabel = collabInDetails ? null : badgeLabel
    const collabDetailBadge = collabInDetails ? (
      <Badge
        variant="default"
        className="align-[0.08em]"
        style={{
          marginRight: '0.7vh',
          padding: '0.15vh 0.65vh',
          borderRadius: '99vh',
          fontSize: '1.45vh',
        }}
      >
        {badgeLabel}
      </Badge>
    ) : null
    const gridTemplateColumns = [
      showTapRail && (showGlass ? TV_COL.tap : '5vh'),
      'minmax(0, 1fr)',
      showAbv && TV_COL.abv,
      showAbv && TV_COL.price,
      TV_COL.price,
    ]
      .filter(Boolean)
      .join(' ')

    return (
      <BeerLinkWrapper
        href={`/beer/${beerSlug}`}
        label={beer.name}
        hidden={beer.availability.hideFromSite}
        className="group block"
      >
        <div
          className={`relative ${isStein ? 'overflow-visible' : 'overflow-hidden'} transition-colors duration-200 cursor-pointer hover:bg-secondary/50 bg-background ${className}`}
        >
          {/* The first grid row keeps all headline values on one baseline. The
              copy then clears beneath ABV and both price columns, giving long
              descriptions and hop lists the width those otherwise-empty lower
              cells were wasting. */}
          <div
            className="grid items-baseline"
            style={{ gridTemplateColumns, columnGap: '1vh', paddingBlock: '0.5vh' }}
          >
            {/* The tap number sits inside the glass; the rating is the second
                centered unit in the Tap rail, between the glass and beer. */}
            {showTapRail && (
              <div
                className="flex items-center justify-between self-center"
                style={{ gridRow: '1 / span 2' }}
              >
                {(showTap || showGlass) && (
                  <div className="relative flex-shrink-0" style={{ height: '7vh', width: '5vh' }}>
                    {showGlass && (
                      <GlassIcon
                        glass={beer.glass}
                        className={`h-full w-full text-muted-foreground/50 transition-colors group-hover:text-muted-foreground/70 ${glassOpticalClass}`}
                      />
                    )}
                    {showTap && beer.tap && (
                      <span
                        className="absolute inset-0 z-10 flex items-center justify-center text-center font-bold text-primary tabular-nums"
                        style={{ fontSize: TV_TYPE.tap, lineHeight: 1 }}
                      >
                        {beer.tap}
                      </span>
                    )}
                  </div>
                )}
                {showRatingInRail && (
                  <UntappdRating
                    rating={beer.untappdRating}
                    className="flex flex-col items-center justify-center leading-none"
                    style={{ width: '4vh', fontSize: TV_TYPE.body, gap: '0.2vh' }}
                    iconStyle={{
                      height: '2.4vh',
                      width: '2.4vh',
                      marginRight: 0,
                      verticalAlign: 'baseline',
                    }}
                  />
                )}
              </div>
            )}

            {/* Metadata wraps as complete units inside the Beer column. */}
            <div
              className="flex min-w-0 flex-wrap items-baseline"
              style={{ columnGap: '1vh', rowGap: '0.4vh' }}
            >
              <h3
                className="max-w-full break-words font-bold leading-tight transition-colors duration-500"
                style={{ fontSize: '3vh', color: accentColor }}
              >
                {beer.name}
              </h3>
              {beer.type &&
                beer.type.split(', ').map((option, i) => (
                  <Badge
                    key={i}
                    variant="outline"
                    className="flex-shrink-0 self-center"
                    style={{ fontSize: TV_TYPE.badge, ...TV_BADGE_STYLE }}
                  >
                    {option}
                  </Badge>
                ))}
              {titleBadgeLabel && (
                <Badge
                  variant="default"
                  className="flex-shrink-0 self-center"
                  style={{ fontSize: TV_TYPE.badge, ...TV_BADGE_STYLE }}
                >
                  {titleBadgeLabel}
                </Badge>
              )}
              {beer.topBeerDrops && (
                <TopBeerDropsLink
                  url={beer.topBeerDrops}
                  beerName={beer.name}
                  className="flex-shrink-0 self-center text-foreground transition-colors hover:text-primary"
                  style={{ height: '3.2vh', width: '3.2vh' }}
                />
              )}
            </div>

            {showAbv && (
              <div className="text-right">
                {beer.abv && (
                  <div
                    className="font-bold text-foreground-muted tabular-nums"
                    style={{ fontSize: '2.8vh' }}
                  >
                    {beer.abv}%
                  </div>
                )}
              </div>
            )}
            {showAbv && (
              <div className="text-right">
                {beer.pricing?.halfPour && (
                  <div
                    className="font-bold tabular-nums transition-colors duration-500"
                    style={{ fontSize: '3.8vh', color: accentColor }}
                  >
                    ${beer.pricing.halfPour}
                  </div>
                )}
              </div>
            )}
            <div className="text-right">
              {!beer.pricing?.halfPourOnly && beer.pricing?.draftPrice && (
                <div
                  className="font-bold tabular-nums transition-colors duration-500"
                  style={{ fontSize: '3.8vh', color: accentColor }}
                >
                  ${beer.pricing.draftPrice}
                </div>
              )}
            </div>

            {(beer.description || beer.hops) && (
              <div
                className="flex min-w-0 flex-col"
                style={{
                  gridColumn: showTapRail ? '2 / -1' : '1 / -1',
                  gap: '0.2vh',
                  marginTop: '0.2vh',
                }}
              >
                {beer.description && (
                  <div
                    className="whitespace-normal break-words text-foreground-muted leading-tight"
                    style={{ fontSize: TV_TYPE.body }}
                  >
                    {collabDetailBadge}
                    {beer.description}
                  </div>
                )}
                {beer.hops && (
                  <div
                    className="min-w-0 whitespace-normal break-words text-foreground-muted leading-tight"
                    style={{ fontSize: TV_TYPE.body }}
                  >
                    {!beer.description && collabDetailBadge}
                    <span
                      className="font-bold uppercase tracking-[0.08em] text-foreground-muted"
                      style={{ fontSize: '1.45vh', marginRight: '0.6vh' }}
                    >
                      Hops
                    </span>
                    {beer.hops}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </BeerLinkWrapper>
    )
  }

  // Standard mode with Tailwind classes
  return (
    <BeerLinkWrapper
      href={showLocation ? `/${currentLocation}/beer/${beerSlug}` : `/beer/${beerSlug}`}
      label={beer.name}
      hidden={beer.availability.hideFromSite}
    >
      <div
        className={`relative overflow-hidden transition-colors duration-200 cursor-pointer hover:bg-secondary/50 h-full min-h-[80px] bg-background rounded-lg ${className}`}
      >
        {badgeLabel && (
          <Badge variant="default" className="absolute z-10 top-2 right-1 text-xs">
            {badgeLabel}
          </Badge>
        )}
        <div className="flex items-center gap-6 px-4 h-full">
          {/* Tap Number and Glass Icon */}
          {showGlass && (
            <div className="flex-shrink-0 flex items-center gap-3">
              <GlassIcon
                glass={beer.glass}
                className="h-8 w-8 text-muted-foreground/50 group-hover:text-muted-foreground/70 transition-colors"
              />
            </div>
          )}

          {/* Beer Info - Main content */}
          <div className="flex-grow min-w-0 flex flex-col gap-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h3 className="text-xl font-bold leading-tight truncate">{beer.name}</h3>
              {beer.type &&
                beer.type.split(', ').map((option, i) => (
                  <Badge key={i} variant="outline" className="text-sm flex-shrink-0">
                    {option}
                  </Badge>
                ))}
              {beer.topBeerDrops && (
                <TopBeerDropsLink
                  url={beer.topBeerDrops}
                  beerName={beer.name}
                  className="h-6 w-6 flex-shrink-0 text-foreground hover:text-primary transition-colors"
                />
              )}
              {showRating && !isProduct && (
                <UntappdRating
                  rating={beer.untappdRating}
                  className="flex-shrink-0"
                  fallbackText="Needs Reviews"
                />
              )}
            </div>
            <div className="flex flex-col gap-0.5">
              {/* No /50 or /60 opacity here: fading muted-foreground put this
                  body text at 2.45:1 and 3.1:1 against the dark background,
                  under the 4.5:1 WCAG AA floor for text this size. */}
              {beer.description && (
                <p className="text-sm text-muted-foreground line-clamp-1 leading-tight">
                  {beer.description}
                </p>
              )}
              {beer.hops && (
                <p className="text-xs text-muted-foreground truncate leading-tight">
                  <span className="font-medium">Hops:</span> {beer.hops}
                </p>
              )}
            </div>
          </div>

          {/* ABV - Right aligned */}
          {beer.abv && (
            <div className="flex-shrink-0">
              <div className="text-lg font-bold text-foreground tabular-nums">{beer.abv}%</div>
            </div>
          )}
        </div>
      </div>
    </BeerLinkWrapper>
  )
})

export default DraftBeerCard
