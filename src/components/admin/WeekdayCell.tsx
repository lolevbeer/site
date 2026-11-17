'use client'

/**
 * First column of a Location's weekly hours table: the day's name, and
 * "Closed" while the day has no opening or closing time (how the site reads it).
 */

import { useField } from '@payloadcms/ui'
import type { Weekday } from '@/lib/types/location'
import { capitalizeName } from '@/lib/utils/formatters'

export function WeekdayCell({ day }: { day: Weekday }) {
  const { value: open } = useField<string>({ path: `${day}.open` })
  const { value: close } = useField<string>({ path: `${day}.close` })
  return (
    // `--field-width` sizes this cell like the time fields beside it in the row.
    <div style={{ '--field-width': '20%' } as React.CSSProperties}>
      <span className="field-label">{capitalizeName(day)}</span>
      {(!open || !close) && <p style={{ margin: 0, opacity: 0.7 }}>Closed</p>}
    </div>
  )
}
