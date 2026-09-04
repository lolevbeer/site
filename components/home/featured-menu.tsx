'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { ScrollReveal } from '@/components/ui/scroll-reveal'
import { Beer as BeerIconLucide, Package, Pencil } from '@/components/icons'
import { GlassIcon } from '@/lib/utils/beer-icons'
import { beerHref } from '@/lib/config/beer-filters'
import { useLocationContext } from '@/components/location/location-provider'
import { DraftBeerCard } from '@/components/beer/draft-beer-card'
import { BeerLinkWrapper } from '@/components/beer/beer-link-wrapper'
import {
  useAnimatedList,
  getAnimationClass,
  type AnimatedItem,
} from '@/lib/hooks/use-animated-list'
import { useAuth } from '@/lib/hooks/use-auth'
import { SectionHeader } from '@/components/ui/section-header'
import { getMediaUrl, canSpriteAnimation } from '@/lib/utils/media-utils'
import { extractBeerFromMenuItem, extractProductFromMenuItem } from '@/lib/utils/menu-item-utils'
import { getTodayEST, toESTDate } from '@/lib/utils/date'
import type { Menu, Style, Location } from '@/src/payload-types'
import type { Beer } from '@/lib/types/beer'
import { getBeerBadgeLabel } from '@/lib/types/beer'
import { Logo } from '@/components/ui/logo'
import { TopBeerDropsLink } from '@/components/beer/top-beer-drops-link'
import { UntappdRating } from '@/components/beer/untappd-rating'
import { TV_TYPE, TV_SAFE_X, TV_SAFE_Y, TV_COL, TV_LOGO_CLASS } from '@/lib/config/tv-display'
import { OTHER_MENU_CATEGORIES, type OtherMenuCategory } from '@/lib/config/other-menu'
import { LINES_OVERDUE_DAYS } from '@/lib/utils/lines-cleaned'
import { parsePrice } from '@/lib/utils/formatters'

const MS_PER_DAY = 1000 * 60 * 60 * 24

/**
 * Format the lines cleaned date as a relative description using EST timezone,
 * or null once the lines are overdue — a stale date is worse than no date on a
 * customer-facing display. Counts EST calendar days, so at the
 * LINES_OVERDUE_DAYS boundary it can differ by a day from the admin alert,
 * which counts elapsed days from `Date.now()`.
 */
function formatLinesCleanedDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null

  const diffDays = Math.round(
    (toESTDate(getTodayEST()).getTime() - toESTDate(dateStr).getTime()) / MS_PER_DAY,
  )

  if (diffDays >= LINES_OVERDUE_DAYS) return null

  const daysText = diffDays === 0 ? 'today' : `${diffDays} day${diffDays === 1 ? '' : 's'} ago`
  return `Draft lines cleaned ${daysText}`
}

type MenuType = 'draft' | 'cans'

interface MenuItem {
  variant: string
  name: string
  type: string
  /** Product choices shown as quiet text on Other Things boards. */
  options?: string[]
  /** Optional grouping for Other Things products. */
  otherCategory?: OtherMenuCategory
  abv?: string
  description: string
  glutenFree: boolean
  /** Image URL from Payload CMS Media, or undefined if no image */
  imageUrl?: string
  /** Can-rotation sprite sheet URL (beer.labelVideo — a PNG, not a video).
   *  Only populated when the menu enables labelVideos; CanCard animates it
   *  via CSS (see canSpriteAnimation) whenever present. */
  labelVideoUrl?: string
  onDraft?: boolean
  glass?: string
  fourPack?: string
  bottlePrice?: string
  isJustReleased?: boolean
  /** Beer from another brewery */
  guestTap?: boolean
  /** Collaboration brew */
  collab?: boolean
  /** Other brewery named in the collaboration badge */
  collabBrewery?: string
  recipe?: number
  hops?: string
  tap?: number
  pricing: {
    draftPrice?: number
    halfPour?: number
    halfPourOnly?: boolean
  }
  availability: {
    hideFromSite?: boolean
  }
  slug?: string
  style?: string | Style
  locationSlug?: string
  /** Manual "Just Released" flag from Payload */
  justReleased?: boolean
  /** Beer creation date for auto "Just Released" logic */
  createdAt?: string
  /** Untappd rating (0-5 scale) */
  untappdRating?: number | null
  /** Top Beer Drops URL */
  topBeerDrops?: string
  /** True when this slot has no product assigned (empty tap) */
  isEmpty?: boolean
  [key: string]: unknown
}

/** Column header for the fullscreen draft grid, with viewport-relative sizing.
 *  Module scope on purpose: declaring it inside render created a new component
 *  type each tick, unmounting/remounting both headers every poll. */
function scaledVh(value: number | `${number}vh`, scale: number): string {
  const numericValue = typeof value === 'number' ? value : Number.parseFloat(value)
  return `${Math.round(numericValue * scale * 100) / 100}vh`
}

