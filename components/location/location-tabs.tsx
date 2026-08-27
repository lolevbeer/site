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
 */

'use client'

import { useId, type ReactNode } from 'react'
import { LayoutGroup, motion, useReducedMotion } from 'framer-motion'
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

const GROUP_CLASS = cn(
  'grid w-fit mx-auto grid-cols-2 items-center justify-center',
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
  const layoutId = useId()
  const prefersReducedMotion = useReducedMotion()

  return (
    <div className={className}>
      <div
        role="group"
        aria-label="Choose location"
        className={cn(GROUP_CLASS, GROUP_SIZE_CLASS[size])}
      >
        <LayoutGroup>
          {locations.map((location) => {
            const slug = location.slug || location.id
            // Nothing is selected until the client has resolved a location, so
            // the server render and the first client render agree and hydration
            // stays quiet. `isClient` is useState(false) + an effect, so it is
            // false in both.
            const isActive = isClient && slug === currentLocation

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
                {isActive &&
                  (prefersReducedMotion ? (
                    <div className="absolute inset-0 rounded-sm bg-background" />
                  ) : (
                    <motion.div
                      layoutId={layoutId}
                      className="absolute inset-0 rounded-sm bg-background"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  ))}
                <span className="relative z-10">{location.name}</span>
              </button>
            )
          })}
        </LayoutGroup>
      </div>
      {children}
    </div>
  )
}
