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

interface LocationTabsProps {
  className?: string
  children?: ReactNode
  syncWithGlobalState?: boolean
}

const GROUP_CLASS =
  'grid w-fit mx-auto grid-cols-2 h-10 items-center justify-center rounded-sm bg-black/[0.06] p-1 gap-0.5 text-muted-foreground dark:bg-muted/40'

const ITEM_CLASS =
  'relative inline-flex items-center justify-center whitespace-nowrap rounded-sm px-4 py-1.5 text-sm font-medium cursor-pointer focus-visible:outline-none focus:outline-none transition-colors'

export function LocationTabs({
  className,
  children,
  syncWithGlobalState = false,
}: LocationTabsProps) {
  const { currentLocation, setLocation, isClient, locations } = useLocationContext()
  const layoutId = useId()
  const prefersReducedMotion = useReducedMotion()

  // Prevent hydration mismatch by not rendering until client-side
  if (!isClient) {
    return (
      <div className={cn('w-full', className)}>
        <div className="grid w-fit mx-auto grid-cols-2 h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground">
          {locations.map((location) => {
            const slug = location.slug || location.id
            return (
              <div
                key={slug}
                className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium"
              >
                {location.name}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className={cn('w-full', className)}>
      <div role="group" aria-label="Choose location" className={GROUP_CLASS}>
        <LayoutGroup>
          {locations.map((location) => {
            const slug = location.slug || location.id
            const isActive = slug === currentLocation

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
                  isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground/70',
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
