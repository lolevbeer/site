/**
 * One agenda entry for food and events lists.
 *
 * Time, title, and location stack on the center axis. A side-by-side time
 * column shoved titles off-center whenever the time string changed width
 * ("7pm" vs "5pm–8pm").
 *
 * Outbound links are visible text under the row ("Tickets ↗" for ticketing
 * sites, "Details ↗" otherwise) rather than a whole-row anchor, so a row that
 * opens a new tab says so. Events can add an "Add to calendar" .ics link and
 * a small badge (e.g. "Beer release") above the title. Both link names carry
 * the title for screen readers ("Details for Trivia", "Add Trivia to
 * calendar") so a links list can tell rows apart.
 */

'use client'

import React from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { formatTime } from '@/lib/utils/formatters'
import { safeHttpUrl } from '@/lib/utils/url-utils'

function agendaTime(time?: string, endTime?: string): string | null {
  if (!time || time.toLowerCase() === 'tbd') return null
  if (endTime && endTime.toLowerCase() !== 'tbd') {
    return `${formatTime(time)}–${formatTime(endTime)}`
  }
  return formatTime(time)
}

/** Hosts whose links sell tickets, labeled "Tickets" instead of "Details". */
const TICKET_HOSTS = ['eventbrite.', 'ticketmaster.', 'tixr.', 'dice.fm', 'seetickets.', 'ticketleap.']

function siteLabel(href: string): 'Tickets' | 'Details' {
  const host = new URL(href).hostname.toLowerCase()
  return TICKET_HOSTS.some((ticketHost) => host.includes(ticketHost)) ? 'Tickets' : 'Details'
}

const linkClass =
  'underline underline-offset-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm'

interface TimelineItemProps {
  title: string
  time?: string
  endTime?: string
  location?: string
  description?: string
  site?: string
  imageUrl?: string
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
  calendarHref,
  badge,
  className,
}: TimelineItemProps) {
  const href = safeHttpUrl(site)
  const timeDisplay = agendaTime(time, endTime)

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
      <p className="font-normal leading-tight text-balance">{title}</p>
      {location ? <p className="text-sm text-muted-foreground">{location}</p> : null}
      {description ? (
        <p className="text-sm text-muted-foreground line-clamp-1">{description}</p>
      ) : null}
      {href || calendarHref ? (
        <p className="text-sm text-muted-foreground flex gap-3 justify-center pt-0.5">
          {href ? (
            <a href={href} target="_blank" rel="noopener noreferrer" className={linkClass}>
              {siteLabel(href)} <span aria-hidden="true">↗</span>
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