function ColumnHeader({
  isOtherMenu,
  displayScale = 1,
}: {
  isOtherMenu: boolean
  displayScale?: number
}) {
  return (
    <div
      className="grid items-center bg-[#1d1d1f]"
      style={{
        gridTemplateColumns: isOtherMenu
          ? `minmax(0, 1fr) ${scaledVh(TV_COL.price, displayScale)}`
          : `${TV_COL.tap} minmax(0, 1fr) ${TV_COL.abv} ${TV_COL.price} ${TV_COL.price}`,
        columnGap: scaledVh(1, displayScale),
        paddingBlock: scaledVh(0.65, displayScale),
        borderRadius: '0.35vh',
      }}
    >
      {!isOtherMenu && <div aria-hidden="true" />}
      <div style={isOtherMenu ? { paddingLeft: scaledVh(1.2, displayScale) } : undefined}>
        {isOtherMenu ? 'Item' : 'Beer'}
      </div>
      {!isOtherMenu && <div className="text-center">ABV</div>}
      {!isOtherMenu && <div className="text-center">Half</div>}
      <div className="text-center">{isOtherMenu ? 'Price' : 'Full'}</div>
    </div>
  )
}

const OTHER_CATEGORY_LABELS = new Map<string, string>(
  OTHER_MENU_CATEGORIES.map(({ value, label }) => [value, label]),
)
const OTHER_CATEGORY_ORDER: string[] = OTHER_MENU_CATEGORIES.map(({ value }) => value)
const UNCATEGORIZED = 'uncategorized'
const SOLD_OUT_OPTION = /^sold\s+(?:out|aht)!?$/i
const TV_COLUMN_GAP = '2.5vw'

interface OtherMenuEntry extends AnimatedItem<MenuItem> {
  accentColor?: string
}

interface OtherMenuGroup {
  key: string
  label?: string
  entries: OtherMenuEntry[]
}

/**
 * Preserve the menu's authored order inside each category. Categories are
 * optional: a wholly uncategorized board stays a single clean list, while a
 * partially categorized board gathers the remainder under "Other".
 */
function groupOtherMenuItems(entries: OtherMenuEntry[]): OtherMenuGroup[] {
  if (!entries.some(({ item }) => item.otherCategory)) {
    return [{ key: 'all', entries }]
  }

  const grouped = new Map<string, OtherMenuEntry[]>()
  for (const entry of entries) {
    const key = entry.item.otherCategory || UNCATEGORIZED
    const group = grouped.get(key)
    if (group) group.push(entry)
    else grouped.set(key, [entry])
  }

  const unknownCategories = Array.from(grouped.keys()).filter(
    (key) => key !== UNCATEGORIZED && !OTHER_CATEGORY_LABELS.has(key),
  )
  const keys = [
    ...OTHER_CATEGORY_ORDER.filter((key) => grouped.has(key)),
    ...unknownCategories,
    ...(grouped.has(UNCATEGORIZED) ? [UNCATEGORIZED] : []),
  ]

  return keys.map((key) => ({
    key,
    label:
      key === UNCATEGORIZED ? 'Other' : OTHER_CATEGORY_LABELS.get(key) || key.replaceAll('-', ' '),
    entries: grouped.get(key) || [],
  }))
}

/** Keep category blocks intact while balancing their item counts across the TV. */
function distributeOtherGroups(groups: OtherMenuGroup[]): OtherMenuGroup[][] {
  if (groups.length === 1) {
    const [group] = groups
    const midpoint = Math.ceil(group.entries.length / 2)
    const leftGroup = { ...group, entries: group.entries.slice(0, midpoint) }
    const rightEntries = group.entries.slice(midpoint)
    return rightEntries.length > 0
      ? [[leftGroup], [{ ...group, entries: rightEntries }]]
      : [[leftGroup]]
  }

  const columns: OtherMenuGroup[][] = [[], []]
  const columnSizes = [0, 0]
  for (const group of groups) {
    const columnIndex = columnSizes[0] <= columnSizes[1] ? 0 : 1
    columns[columnIndex].push(group)
    columnSizes[columnIndex] += group.entries.length
  }
  return columns
}

