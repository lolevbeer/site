'use client'

/**
 * Under a Location's weekly hours: the same week as Google's listing shows it,
 * with the days that differ marked, so a mismatch is fixed before the nightly
 * check finds it. Follows the form as it is edited; Google is asked once.
 */

import { useField, useFormFields } from '@payloadcms/ui'
import { WEEKDAYS } from '@/lib/types/location'
import { capitalizeName, formatOpenHours } from '@/lib/utils/formatters'
import { describeFailure, useGooglePlace } from './google-place-lookup'

const NOTE = { margin: '4px 0 0' }
const CELL = { padding: '4px 12px 4px 0', textAlign: 'left' as const }

export function GoogleWeekCompare() {
  const { value: placeId } = useField<string>({ path: 'address.googlePlaceId' })
  const { value: timezone } = useField<string>({ path: 'timezone' })
  const fields = useFormFields(([formFields]) => formFields)
  const result = useGooglePlace(placeId?.trim() ?? '')

  if (!placeId?.trim()) {
    return (
      <p style={NOTE}>
        Add a Google place ID (Visitor information → Address & map) to compare these hours with
        Google.
      </p>
    )
  }
  if (!result) return <p style={NOTE}>Comparing with Google…</p>
  if (!result.ok) {
    return (
      <p role="alert" style={{ ...NOTE, color: 'var(--theme-error-500)' }}>
        {describeFailure(result)}
      </p>
    )
  }

  const rows = WEEKDAYS.map((day) => {
    const site = formatOpenHours(
      {
        open: fields[`${day}.open`]?.value as string | undefined,
        close: fields[`${day}.close`]?.value as string | undefined,
      },
      timezone,
    )
    return { day, site, google: result.week[day] }
  })
  const differing = rows.filter((row) => row.site !== row.google).length

  return (
    <div style={{ marginTop: 16 }}>
      <p
        role="status"
        style={{
          ...NOTE,
          color: differing ? 'var(--theme-error-500)' : 'var(--theme-success-500)',
        }}
      >
        {differing
          ? `${differing} ${differing === 1 ? 'day differs' : 'days differ'} from Google's regular hours.`
          : "✓ Matches Google's regular hours."}
      </p>
      <table style={{ borderCollapse: 'collapse', marginTop: 8 }}>
        <thead>
          <tr>
            <th style={CELL}>Day</th>
            <th style={CELL}>This page</th>
            <th style={CELL}>Google</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ day, site, google }) => {
            const differs = site !== google
            return (
              <tr key={day} style={differs ? { color: 'var(--theme-error-500)' } : undefined}>
                <td style={CELL}>{capitalizeName(day)}</td>
                <td style={CELL}>{site}</td>
                <td style={CELL}>
                  {google}
                  {differs && <span aria-label="differs"> ✗</span>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
