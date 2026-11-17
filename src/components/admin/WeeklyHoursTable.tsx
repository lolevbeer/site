'use client'

/**
 * A Location's weekly opening hours as one compact table: a line per day with
 * its opening and closing time, and, once the Location has a Google place ID,
 * the hours Google's listing shows for that weekday, with differences marked.
 * Edits the stored day fields (`monday.open`, `monday.close` …), which are
 * hidden from the form; a day with no times is closed.
 */

import { useField, useFormFields } from '@payloadcms/ui'
import { WEEKDAYS, type Weekday } from '@/lib/types/location'
import { clockFromStoredTime, storedTimeFromClock } from '@/lib/utils/date'
import { capitalizeName, formatOpenHours } from '@/lib/utils/formatters'
import { describeFailure, useGooglePlace } from './google-place-lookup'

const NOTE = { margin: '4px 0 0' }
const CELL = {
  padding: '2px 12px 2px 0',
  textAlign: 'left' as const,
  whiteSpace: 'nowrap' as const,
}
const INPUT = {
  font: 'inherit',
  padding: '2px 6px',
  border: '1px solid var(--theme-elevation-150)',
  borderRadius: 'var(--style-radius-s)',
  background: 'var(--theme-input-bg)',
  color: 'var(--theme-text)',
}
const ERROR = { color: 'var(--theme-error-500)' }

/** One stored time of one day, edited as a clock time in the taproom's zone. */
function TimeInput({ path, timezone, label }: { path: string; timezone: string; label: string }) {
  const { value, setValue } = useField<string | null>({ path })
  return (
    <input
      type="time"
      aria-label={label}
      style={INPUT}
      value={clockFromStoredTime(value, timezone)}
      onChange={(event) => setValue(storedTimeFromClock(event.target.value, timezone))}
    />
  )
}

function DayRow(props: { day: Weekday; timezone: string; site: string; google?: string }) {
  const { day, timezone, site, google } = props
  const name = capitalizeName(day)
  const { setValue: setOpen } = useField<string | null>({ path: `${day}.open` })
  const { setValue: setClose } = useField<string | null>({ path: `${day}.close` })
  const differs = google !== undefined && google !== site
  return (
    <tr>
      <th scope="row" style={CELL}>
        {name}
      </th>
      <td style={CELL}>
        <TimeInput path={`${day}.open`} timezone={timezone} label={`${name} opens`} />
      </td>
      <td style={CELL}>
        <TimeInput path={`${day}.close`} timezone={timezone} label={`${name} closes`} />
      </td>
      <td style={CELL}>
        {site === 'Closed' ? (
          'Closed'
        ) : (
          <button
            type="button"
            className="btn--style-none"
            style={{
              cursor: 'pointer',
              textDecoration: 'underline',
              background: 'none',
              border: 0,
            }}
            onClick={() => {
              setOpen(null)
              setClose(null)
            }}
          >
            Mark closed
          </button>
        )}
      </td>
      {google !== undefined && (
        <td style={{ ...CELL, ...(differs ? ERROR : undefined) }}>
          {google}
          {differs && <span aria-label="differs from this page"> ✗</span>}
        </td>
      )}
    </tr>
  )
}

export function WeeklyHoursTable() {
  const { value: timezoneValue } = useField<string>({ path: 'timezone' })
  const timezone = timezoneValue || 'America/New_York'
  const { value: placeIdValue } = useField<string>({ path: 'address.googlePlaceId' })
  const placeId = placeIdValue?.trim() ?? ''
  const fields = useFormFields(([formFields]) => formFields)
  const lookup = useGooglePlace(placeId)
  const week = lookup?.ok ? lookup.week : undefined

  const rows = WEEKDAYS.map((day) => ({
    day,
    site: formatOpenHours(
      {
        open: fields[`${day}.open`]?.value as string | undefined,
        close: fields[`${day}.close`]?.value as string | undefined,
      },
      timezone,
    ),
    google: week?.[day],
  }))
  const differing = week ? rows.filter((row) => row.site !== row.google).length : 0

  let googleNote: React.ReactNode
  if (!placeId) {
    googleNote =
      'Add a Google place ID (Visitor information → Address & map) to compare with Google.'
  } else if (!lookup) {
    googleNote = 'Comparing with Google…'
  } else if (!lookup.ok) {
    googleNote = <span style={ERROR}>{describeFailure(lookup)}</span>
  } else if (differing) {
    googleNote = (
      <span style={ERROR}>
        {differing} {differing === 1 ? 'day differs' : 'days differ'} from Google&apos;s regular
        hours.
      </span>
    )
  } else {
    googleNote = (
      <span style={{ color: 'var(--theme-success-500)' }}>
        ✓ Matches Google&apos;s regular hours.
      </span>
    )
  }

  return (
    <div style={{ marginBottom: 16, overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={CELL}>Day</th>
            <th style={CELL}>Opens</th>
            <th style={CELL}>Closes</th>
            <th style={CELL} aria-label="Closed" />
            {week && <th style={CELL}>Google</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <DayRow key={row.day} timezone={timezone} {...row} />
          ))}
        </tbody>
      </table>
      <p role="status" style={NOTE}>
        {googleNote}
      </p>
    </div>
  )
}
