/**
 * One agenda entry for food and events lists.
 *
 * A consistent time column aligns titles; missing/TBD times leave it empty.
 * Titles and supporting details wrap in the remaining width.
 */

'use client'

import React from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { formatTime } from '@/lib/utils/formatters'
import { safeHttpUrl } from '@/lib/utils/url-utils'

function agendaTime(time?: string, endTime?: string): string | null {
  if (!time || time.toLowerCase() === 'tbd') return null
  if (endTime && endTime.toLowerCase() !== 'tbd') {
    return `${formatTime(time)}–${formatTime(endTime)}`
  }
  return formatTime(time)
}

interface TimelineItemProps {
  title: string
  time?: string
  endTime?: string
  location?: string
  description?: string
  site?: string
  imageUrl?: string
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
  className,
}: TimelineItemProps) {
  const href = safeHttpUrl(site)
  const timeDisplay = agendaTime(time, endTime)

  const body = (
    <div
      className={cn(
        'grid grid-cols-[7rem_minmax(0,1fr)] items-start text-left py-2 gap-x-3',
        className,
      )}
    >
      {timeDisplay ? (
        <p className="text-sm text-muted-foreground tabular-nums break-words">{timeDisplay}</p>
      ) : (
        <span aria-hidden="true" />
      )}
      <div className="min-w-0 flex items-start gap-2 break-words">
        {imageUrl ? (
          <span className="relative block h-10 w-10 shrink-0 rounded-full overflow-hidden bg-muted">
            <Image src={imageUrl} alt="" fill className="object-cover" sizes="40px" />
          </span>
        ) : null}
        <div className="min-w-0 space-y-0.5">
          <p className="font-normal leading-snug">{title}</p>
          {location ? <p className="text-sm text-muted-foreground">{location}</p> : null}
          {description ? (
            <p className="text-sm text-muted-foreground line-clamp-2">{description}</p>
          ) : null}
        </div>
      </div>
    </div>
  )

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="block rounded-lg hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        {body}
      </a>
    )
  }

  return body
}

export default TimelineItem
