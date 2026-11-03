/**
 * One agenda entry for food and events lists.
 *
 * Time, title, and location stack on the center axis. A side-by-side time
 * column shoved titles off-center whenever the time string changed width
 * ("7pm" vs "5pm–8pm").
 *
 * Event rows pass `detailHref` (their /events/<id> page), and the title links
 * there in the same tab; the event page carries any non-ticket site. Without
 * it (food rows), a row with a site links its title (new tab, marked by an
 * external-link icon). Either way the title is the link rather than the whole
 * row, so "Add to calendar" stays its own link. Ticketing sites also get a
 * visible "Tickets ↗" link, since buying is news the title doesn't carry.
 * Events can add an "Add to calendar" .ics link and a small badge (e.g.
 * "Beer release") above the title. Link names carry the
 * title for screen readers ("Tickets for Trivia", "Add Trivia to calendar")
 * so a links list can tell rows apart.
 */

'use client'

import React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { ExternalLink } from '@/components/icons'
import { formatTimeRange } from '@/lib/utils/formatters'
import { isTicketLink, safeHttpUrl } from '@/lib/utils/url-utils'

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm'
const linkClass = cn('underline underline-offset-2 hover:text-foreground', focusRing)
const titleClass = 'font-normal leading-tight text-balance'

interface TimelineItemProps {
  title: string
  time?: string
  endTime?: string
  location?: string
  description?: string
  site?: string
  imageUrl?: string
  /**
   * Same-origin event page (`/events/<id>`); events only. When set, the title
   * links here in the same tab and a non-ticket `site` is not linked from the
   * row (the event page shows it). A ticket site keeps its "Tickets ↗" link.
   */
  detailHref?: string
  /** Same-origin .ics download; events only. */
  calendarHref?: string
  /** Short label shown as a badge above the title, e.g. "Beer release". */
  badge?: string
  className?: string
}

export function TimelineItem({
  title,
  time,
  endTime,
  location,
  description,
  site,
  imageUrl,
  detailHref,
  calendarHref,
  badge,
  className,
}: TimelineItemProps) {
  const href = safeHttpUrl(site)
  const ticketHref = href && isTicketLink(href) ? href : undefined
  const timeDisplay = formatTimeRange(time, endTime)

  return (
    <div className={cn('flex flex-col items-center text-center py-2 gap-0.5', className)}>
      {imageUrl ? (
        <span className="relative h-10 w-10 shrink-0 rounded-full overflow-hidden bg-muted mb-1">
          <Image src={imageUrl} alt="" fill className="object-cover" sizes="40px" />
        </span>
      ) : null}
      {timeDisplay ? (
        <p className="text-sm text-muted-foreground tabular-nums">{timeDisplay}</p>
      ) : null}
      {badge ? (
        <Badge variant="outline" className="border-highlight text-highlight mb-0.5">
          {badge}
        </Badge>
      ) : null}
      {/* The title links to the event page, else to a non-ticket site (tickets get "Tickets ↗" below). */}
      {detailHref ? (
        <Link
          href={detailHref}
          className={cn(titleClass, 'underline-offset-2 hover:underline', focusRing)}
        >
          {title}
        </Link>
      ) : href && !ticketHref ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(titleClass, 'underline-offset-2 hover:underline', focusRing)}
        >
          {title}
          <ExternalLink
            aria-hidden="true"
            className="inline size-3.5 ml-1 align-baseline text-muted-foreground"
          />
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      ) : (
        <p className={titleClass}>{title}</p>
      )}
      {location ? <p className="text-sm text-muted-foreground">{location}</p> : null}
      {description ? (
        <p className="text-sm text-muted-foreground line-clamp-1">{description}</p>
      ) : null}
      {ticketHref || calendarHref ? (
        <p className="text-sm text-muted-foreground flex gap-3 justify-center pt-0.5">
          {ticketHref ? (
            <a href={ticketHref} target="_blank" rel="noopener noreferrer" className={linkClass}>
              Tickets <span aria-hidden="true">↗</span>
              <span className="sr-only"> for {title} (opens in a new tab)</span>
            </a>
          ) : null}
          {calendarHref ? (
            // nofollow: one .ics per event has no search value.
            <a
              href={calendarHref}
              rel="nofollow"
              aria-label={`Add ${title} to calendar`}
              className={linkClass}
            >
              Add to calendar
            </a>
          ) : null}
        </p>
      ) : null}
    </div>
  )
}

export default TimelineItem
