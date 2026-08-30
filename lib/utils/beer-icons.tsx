/**
 * Beer Icon Utilities
 * Shared utilities for beer-related icons
 */

import { PintIcon, SteinIcon, TekuIcon, UhaIcon } from '@/components/icons'
import { GlassType } from '@/lib/types/beer'

/**
 * Renders the glassware icon for a beer's glass type, falling back to a pint.
 *
 * This is a component rather than a `getGlassIcon(glass)` lookup that callers
 * assign and render themselves, and it branches to each icon directly instead
 * of resolving one into a variable. Rendering a component held in a variable
 * is indistinguishable from constructing a component during render, which is
 * what react-hooks/static-components flags — the explicit branches let React
 * (and the linter) see a fixed set of element types.
 */
export function GlassIcon({
  glass,
  className,
}: {
  glass?: GlassType | string
  className?: string
}) {
  const key = typeof glass === 'string' ? (glass.toLowerCase() as GlassType) : glass

  switch (key) {
    case GlassType.TEKU:
      return <TekuIcon className={className} />
    case GlassType.STEIN:
      return <SteinIcon className={className} />
    case GlassType.UHA:
      return <UhaIcon className={className} />
    default:
      return <PintIcon className={className} />
  }
}
