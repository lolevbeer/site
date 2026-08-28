/**
 * Location Tabs Component
 * Segmented control for switching the active brewery location.
 *
 * Deliberately NOT tab semantics. These controls switch a global location
 * filter and own no tab panel, so Radix `Tabs` emitted
 * `aria-controls="radix-…-content-<slug>"` pointing at a `TabsContent` that was
 * never rendered anywhere in the app — a dangling reference that failed axe's
 * aria-valid-attr-value (critical). Buttons with `aria-pressed` describe what
 * these actually are, and leave every option reachable by Tab rather than
 * behind Radix's roving tabindex.
 *
 * The selected pill is one absolutely-positioned element moved with a CSS
 * `translateX`, NOT a framer-motion `layoutId` shared-layout animation. Shared
 * layout measures document-space boxes, and this control lives in a
 * `position: sticky` header, so any scroll during the animation is read as real
 * displacement: switching location from a homepage tile (which also hash-jumps
 * the page) sent the pill on a measured 2,367px vertical excursion and a
 * 1,332px single-frame snap before settling. A transform transition has nothing
 * to mis-measure — it also rides out the header's own height transition, and
 * does not overshoot the way the old spring (stiffness 400 / damping 30, ζ=0.75)
 * did on every plain click.
 */

'use client'

import { type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { useLocationContext } from './location-provider'

/** `sm` is for tight rows — the mobile header shares one line with the logo
 *  mark and the hamburger. `default` is the full-size control. */
export type SegmentedSize = 'sm' | 'default'

interface LocationTabsProps {
  className?: string
  children?: ReactNode
  syncWithGlobalState?: boolean
  /** Size of the control. Defaults to `default`; see {@link SegmentedSize}. */
  size?: SegmentedSize
}

/** Shape and colour of the segmented control, shared with other surfaces that
 *  offer the same location choice (see QuickInfoCards). Layout — sizing, column
 *  count — stays with each call site, which is why size is a prop rather than a
 *  breakpoint baked in here. */
export const SEGMENTED_TROUGH_CLASS =
  'rounded-sm bg-black/[0.06] p-1 gap-0.5 text-muted-foreground dark:bg-muted/40'
export const SEGMENTED_ITEM_SELECTED_CLASS = 'bg-background text-foreground'
export const SEGMENTED_ITEM_IDLE_CLASS = 'text-muted-foreground hover:text-foreground/70'

/** Pixel values of the trough's `p-1` and `gap-0.5` above. The pill is
 *  positioned by `calc()`, so it needs them as numbers. */
const TROUGH_PADDING_PX = 4
const TROUGH_GAP_PX = 2

const GROUP_CLASS = cn(
  'relative grid w-fit mx-auto grid-cols-2 items-center justify-center',
  SEGMENTED_TROUGH_CLASS,
)

const GROUP_SIZE_CLASS: Record<SegmentedSize, string> = {
  sm: 'h-9',
  default: 'h-10',
}

const ITEM_CLASS =
  'relative inline-flex items-center justify-center whitespace-nowrap rounded-sm py-1.5 font-medium cursor-pointer focus-visible:outline-none focus:outline-none transition-colors'

const ITEM_SIZE_CLASS: Record<SegmentedSize, string> = {
  sm: 'px-2.5 text-xs',
  default: 'px-4 text-sm',
}

export function LocationTabs({
  className,
  children,
  syncWithGlobalState = false,
  size = 'default',
}: LocationTabsProps) {
  const { currentLocation, setLocation, isClient, locations } = useLocationContext()

  // Nothing is selected until the client has resolved a location, so the server
  // render and the first client render agree and hydration stays quiet.
  // `isClient` is useState(false) + an effect, so it is false in both.
  const activeIndex = isClient
    ? locations.findIndex((location) => (location.slug || location.id) === currentLocation)
    : -1

  const count = locations.length

  return (
    <div className={className}>
      <div
        role="group"
        aria-label="Choose location"
        className={cn(GROUP_CLASS, GROUP_SIZE_CLASS[size])}
      >
        {/* Rendered only once a location is known: mounting it already in place
            means the first appearance is not a slide in from column zero. The
            buttons are `relative` and come later in the DOM, so they paint over
            this without needing a z-index. */}
        {activeIndex >= 0 && (
          <span
            aria-hidden
            className="absolute top-1 bottom-1 left-1 rounded-sm bg-background transition-transform duration-200 ease-out motion-reduce:transition-none"
            style={{
              width: `calc((100% - ${TROUGH_PADDING_PX * 2}px - ${(count - 1) * TROUGH_GAP_PX}px) / ${count})`,
              transform: `translateX(calc(${activeIndex * 100}% + ${activeIndex * TROUGH_GAP_PX}px))`,
            }}
          />
        )}
        {locations.map((location, index) => {
          const slug = location.slug || location.id
          const isActive = index === activeIndex

          return (
            <button
              key={slug}
              type="button"
              aria-pressed={isActive}
              onClick={() => {
                if (syncWithGlobalState) setLocation(slug)
              }}
              className={cn(
                ITEM_CLASS,
                ITEM_SIZE_CLASS[size],
                isActive ? 'text-foreground' : SEGMENTED_ITEM_IDLE_CLASS,
              )}
            >
              {location.name}
            </button>
          )
        })}
      </div>
      {children}
    </div>
  )
}