function OtherThingRow({
  entry,
  animated,
  displayScale,
}: {
  entry: OtherMenuEntry
  animated: boolean
  displayScale: number
}) {
  const { item, state, accentColor } = entry
  const options = item.options?.filter((option) => !SOLD_OUT_OPTION.test(option))
  const soldOut = options?.length !== item.options?.length
  const itemColor = soldOut ? undefined : accentColor

  return (
    <div
      className={`grid min-w-0 items-baseline ${animated ? getAnimationClass(state) : ''}`}
      style={{
        gridTemplateColumns: `minmax(0, 1fr) ${scaledVh(TV_COL.price, displayScale)}`,
        columnGap: scaledVh(1, displayScale),
        paddingInline: scaledVh(1.2, displayScale),
      }}
      role="listitem"
    >
      <div className="min-w-0">
        <div
          className="flex min-w-0 flex-wrap items-baseline"
          style={{ columnGap: scaledVh(1, displayScale) }}
        >
          <h4
            className={`break-words font-bold leading-tight transition-colors duration-500 ${soldOut ? 'text-foreground-muted' : ''}`}
            style={{ fontSize: scaledVh(2.8, displayScale), color: itemColor }}
          >
            {item.name}
          </h4>
          {soldOut && (
            <span
              className="font-bold uppercase tracking-[0.12em] text-foreground-muted"
              style={{ fontSize: scaledVh(1.15, displayScale) }}
            >
              Sold aht
            </span>
          )}
        </div>
        {options && options.length > 0 && (
          <p
            className="break-words text-foreground-muted"
            style={{ fontSize: scaledVh(TV_TYPE.body, displayScale), lineHeight: 1.35 }}
          >
            {options.join(' · ')}
          </p>
        )}
      </div>
      <div
        className={`text-right font-bold tabular-nums transition-colors duration-500 ${soldOut ? 'text-foreground-muted line-through' : ''}`}
        style={{ fontSize: scaledVh(3.4, displayScale), color: itemColor }}
      >
        {item.pricing.draftPrice != null && `$${item.pricing.draftPrice}`}
      </div>
    </div>
  )
}

