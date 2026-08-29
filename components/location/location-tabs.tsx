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

import { SegmentedControl, type SegmentedSize } from '@/components/ui/segmented-control'
import { useLocationContext } from './location-provider'

interface LocationTabsProps {
  className?: string
  /** Size of the control. Defaults to `default`; see {@link SegmentedSize}. */
  size?: SegmentedSize
}

export function LocationTabs({ className, size = 'default' }: LocationTabsProps) {
  const { currentLocation, setLocation, isClient, locations } = useLocationContext()

  // Nothing is selected until the client has resolved a location, so the server
  // render and the first client render agree and hydration stays quiet.
  // `isClient` is useState(false) + an effect, so it is false in both.
  const options = locations.map((location) => ({
    value: location.slug || location.id,
    label: location.name,
  }))

  return (
    <div className={className}>
      <SegmentedControl
        aria-label="Choose location"
        className="mx-auto"
        onValueChange={setLocation}
        options={options}
        size={size}
        value={isClient ? currentLocation : undefined}
      />
    </div>
  )
}
