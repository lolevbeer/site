/**
 * Shared Untappd rating display component.
 * Renders the Untappd icon + formatted rating, with optional overlay styling.
 */

import { UntappdIcon } from '@/components/icons'
import { formatRating } from '@/lib/utils/formatters'
import { cn } from '@/lib/utils'

interface UntappdRatingProps {
  rating: number | null | undefined
  /** Render as a frosted-glass overlay pill (for use inside positioned containers) */
  variant?: 'inline' | 'overlay'
  className?: string
  /** Style overrides (e.g. vh-based sizing for TV displays) */
  style?: React.CSSProperties
  /** Icon style overrides for TV displays */
  iconStyle?: React.CSSProperties
  /**
   * Text to show when there is no rating, rendered with the same icon and
   * amber styling as the rating itself. If omitted, renders nothing.
   */
  fallbackText?: string
}

export function UntappdRating({
  rating,
  variant = 'inline',
  className,
  style,
  iconStyle,
  fallbackText,
}: UntappdRatingProps) {
  // No "/5" — the Untappd icon already states the scale, and on a TV board
  // those two glyphs cost width on every row.
  const text = (rating ?? 0) > 0 ? formatRating(rating) : fallbackText
  if (!text) return null

  // Normal inline flow, not flex. As a flex container with `items-end` this
  // aligned the icon by its box edge, because an SVG has no baseline for flex
  // to fall back on — so the icon ended up both taller than the digits beside
  // it and optically higher (measured on the draft board: icon ink 211.3→225.4
  // against digits ~215.4→226.8, centres 2.75px apart). Inline flow lets the
  // browser baseline the icon like a glyph: `1em` ties its size to the
  // surrounding text at any font size, and the small negative `vertical-align`
  // seats it so its optical centre matches the digits'.
  return (
    <span
      className={cn(
        'text-amber-500 text-sm whitespace-nowrap',
        variant === 'overlay' &&
          'inline-block bg-background/80 backdrop-blur-sm rounded-md px-1.5 py-0.5',
        className,
      )}
      style={style}
    >
      <UntappdIcon
        className="inline-block h-[1em] w-[1em] mr-[0.25em] align-[-0.14em]"
        style={iconStyle}
      />
      <span className="font-bold">{text}</span>
    </span>
  )
}