function OtherThingsBoard({
  items,
  animated,
  itemColors,
}: {
  items: AnimatedItem<MenuItem>[]
  animated: boolean
  itemColors?: string[]
}) {
  const entries = items.map((entry, index) => ({
    ...entry,
    accentColor: itemColors?.[index],
  }))
  const columns = distributeOtherGroups(groupOtherMenuItems(entries))
  const rowsPerColumn = Math.max(
    ...columns.map((groups) => groups.reduce((total, group) => total + group.entries.length, 0)),
  )
  // Six rows per column is the full-board baseline. Sparse boards grow in
  // direct proportion to the missing rows, capped so a one-item board remains
  // balanced and long option lines still have room to wrap.
  const displayScale = Math.min(2.25, Math.max(1, 6 / rowsPerColumn))
  const columnClass = columns.length === 1 ? 'grid-cols-1' : 'grid-cols-2'

  return (
    <div className="flex h-full min-w-0 max-w-none flex-col" data-other-things-board>
      <div
        className={`grid flex-shrink-0 ${columnClass} font-bold uppercase tracking-wider text-[#f5f5f7]`}
        style={{
          columnGap: TV_COLUMN_GAP,
          marginBottom: scaledVh(1.4, displayScale),
          fontSize: scaledVh(TV_TYPE.label, displayScale),
        }}
      >
        {columns.map((_, columnIndex) => (
          <ColumnHeader key={columnIndex} isOtherMenu displayScale={displayScale} />
        ))}
      </div>

      <div
        className={`grid min-h-0 min-w-0 flex-1 ${columnClass}`}
        style={{ columnGap: TV_COLUMN_GAP }}
      >
        {columns.map((groups, columnIndex) => (
          <div
            key={columnIndex}
            className="flex min-h-0 min-w-0 flex-col"
            style={{ gap: scaledVh(2.2, displayScale) }}
            role="list"
          >
            {groups.map((group) => (
              <section
                key={group.key}
                className="flex min-w-0 flex-col"
                style={{
                  flexGrow: group.entries.length,
                  gap: scaledVh(1, displayScale),
                }}
                data-other-category={group.key}
              >
                {group.label && (
                  <h3
                    className="border-b border-border font-bold uppercase tracking-[0.14em] text-foreground-muted"
                    style={{
                      paddingBottom: scaledVh(0.6, displayScale),
                      fontSize: scaledVh(1.35, displayScale),
                    }}
                  >
                    {group.label}
                  </h3>
                )}
                <div
                  className="flex min-w-0 flex-1 flex-col justify-evenly"
                  style={{ gap: scaledVh(1.35, displayScale) }}
                >
                  {group.entries.map((entry) => (
                    <OtherThingRow
                      key={entry.key}
                      entry={entry}
                      animated={animated}
                      displayScale={displayScale}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

/** Stable default for the `menus` prop — a fresh `[]` default parameter would
 *  change identity every render and defeat the allItems→filteredItems memo
 *  chain (and DraftBeerCard's React.memo) on /m/* pages where `menus` is
 *  never passed. */
const NO_MENUS: Menu[] = []

interface FeaturedMenuProps {
  menuType: MenuType
  menu?: Menu
  menus?: Menu[]
  /** Enable enter/exit animations for live updates */
  animated?: boolean
  /** Random colors to apply to items (dark mode only, cycles on poll) */
  itemColors?: string[]
  /** Hide header when embedding in another component */
  hideHeader?: boolean
  /** Animate the generated can-rotation sprite sheet on can cards. Only enabled
   *  on /m/ menu displays (captive hardware, cached); public pages keep the
   *  flat image to spare mobile visitors the larger sprite-sheet download. */
  labelVideos?: boolean
}

/** Check if a date is within the last N days */
function isWithinDays(dateStr: string | undefined, days: number): boolean {
  if (!dateStr) return false
  return (Date.now() - new Date(dateStr).getTime()) / MS_PER_DAY <= days
}

/** Stable key extractor for useAnimatedList — module-level so the hook's memos can skip work */
const getMenuItemKey = (item: MenuItem) => item.variant

/** URL of a beer's can-rotation sprite sheet, or undefined. PNG and WebP
 *  sheets qualify (sheets upload as WebP, but Payload's formatOptions may
 *  re-encode to .png server-side): pre-sprite records still hold a .webm in
 *  labelVideo, which can't be a CSS background image, so those fall through
 *  to the still image until the label is regenerated in the admin. */
function spriteSheetUrl(labelVideo: unknown): string | undefined {
  const url = getMediaUrl(labelVideo)
  return url && /\.(png|webp)($|\?)/i.test(url) ? url : undefined
}

/** Convert Payload menu items to display-ready MenuItem format */
function convertMenuItems(menuData: Menu, labelVideos = false): MenuItem[] {
  if (!menuData?.items) return []

  const location = typeof menuData.location === 'object' ? menuData.location : null
  const locationSlug = location?.slug

  const items = menuData.items
    .map((item, index) => {
      // Try to extract beer first
      const beer = extractBeerFromMenuItem(item)

      // If not a beer, check if it's a product
      if (!beer) {
        const prod = extractProductFromMenuItem(item)
        if (prod) {
          const productOptions = prod.options ?? []

          return {
            variant: String(prod.id || `product-${index}`),
            name: String(prod.name || 'Unknown Product'),
            type: productOptions.join(', '),
            options: productOptions,
            otherCategory: prod.category || undefined,
            abv: prod.abv ? String(prod.abv) : '',
            description: String(prod.description || ''),
            glutenFree: false,
            imageUrl: undefined,
            glass: 'pint',
            fourPack: String(prod.price || item.price || ''),
            recipe: 0,
            hops: undefined,
            tap: index + 1,
            pricing: {
              draftPrice: parsePrice(item.price) ?? parsePrice(prod.price),
            },
            availability: {
              hideFromSite: false,
            },
            slug: String(prod.id || `product-${index}`),
            style: undefined,
            locationSlug: locationSlug ? String(locationSlug) : undefined,
            justReleased: false,
            guestTap: prod.guestTap || false,
            collab: prod.collab || false,
            createdAt: prod.createdAt,
            isProduct: true,
          }
        }
        // Empty slot — no product assigned (represents an empty tap)
        return {
          variant: `empty-${index}`,
          name: '',
          type: '',
          abv: '',
          description: '',
          glutenFree: false,
          glass: 'pint',
          tap: index + 1,
          pricing: {},
          availability: { hideFromSite: false },
          isEmpty: true,
        }
      }

      if (!beer.slug) return null

      const style = typeof beer.style === 'object' ? beer.style : null
      const styleName = style?.name || (typeof beer.style === 'string' ? beer.style : '')

      return {
        variant: String(beer.slug),
        name: String(beer.name || ''),
        type: String(styleName || ''),
        abv: beer.abv ? String(beer.abv) : '0',
        description: String(beer.description || ''),
        glutenFree: false,
        imageUrl: getMediaUrl(beer.image, 'card'),
        // Gated here (not per render site) so public pages never even carry
        // the sprite-sheet URL; CanCard animates it iff present.
        labelVideoUrl: labelVideos ? spriteSheetUrl(beer.labelVideo) : undefined,
        glass: String(beer.glass || 'pint'),
        fourPack: beer.fourPack
          ? String(beer.fourPack)
          : item.price
            ? String(item.price)
            : undefined,
        bottlePrice: beer.bottlePrice ? String(beer.bottlePrice) : undefined,
        recipe: beer.recipe || 0,
        hops: beer.hops ? String(beer.hops) : undefined,
        tap: index + 1, // 1-based tap/draft number from position in menu
        pricing: {
          draftPrice: parsePrice(item.price) ?? beer.draftPrice,
          halfPour: beer.halfPour ?? undefined,
          halfPourOnly: beer.halfPourOnly || false,
        },
        availability: {
          hideFromSite: beer.hideFromSite || false,
        },
        slug: String(beer.slug),
        style: styleName, // Pass as string, not object
        locationSlug: locationSlug ? String(locationSlug) : undefined,
        // Store these for badge logic (collab overrides "just released")
        justReleased: beer.justReleased || false,
        collab: beer.collab || false,
        collabBrewery: beer.collabBrewery || undefined,
        createdAt: beer.createdAt,
        untappdRating: beer.untappdRating ?? null,
        topBeerDrops: beer.topBeerDrops || undefined,
      }
    })
    .filter((item): item is NonNullable<typeof item> => item !== null && !item.isEmpty)

  // "Just Released" logic:
  // 1. If any beer GLOBALLY has justReleased manually set, only mark those
  // 2. Otherwise, mark beers created within the last 2 weeks
  // Check global flag from menu data (set by server), fall back to local check
  const hasGlobalJustReleased = (menuData as { _hasGlobalJustReleased?: boolean })
    ._hasGlobalJustReleased
  const hasManualJustReleased = hasGlobalJustReleased ?? items.some((i) => i.justReleased)

  return items.map((item) => ({
    ...item,
    isJustReleased: hasManualJustReleased ? item.justReleased : isWithinDays(item.createdAt, 7),
  }))
}

/** Filter items by location (returns all if 'all' or unspecified) */
function filterByLocation(items: MenuItem[], currentLocation: string): MenuItem[] {
  if (!currentLocation || currentLocation === 'all') return items
  return items.filter((item) => item.locationSlug === currentLocation)
}

/** Admin edit buttons for each menu location */
function AdminEditButtons({
  menusArray,
  currentLocation,
}: {
  menusArray: Menu[]
  currentLocation: string
}) {
  const { isAuthenticated } = useAuth()
  if (!isAuthenticated) return null

  return (
    <div className="flex gap-2">
      {menusArray.map((menuData) => {
        if (!menuData?.id) return null
        const location = typeof menuData.location === 'object' ? menuData.location : null
        const locationSlug = location?.slug
        const locationName = location?.name
        if (!locationSlug) return null
        if (currentLocation !== 'all' && currentLocation !== locationSlug) return null

        return (
          <Button key={menuData.id} asChild variant="outline" size="sm">
            <a
              href={`/admin/collections/menus/${menuData.id}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Pencil className="h-4 w-4 mr-1" />
              {currentLocation === 'all' ? `Edit ${locationName}` : 'Edit'}
            </a>
          </Button>
        )
      })}
    </div>
  )
}

/** Can card component for cans display */
function CanCard({
  item,
  fullscreen = false,
  accentColor,
}: {
  item: MenuItem
  fullscreen?: boolean
  accentColor?: string
}) {
  const badgeLabel = getBeerBadgeLabel(item)
  const [imageError, setImageError] = useState(false)

  // Fallback content when no image or image failed to load
  const renderFallback = (heightClass?: string) => (
    <div
      className={`flex items-center justify-center ${heightClass || 'h-full'}`}
      role="img"
      aria-label={`${item.name} - ${item.type || 'Craft beer'}`}
    >
      <div className="text-center px-4">
        <div className="text-2xl font-bold text-muted-foreground/70 mb-2">{item.name}</div>
        <div className="text-sm text-muted-foreground/70">{item.type}</div>
      </div>
    </div>
  )

  // Shared image rendering logic
  const renderImage = (heightClass?: string) => {
    // Baked can rotation available: animate the sprite sheet with CSS. It's an
    // alpha PNG driven by a steps() sweep — NOT a <video> — because the menu
    // TVs (Samsung Frame, Tizen browser) decode only one video at a time and
    // don't composite WebM alpha, so a grid of <video> cans showed one can plus
    // black rectangles. See canSpriteAnimation / CAN_SPRITE. The flex wrapper
    // centers the portrait frame the way object-contain did for the video.
    if (item.labelVideoUrl) {
      return (
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="h-full w-auto max-w-full"
            style={canSpriteAnimation(item.labelVideoUrl)}
            role="img"
            aria-label={`${item.name} - ${item.type || 'Craft beer'} rotating can`}
          />
        </div>
      )
    }
    if (item.imageUrl && !imageError) {
      return (
        <Image
          src={item.imageUrl}
          alt={`${item.name} - ${item.type || 'Craft beer'} can`}
          fill
          className="object-contain"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
          onError={() => setImageError(true)}
        />
      )
    }
    return renderFallback(heightClass)
  }

  const href = `/beer/${item.variant.toLowerCase()}`
  const hidden = item.availability.hideFromSite

  if (fullscreen) {
    return (
      <BeerLinkWrapper
        href={href}
        label={item.name}
        hidden={hidden}
        className="can-tile group cursor-pointer flex flex-col h-full min-h-0"
      >
        {/* flex-1 min-h-0, not a fixed 28vh: the can takes whatever height is
            left after the text block, so a name that wraps to two lines shrinks
            the can instead of pushing the tile past the bottom of the screen. */}
        <div className="relative w-full flex-1 min-h-0 bg-transparent transition-transform duration-200 group-hover:scale-[1.02]">
          {renderImage()}
          {badgeLabel && (
            <Badge
              variant="default"
              className="absolute left-1/2 -translate-x-1/2"
              style={{ bottom: '-0.8vh', fontSize: '1.3vh' }}
            >
              {badgeLabel}
            </Badge>
          )}
        </div>
        <div
          className="flex flex-col items-center text-center flex-shrink-0"
          style={{ gap: '0.5vh', marginTop: '1.5vh' }}
        >
          {/* Deliberately no reserved second line: reserving one kept can images
              aligned when a name wrapped, but left a visible gap under every
              single-line name — which is the common case at 16:9, where nothing
              wraps. A name that does wrap now just sits its own can slightly
              lower rather than taxing all thirteen others. */}
          <h3
            className="can-tile-name font-bold leading-tight transition-colors duration-[250ms]"
            style={{ color: accentColor }}
          >
            {item.name}
          </h3>
          {/* Rating sits with the price, not the style badge: long style names
              ("Hazy India Pale Ale") plus the rating overflow narrow tiles. */}
          <div className="flex items-center" style={{ gap: '0.8vh' }}>
            <Badge variant="outline" style={{ fontSize: '1.6vh' }}>
              {item.type}
            </Badge>
            {item.topBeerDrops && (
              <TopBeerDropsLink
                url={item.topBeerDrops}
                beerName={item.name}
                className="text-foreground hover:text-primary transition-colors drop-shadow-md"
                style={{ height: '2.2vh', width: '2.2vh' }}
              />
            )}
          </div>
          {(!item.isProduct || item.fourPack || item.bottlePrice) && (
            <div className="flex items-center" style={{ gap: '0.8vh' }}>
              {!item.isProduct && (
                <UntappdRating
                  rating={item.untappdRating}
                  className="can-tile-price"
                  style={{ gap: '0.3vh' }}
                  iconStyle={{ height: '1em', width: '1em' }}
                />
              )}
              {item.fourPack && (
                <span
                  className="can-tile-price font-semibold transition-colors duration-[250ms]"
                  style={{ color: accentColor }}
                >
                  ${item.fourPack}{' '}
                  <span className="can-tile-price-sub font-semibold text-foreground-muted">
                    • Four Pack
                  </span>
                </span>
              )}
              {item.bottlePrice && (
                <span
                  className="can-tile-price font-semibold transition-colors duration-[250ms]"
                  style={{ color: accentColor }}
                >
                  ${item.bottlePrice}{' '}
                  <span className="can-tile-price-sub font-semibold text-foreground-muted">
                    • Bottle
                  </span>
                </span>
              )}
            </div>
          )}
          {item.onDraft && (
            <Badge
              variant="default"
              className="flex items-center"
              style={{ fontSize: '1.3vh', gap: '0.3vh' }}
            >
              <div style={{ height: '1.5vh', width: '1.5vh' }}>
                <GlassIcon glass={item.glass} className="w-full h-full" />
              </div>
              Pouring
            </Badge>
          )}
        </div>
      </BeerLinkWrapper>
    )
  }

  return (
    <BeerLinkWrapper
      href={href}
      label={item.name}
      hidden={hidden}
      className="group flex flex-col cursor-pointer transition-transform duration-200 hover:-translate-y-1"
    >
      <div className="relative h-64 w-full flex-shrink-0 mb-4 bg-transparent transition-transform duration-200 group-hover:scale-[1.02]">
        {renderImage()}
        {badgeLabel && (
          <Badge variant="default" className="absolute -bottom-3 left-1/2 -translate-x-1/2 text-xs">
            {badgeLabel}
          </Badge>
        )}
      </div>
      <div>
        <h3 className="text-xl font-semibold text-center mb-2">{item.name}</h3>
        {/* ABV joins the rating here. The same beer can appear in the draft
            section and in this one, and the draft row gave you ABV while the
            can card gave only a rating — the two sections disagreed about what
            a beer is. */}
        <div className="flex items-center justify-center gap-2 mb-2">
          {item.abv && <span className="text-sm font-semibold tabular-nums">{item.abv}%</span>}
          {item.abv && !item.isProduct && (item.untappdRating ?? 0) > 0 && (
            <span className="text-muted-foreground" aria-hidden>
              &middot;
            </span>
          )}
          {!item.isProduct && <UntappdRating rating={item.untappdRating} />}
        </div>
        <div className="flex items-center justify-center gap-2">
          <Badge variant="outline" className="text-xs">
            {item.type}
          </Badge>
          {item.topBeerDrops && (
            <TopBeerDropsLink
              url={item.topBeerDrops}
              beerName={item.name}
              className="h-6 w-6 text-foreground hover:text-primary transition-colors"
            />
          )}
        </div>
      </div>
      {/* No "View Details" button. The whole card is already the link, so the
          button was a second target for the same destination — and eight
          identical copies of the same two words were the loudest thing in the
          grid. */}
    </BeerLinkWrapper>
  )
}

function FeaturedMenu({
  menuType,
  menu,
  menus = NO_MENUS,
  animated = false,
  itemColors,
  hideHeader = false,
  labelVideos = false,
}: FeaturedMenuProps) {
  const { currentLocation, currentLocationData } = useLocationContext()
  const title = menuType === 'draft' ? 'Draft' : 'Cans'
  // The homepage list is filtered to one taproom, so the heading names it —
  // otherwise nothing on the page says which location you are looking at.
  const locationName = currentLocationData?.name
  const emptyMessage =
    menuType === 'draft'
      ? 'No beers on draft right now. Check back soon!'
      : 'No cans available. Check back soon for cans to take home.'

  // Convert and filter items (memoize allItems so downstream useMemo can skip work)
  const allItems = useMemo(
    () => menus.flatMap((m) => convertMenuItems(m, labelVideos)),
    [menus, labelVideos],
  )
  const filteredItems = useMemo(
    () => filterByLocation(allItems, currentLocation),
    [currentLocation, allItems],
  )
  // Fullscreen /m mode items memoized separately from the homepage chain so
  // the `menu` branch never recomputes when `menus`/location filtering changes
  const menuItems = useMemo(
    () => (menu?.items ? convertMenuItems(menu, labelVideos) : null),
    [menu, labelVideos],
  )
  const displayItems = menuItems ?? filteredItems
  // Memoized for the same reason as menuItems: the poll re-renders this
  // component every 2s, and this value changes at most once a day.
  const menuLocation = typeof menu?.location === 'object' ? (menu.location as Location) : null
  const linesCleanedText = useMemo(
    () => (menu?.type === 'draft' ? formatLinesCleanedDate(menuLocation?.linesLastCleaned) : null),
    [menu?.type, menuLocation?.linesLastCleaned],
  )

  // Animated items for live updates (only when animated prop is true)
  const animatedItems = useAnimatedList(displayItems, {
    getKey: getMenuItemKey,
    exitDuration: 500,
  })

  // Fullscreen menu mode (for /m/[menuUrl] pages)
  if (menu) {
    // Use animated items when animations are enabled
    const itemsToRender = animated
      ? animatedItems
      : displayItems.map((item) => ({ item, state: 'stable' as const, key: item.variant }))

    return (
      <section className="h-full flex flex-col bg-background overflow-hidden">
        {/* Header row with Lolev Beer, menu title, and logo aligned */}
        {!hideHeader && (
          <div
            className="flex items-center flex-shrink-0"
            style={{ padding: `${TV_SAFE_Y} ${TV_SAFE_X}`, marginBottom: '0.5vh' }}
          >
            <div className="flex-1">
              <span className="font-bold text-foreground-muted" style={{ fontSize: '4vh' }}>
                Lolev Beer
              </span>
            </div>
            <div className="flex-1 text-center">
              <h2 className="font-bold" style={{ fontSize: '4vh' }}>
                {menu?.name || title}
              </h2>
              {linesCleanedText && (
                <p
                  className="text-foreground-muted"
                  style={{ fontSize: '1.8vh', marginTop: '0.5vh' }}
                >
                  {linesCleanedText}
                </p>
              )}
            </div>
            <div className="flex-1 flex justify-end">
              <Logo className={TV_LOGO_CLASS} />
            </div>
          </div>
        )}
        {/* Bottom inset matches the header's top inset, so the last row of prices
            doesn't sit flush against the bottom bezel — and, with TV_SAFE_X on
            the sides, keeps the whole board inside a 3% overscan crop. The 1fr
            grid rows absorb it by shrinking the cans slightly. */}
        <div className="w-full flex-1 flex flex-col" style={{ padding: `0 0 ${TV_SAFE_Y} 0` }}>
          <div className="flex-1 overflow-y-auto" style={{ padding: `0 ${TV_SAFE_X}` }}>
            {itemsToRender.length > 0 ? (
              menu.type === 'other' ? (
                <OtherThingsBoard
                  items={itemsToRender}
                  animated={animated}
                  itemColors={itemColors}
                />
              ) : menuType === 'draft' ? (
                // Split items into two columns: 1-6 left, 7-12 right (column-first ordering)
                (() => {
                  const midpoint = Math.ceil(itemsToRender.length / 2)
                  const columns = [itemsToRender.slice(0, midpoint), itemsToRender.slice(midpoint)]

                  return (
                    <div
                      className="flex h-full min-w-0 max-w-none flex-col"
                      suppressHydrationWarning
                    >
                      <div
                        className="grid flex-shrink-0 grid-cols-2 font-bold uppercase tracking-wider text-[#f5f5f7]"
                        style={{
                          columnGap: TV_COLUMN_GAP,
                          marginBottom: '0.8vh',
                          fontSize: TV_TYPE.label,
                        }}
                      >
                        {columns.map((_, columnIndex) => (
                          <ColumnHeader key={columnIndex} isOtherMenu={false} />
                        ))}
                      </div>
                      <div
                        className="grid min-h-0 min-w-0 flex-1 grid-cols-1 md:grid-cols-2"
                        style={{ gap: TV_COLUMN_GAP }}
                      >
                        {columns.map((items, columnIndex) => (
                          <div key={columnIndex} className="flex h-full min-w-0 flex-col">
                            <div
                              className="flex min-h-0 min-w-0 flex-1 flex-col justify-between"
                              role="list"
                            >
                              {items.map(({ item, state, key }, idx) => (
                                <div
                                  key={key}
                                  className={`min-w-0 flex-none ${animated ? getAnimationClass(state) : ''}`}
                                  role="listitem"
                                >
                                  <DraftBeerCard
                                    beer={item as unknown as Beer}
                                    showLocation={false}
                                    showTapAndPrice
                                    showRating
                                    accentColor={itemColors?.[columnIndex * midpoint + idx]}
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })()
              ) : (
                /* Two equal 1fr rows that split the available height, rather than
                   a fixed per-tile vh budget. Tiles used to be sized 28vh image +
                   vh-scaled text; once the column count grew past ~12 cans the
                   names wrapped to two lines, each tile outgrew its fixed track,
                   and the extra height was silently clipped by the section's
                   overflow-hidden (the scroll container never saw it). Rows of
                   minmax(0,1fr) plus a flex-1 can image mean wrapping costs
                   image height instead of overflowing, at any item count. */
                <div
                  className="grid gap-x-4 max-w-none h-full"
                  style={{
                    gridTemplateColumns: `repeat(${Math.ceil(itemsToRender.length / 2)}, 1fr)`,
                    gridTemplateRows: 'repeat(2, minmax(0, 1fr))',
                    rowGap: '2vh',
                  }}
                  suppressHydrationWarning
                >
                  {itemsToRender.map(({ item, state, key }, idx) => (
                    <div
                      key={key}
                      className={`min-h-0 ${animated ? getAnimationClass(state) : ''}`}
                    >
                      <CanCard item={item} fullscreen accentColor={itemColors?.[idx]} />
                    </div>
                  ))}
                </div>
              )
            ) : (
              <Empty className="border border-dashed border-border/60 rounded-xl p-8">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    {menuType === 'draft' ? (
                      <BeerIconLucide className="h-6 w-6" />
                    ) : (
                      <Package className="h-6 w-6" />
                    )}
                  </EmptyMedia>
                  <EmptyTitle className="text-xl">
                    No {menuType === 'draft' ? 'beers' : 'cans'} available
                  </EmptyTitle>
                  <EmptyDescription className="text-muted-foreground/70">
                    {emptyMessage}
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </div>
        </div>
      </section>
    )
  }

  // Homepage section mode. The id is the scroll target for the On Tap Now card;
  // the sticky-header offset comes from html { scroll-padding-top } in globals.
  return (
    <section id={menuType} className="py-16 lg:py-24 bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal>
          <SectionHeader
            title={title}
            locationName={locationName}
            actions={<AdminEditButtons menusArray={menus} currentLocation={currentLocation} />}
          />
        </ScrollReveal>

        <div className="mb-8">
          {displayItems.length > 0 ? (
            menuType === 'draft' ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" suppressHydrationWarning>
                {displayItems.map((item, index) => (
                  <DraftBeerCard
                    key={`${item.variant}-${index}`}
                    beer={item as unknown as Beer}
                    showLocation={false}
                    showRating
                  />
                ))}
              </div>
            ) : (
              <div
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                suppressHydrationWarning
              >
                {displayItems.map((item, index) => (
                  <CanCard key={`${item.variant}-${index}`} item={item} />
                ))}
              </div>
            )
          ) : (
            <Empty className="border border-dashed border-border/60 rounded-xl p-8">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  {menuType === 'draft' ? (
                    <BeerIconLucide className="h-6 w-6" />
                  ) : (
                    <Package className="h-6 w-6" />
                  )}
                </EmptyMedia>
                <EmptyTitle className="text-xl">
                  No {menuType === 'draft' ? 'beers on draft' : 'cans available'}
                </EmptyTitle>
                <EmptyDescription className="text-muted-foreground/70">
                  {emptyMessage}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </div>

        <div className="text-center">
          <Button asChild variant="outline" size="lg">
            <Link href={beerHref('tap')}>View All Beer</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}

/** Convenience wrapper for draft beer menu */
export function FeaturedBeers(props: Omit<FeaturedMenuProps, 'menuType'>): React.ReactElement {
  return <FeaturedMenu {...props} menuType="draft" />
}

/** Convenience wrapper for cans menu */
export function FeaturedCans(props: Omit<FeaturedMenuProps, 'menuType'>): React.ReactElement {
  return <FeaturedMenu {...props} menuType="cans" />
}
