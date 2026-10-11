/**
 * Draft beer row. `/m` boards pass `showTapAndPrice` for the full row (glass and
 * tap, rating, description, hops, ABV, prices). Everything else (homepage
 * featured drafts, taproom landings) gets the compact name-and-style row.
 */

'use client'

import React from 'react'
import { BeerLinkWrapper } from '@/components/beer/beer-link-wrapper'
import { GlassType, type Beer } from '@/lib/types/beer'
import { formatPrice, formatPriceText, getBeerSlug } from '@/lib/utils/formatters'
import { GlassIcon } from '@/lib/utils/beer-icons'
import { Badge } from '@/components/ui/badge'
import { TopBeerDropsLink } from '@/components/beer/top-beer-drops-link'
import { UntappdRating } from '@/components/beer/untappd-rating'
import { getBeerBadgeLabel } from '@/lib/types/beer'
import { isSold } from '@/lib/utils/packaging-utils'
import { TV_TYPE, TV_BADGE_STYLE, draftBoardColumns } from '@/lib/config/tv-display'
import type { BeerPricing } from '@/lib/types/beer'

/**
 * The half and full pour prices a draft row shows ('' when hidden). A free-text
 * price ("2 for $10") shows as entered; 0 or missing shows nothing.
 */
export function draftPriceLabels(pricing?: BeerPricing): { half: string; full: string } {
  return {
    half: isSold(pricing?.halfPour) ? formatPrice(pricing?.halfPour) : '',
    full: pricing?.halfPourOnly
      ? ''
      : formatPriceText(pricing?.draftPriceText) || formatPrice(pricing?.draftPrice),
  }
}

/** Longer than "$11" (e.g. cents or free text) needs TV_COL.priceWide on the /m board. */
export function needsWidePriceColumn(pricing?: BeerPricing): boolean {
  const { half, full } = draftPriceLabels(pricing)
  return half.length > 3 || full.length > 3
}

interface DraftBeerCardProps {
  beer: Beer
  /** The `/m` board row; without it, the compact name-and-style row. */
  showTapAndPrice?: boolean
  /**
   * Clock for the time-based "Just Released" badge (see getBeerBadgeLabel):
   * boards pass an hourly clock (useClockBucket) so this memoized card
   * re-renders as time passes. Defaults to null, which leaves that badge out
   * (Collab and Guest Tap badges still show). Board rows only.
   */
  now?: number | null
  /** Show the Untappd rating in the board's tap rail. */
  showRating?: boolean
  /** Accent color for the beer name and prices (dark board cycling effect) */
  accentColor?: string
  /** Width of each price column on the board; the board picks one for every row. */
  priceColumn?: string
}

export const DraftBeerCard = React.memo(function DraftBeerCard({
  beer,
  showTapAndPrice = false,
  now = null,
  showRating = false,
  accentColor,
  priceColumn,
}: DraftBeerCardProps) {
  const beerSlug = getBeerSlug(beer)

  if (showTapAndPrice) {
    const isStein = beer.glass === GlassType.STEIN
    const glassOpticalClass = isStein ? '-translate-x-[0.8vh] scale-[1.08]' : ''
    const badgeLabel = getBeerBadgeLabel(beer, now)
    const prices = draftPriceLabels(beer.pricing)
    const isProduct = 'isProduct' in beer && beer.isProduct === true
    const showRatingInRail = showRating && !isProduct
    const collabInDetails = Boolean(beer.collab && badgeLabel && (beer.description || beer.hops))
    const titleBadgeLabel = collabInDetails ? null : badgeLabel
    const collabDetailBadge = collabInDetails ? (
      <Badge
        variant="default"
        className="align-[0.08em]"
        style={{
          ...TV_BADGE_STYLE,
          padding: '0.15vh 0.65vh',
          fontSize: TV_TYPE.inlineLabel,
          marginRight: '0.7vh',
        }}
      >
        {badgeLabel}
      </Badge>
    ) : null
    const gridTemplateColumns = draftBoardColumns(priceColumn)

    return (
      <BeerLinkWrapper
        href={`/beer/${beerSlug}`}
        label={beer.name}
        hidden={beer.availability.hideFromSite}
        className="group block"
      >
        <div
          className={`relative ${isStein ? 'overflow-visible' : 'overflow-hidden'} transition-colors duration-200 cursor-pointer hover:bg-secondary/50 bg-background`}
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
            <div
              className="flex items-center justify-between self-center"
              style={{ gridRow: '1 / span 2' }}
            >
              <div className="relative flex-shrink-0" style={{ height: '7vh', width: '5vh' }}>
                <GlassIcon
                  glass={beer.glass}
                  className={`h-full w-full text-muted-foreground/50 transition-colors group-hover:text-muted-foreground/70 ${glassOpticalClass}`}
                />
                {beer.tap && (
                  <span
                    className="absolute inset-0 z-10 flex items-center justify-center text-center font-bold text-primary tabular-nums"
                    style={{ fontSize: TV_TYPE.tap, lineHeight: 1 }}
                  >
                    {beer.tap}
                  </span>
                )}
              </div>
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

            {/* Metadata wraps as complete units inside the Beer column. */}
            <div
              className="flex min-w-0 flex-wrap items-baseline"
              style={{ columnGap: '1vh', rowGap: '0.4vh' }}
            >
              <h3
                className="max-w-full break-words font-bold leading-tight transition-colors duration-500"
                style={{ fontSize: TV_TYPE.beerName, color: accentColor }}
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

            <div className="text-right">
              {beer.abv && (
                <div
                  className="font-bold text-foreground-muted tabular-nums"
                  style={{ fontSize: TV_TYPE.abv }}
                >
                  {beer.abv}%
                </div>
              )}
            </div>
            {[prices.half, prices.full].map((label, i) => (
              <div key={i} className="text-right">
                {label && (
                  <div
                    className="font-bold tabular-nums transition-colors duration-500"
                    style={{ fontSize: TV_TYPE.price, color: accentColor }}
                  >
                    {label}
                  </div>
                )}
              </div>
            ))}

            {(beer.description || beer.hops) && (
              <div
                className="flex min-w-0 flex-col"
                style={{
                  gridColumn: '2 / -1',
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
                      style={{ fontSize: TV_TYPE.inlineLabel, marginRight: '0.6vh' }}
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

  // Compact row: name and style only (homepage featured drafts, taproom landings)
  return (
    <BeerLinkWrapper
      href={`/beer/${beerSlug}`}
      label={beer.name}
      hidden={beer.availability.hideFromSite}
    >
      <div className="relative overflow-hidden transition-colors duration-200 cursor-pointer hover:bg-secondary/50 h-full bg-background rounded-lg">
        <div className="flex items-center justify-center gap-3 flex-wrap px-4 h-full">
          <h3 className="text-xl font-bold leading-tight truncate">{beer.name}</h3>
          {beer.type &&
            beer.type.split(', ').map((option, i) => (
              <Badge key={i} variant="outline" className="text-sm flex-shrink-0">
                {option}
              </Badge>
            ))}
        </div>
      </div>
    </BeerLinkWrapper>
  )
})

export default DraftBeerCard
