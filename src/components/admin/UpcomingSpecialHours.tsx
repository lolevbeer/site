'use client'

/**
 * On a Location's Hours tab: the upcoming Special Hours entries for this
 * taproom, which override the weekly hours on their day, with a link to add
 * one. Read through the REST API as the viewer, like the dashboard widgets.
 */

import { useEffect, useState } from 'react'
import { useConfig, useDocumentInfo, useField } from '@payloadcms/ui'
import type { HolidayHour } from '@/src/payload-types'
import { getTodayEST } from '@/lib/utils/date'
import { formatOpenHours } from '@/lib/utils/formatters'

type Entry = Pick<HolidayHour, 'id' | 'name' | 'date' | 'type' | 'hours'>

const NOTE = { margin: '4px 0 0' }

/** "Thu, Nov 26" for a stored Special Hours date (noon UTC on the day). */
const dayLabel = (date: string) =>
  new Date(`${date.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })

export function UpcomingSpecialHours() {
  const { id } = useDocumentInfo()
  const { value: timezone } = useField<string>({ path: 'timezone' })
  const adminRoute = useConfig().config.routes.admin
  const [entries, setEntries] = useState<Entry[] | 'failed' | null>(null)

  useEffect(() => {
    if (!id) return
    const query = new URLSearchParams({
      depth: '0',
      limit: '20',
      sort: 'date',
      'where[locations][contains]': String(id),
      'where[date][greater_than_equal]': getTodayEST(),
    })
    let current = true
    fetch(`/api/holiday-hours?${query}`, { credentials: 'include' })
      .then((response) => (response.ok ? response.json() : Promise.reject(response.status)))
      .then((body: { docs: Entry[] }) => current && setEntries(body.docs))
      .catch(() => current && setEntries('failed'))
    return () => {
      current = false
    }
  }, [id])

  // A new Location has no Special Hours yet, and they need its ID.
  if (!id) return null
  const collection = `${adminRoute}/collections/holiday-hours`

  return (
    <div style={{ marginBlock: 16 }}>
      <span className="field-label">Upcoming Special Hours</span>
      {entries === null && <p style={NOTE}>Loading…</p>}
      {entries === 'failed' && (
        <p role="alert" style={{ ...NOTE, color: 'var(--theme-error-500)' }}>
          Could not load Special Hours.
        </p>
      )}
      {Array.isArray(entries) && entries.length === 0 && (
        <p style={NOTE}>None. The weekly hours apply every day.</p>
      )}
      {Array.isArray(entries) && entries.length > 0 && (
        <ul style={{ margin: '4px 0', paddingLeft: 20 }}>
          {entries.map((entry) => (
            <li key={entry.id}>
              <a href={`${collection}/${entry.id}`}>
                {dayLabel(entry.date)}:{' '}
                {entry.type === 'closed' ? 'Closed' : formatOpenHours(entry.hours, timezone)}
              </a>{' '}
              ({entry.name})
            </li>
          ))}
        </ul>
      )}
      <a href={`${collection}/create`}>Add Special Hours</a>
    </div>
  )
}
