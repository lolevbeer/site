/**
 * One agenda entry for food and events lists.
 *
 * Time, title, and location stack on the center axis. A side-by-side time
 * column shoved titles off-center whenever the time string changed width
 * ("7pm" vs "5pm–8pm").
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
    <div className={cn('flex flex-col items-center text-center py-2 gap-0.5', className)}>
      {imageUrl ? (
        <span className="relative h-10 w-10 shrink-0 rounded-full overflow-hidden bg-muted mb-1">
          <Image src={imageUrl} alt="" fill className="object-cover" sizes="40px" />
        </span>
      ) : null}
      {timeDisplay ? (
        <p className="text-sm text-muted-foreground tabular-nums">{timeDisplay}</p>
      ) : null}
      <p className="font-normal leading-tight text-balance">{title}</p>
      {location ? <p className="text-sm text-muted-foreground">{location}</p> : null}
      {description ? (
        <p className="text-sm text-muted-foreground line-clamp-1">{description}</p>
      ) : null}
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
