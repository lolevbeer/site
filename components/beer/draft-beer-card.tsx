/**
 * Draft Beer Card Component
 * Row-style layout focused on draft-specific information: tap number, glass type, ABV, and hops
 */

'use client'

import React from 'react'
import { BeerLinkWrapper } from '@/components/beer/beer-link-wrapper'
import { Beer } from '@/lib/types/beer'
import { useLocationContext } from '@/components/location/location-provider'
import { getBeerSlug } from '@/lib/utils/formatters'
import { getGlassIcon } from '@/lib/utils/beer-icons'
import { Badge } from '@/components/ui/badge'
import { TopBeerDropsLink } from '@/components/beer/top-beer-drops-link'
import { UntappdRating } from '@/components/beer/untappd-rating'
import { getBeerBadgeLabel } from '@/lib/types/beer'
import { TV_TYPE, TV_COL } from '@/lib/config/tv-display'

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
  const GlassIcon = getGlassIcon(beer.glass)
  const badgeLabel = showJustReleased ? getBeerBadgeLabel(beer) : null

  // Fullscreen mode uses viewport-relative sizing
  if (showTapAndPrice) {
    return (
      <BeerLinkWrapper
        href={`/beer/${beerSlug}`}
        label={beer.name}
        hidden={beer.availability.hideFromSite}
      >
        <div
          className={`relative overflow-hidden transition-colors duration-200 cursor-pointer hover:bg-secondary/50 h-full bg-background ${className}`}
        >
          {/* `items-baseline`, not `items-center` and not `items-start`.
              Centring let each cell float to its own position inside the
              row's equal-height track — a beer with four lines of hops pushed
              its name up while the price stayed centred, 63px apart. Aligning
              to the top fixed that but left the text ragged, because these
              cells are set at different sizes: the name at 3vh, ABV at 2.8vh,
              the prices at 3.8vh. Sharing a top edge puts three different
              baselines on one row. Sharing a baseline is what actually reads
              as aligned. */}
          <div className="flex items-baseline h-full" style={{ gap: '1vh', paddingTop: '1.5vh' }}>
            {/* Tap Number, Glass Icon, and Rating */}
            {(showTap || showGlass) && (
              <div
                className="flex-shrink-0 flex flex-col items-center"
                style={{ width: showGlass ? TV_COL.tap : '3vh', gap: '0.3vh' }}
              >
                <div className="flex items-center justify-between w-full">
                  {showTap && beer.tap && (
                    <span
                      className="font-bold text-primary tabular-nums"
                      style={{ fontSize: TV_TYPE.tap }}
                    >
                      {beer.tap}
                    </span>
                  )}
                  {showGlass && (
                    <div style={{ height: '6vh', width: '6vh' }}>
                      <GlassIcon className="w-full h-full text-muted-foreground/50 group-hover:text-muted-foreground/70 transition-colors" />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Beer Info - Main content */}
            <div className="flex-grow min-w-0 flex flex-col" style={{ gap: '0.3vh' }}>
              {/* No `flex-wrap`. A long beer name used to push the Collab /
                  Just Released badge onto a second line, which changed the
                  row's height and left the badge floating under the name with
                  nothing beside it. The name truncates instead: it is the one
                  element on this line that can lose characters and still be
                  read, and the badge belongs beside the name, where it says
                  something about the beer. `min-w-0` is what lets truncation
                  actually happen inside a flex row. */}
              <div className="flex items-baseline flex-nowrap" style={{ gap: '1vh' }}>
                <h3
                  className="min-w-0 font-bold leading-tight truncate transition-colors duration-500"
                  style={{ fontSize: '3vh', color: accentColor }}
                >
                  {beer.name}
                </h3>
                {/* Outlined Badge, the same treatment the style gets on the
                    homepage draft rows and cans cards, so a beer looks like the
                    same beer on every surface. `self-center` because the row is
                    baseline-aligned and a bordered pill has no text baseline to
                    share. */}
                {beer.type &&
                  beer.type.split(', ').map((option, i) => (
                    <Badge
                      key={i}
                      variant="outline"
                      className="flex-shrink-0 self-center"
                      style={{ fontSize: TV_TYPE.badge }}
                    >
                      {option}
                    </Badge>
                  ))}
                {/* Inline, so it reads as a fact about this beer. It used to be
                    absolutely positioned above the price group, where it looked
                    like an entry in the Full column. */}
                {badgeLabel && (
                  <Badge
                    variant="default"
                    className="flex-shrink-0 self-center"
                    style={{ fontSize: TV_TYPE.badge }}
                  >
                    {badgeLabel}
                  </Badge>
                )}
                {beer.topBeerDrops && (
                  <TopBeerDropsLink
                    url={beer.topBeerDrops}
                    beerName={beer.name}
                    className="flex-shrink-0 self-center text-foreground hover:text-primary transition-colors"
                    style={{ height: '3.2vh', width: '3.2vh' }}
                  />
                )}
              </div>
              <div className="flex flex-col" style={{ gap: '0.2vh' }}>
                {/* One line, not two. A two-line description pushed the
                    rating-and-hops line down by a whole line on some rows and
                    not others, so that line sat at a different height as you
                    read down the column. */}
                {beer.description && (
                  <p
                    className="text-foreground-muted line-clamp-1 leading-tight"
                    style={{ fontSize: TV_TYPE.body }}
                  >
                    {beer.description}
                  </p>
                )}
                {/* The rating leads this line and the hops truncate after it.
                    It used to trail a hop list that could run four lines, so it
                    wrapped to an unpredictable spot and read as part of the hop
                    text. No `fallbackText`: "Needs Reviews" is our language, not
                    a customer's, and it was showing on the public boards. */}
                <div
                  className="flex items-baseline text-foreground-muted leading-tight"
                  style={{ fontSize: TV_TYPE.body, gap: '0.8vh' }}
                >
                  {/* The slot is always rendered at a fixed width, even when a
                      beer has no rating yet — UntappdRating returns null in
                      that case, and without a reserved slot the hop list slid
                      left on exactly those rows, so "Hops:" started at a
                      different x depending on whether Untappd had scored the
                      beer. */}
                  {showRating && !(beer as unknown as { isProduct?: boolean }).isProduct && (
                    <span className="flex-shrink-0" style={{ width: TV_COL.rating }}>
                      <UntappdRating
                        rating={beer.untappdRating}
                        className="leading-none inline-flex"
                        style={{ gap: '0.3vh', fontSize: TV_TYPE.body }}
                        iconStyle={{ height: '2vh', width: '2vh' }}
                      />
                    </span>
                  )}
                  {beer.hops && (
                    <span className="min-w-0 truncate">
                      <span className="font-medium">Hops:</span> {beer.hops}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* ABV and Price - Right aligned. The badge is no longer absolutely
                positioned above this group (it now sits inline beside the beer
                name), so nothing overlaps the price columns or reads as a value
                in the Full column. */}
            <div className="flex-shrink-0 flex items-baseline" style={{ gap: '2vh' }}>
              {showAbv && (
                <div className="text-right" style={{ width: TV_COL.abv }}>
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
              {/* Half pour price - always render column for alignment */}
              <div className="text-right" style={{ width: TV_COL.price }}>
                {beer.pricing?.halfPour && (
                  <div
                    className="font-bold tabular-nums transition-colors duration-500"
                    style={{ fontSize: '3.8vh', color: accentColor }}
                  >
                    ${beer.pricing.halfPour}
                  </div>
                )}
              </div>
              {/* Full price - always render column, show value if not halfPourOnly */}
              <div className="text-right" style={{ width: TV_COL.price }}>
                {!beer.pricing?.halfPourOnly && beer.pricing?.draftPrice && (
                  <div
                    className="font-bold tabular-nums transition-colors duration-500"
                    style={{ fontSize: '3.8vh', color: accentColor }}
                  >
                    ${beer.pricing.draftPrice}
                  </div>
                )}
              </div>
            </div>
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
              <GlassIcon className="h-8 w-8 text-muted-foreground/50 group-hover:text-muted-foreground/70 transition-colors" />
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
              {showRating && !(beer as unknown as { isProduct?: boolean }).isProduct && (
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
