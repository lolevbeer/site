'use client'

/**
 * Heading whose text shows the current location and doubles as a button that
 * cycles to the next location. Single source of truth for the click-to-cycle
 * titles used on the homepage sections (via SectionHeader) and the Food/Events
 * pages.
 */

interface LocationCycleTitleProps {
  /** Visible heading text, already including the location, e.g. "Food at Lawrenceville". */
  title: string
  /** Cycle to the next location. */
  onCycle: () => void
  /** Heading element to render (defaults to h2). */
  as?: 'h1' | 'h2'
  /** Classes applied to the heading element. */
  className?: string
}

export function LocationCycleTitle({
  title,
  onCycle,
  as: Tag = 'h2',
  className,
}: LocationCycleTitleProps) {
  return (
    <Tag className={className}>
      <button
        type="button"
        onClick={onCycle}
        title="Switch location"
        aria-label={`${title} — switch location`}
        className="cursor-pointer transition-colors hover:text-primary"
      >
        {title}
      </button>
    </Tag>
  )
}
