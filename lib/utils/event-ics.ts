/**
 * Builds a single-event iCalendar (.ics) file for "Add to calendar" on
 * /events. Times are Pittsburgh wall-clock under TZID America/New_York, with
 * a VTIMEZONE block so every client applies the right DST offset. The CMS
 * description is internal (staff-only), so the file carries no DESCRIPTION.
 * Text is escaped, `site` must be http(s), and long lines are folded.
 */
import { eventPageUrl, parseEventTime } from '@/lib/utils/json-ld'
import { safeHttpUrl } from '@/lib/utils/url-utils'
import { addEstDays } from '@/lib/utils/formatters'

const TZID = 'America/New_York'

/** US Eastern rules since 2007: DST from the 2nd Sunday of March to the 1st Sunday of November. */
const VTIMEZONE = [
  'BEGIN:VTIMEZONE',
  `TZID:${TZID}`,
  'BEGIN:DAYLIGHT',
  'TZOFFSETFROM:-0500',
  'TZOFFSETTO:-0400',
  'TZNAME:EDT',
  'DTSTART:20070311T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU',
  'END:DAYLIGHT',
  'BEGIN:STANDARD',
  'TZOFFSETFROM:-0400',
  'TZOFFSETTO:-0500',
  'TZNAME:EST',
  'DTSTART:20071104T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU',
  'END:STANDARD',
  'END:VTIMEZONE',
]

export interface IcsEventInput {
  id: string
  /** Public event title. */
  organizer: string
  date: string
  startTime?: string | null
  endTime?: string | null
  site?: string | null
  locationSlug?: string
  locationName?: string
  address?: string
}

function escapeText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\r\n?|\n/g, '\\n')
    .replace(/([,;])/g, '\\$1')
}

/** RFC 5545 §3.1: split lines over 75 octets, continuing with CRLF + space, never mid-character. */
function foldLine(line: string): string {
  const encoder = new TextEncoder()
  const parts: string[] = []
  let current = ''
  let octets = 0
  for (const char of line) {
    const size = encoder.encode(char).length
    // Continuation lines spend one octet on the leading space.
    if (octets + size > (parts.length === 0 ? 75 : 74)) {
      parts.push(current)
      current = ''
      octets = 0
    }
    current += char
    octets += size
  }
  parts.push(current)
  return parts.join('\r\n ')
}

/** "2026-10-14" plus whole days, as YYYYMMDD. */
function dayStamp(dateKey: string, addDays = 0): string {
  return addEstDays(dateKey, addDays).replace(/-/g, '')
}

function wallTime(minutesFromMidnight: number): string {
  const h = Math.floor(minutesFromMidnight / 60)
  const m = minutesFromMidnight % 60
  return `T${String(h).padStart(2, '0')}${String(m).padStart(2, '0')}00`
}

function utcStamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

function hasTime(time?: string | null): time is string {
  return Boolean(time) && time!.toLowerCase() !== 'tbd'
}

/**
 * One VCALENDAR with one VEVENT. A missing or TBD start is all-day; a missing
 * end defaults to two hours; an end at or before the start rolls to the next
 * day (a 9pm–1am show ends the following morning).
 */
export function buildEventIcs(event: IcsEventInput, now: Date = new Date()): string {
  const dateKey = event.date.split('T')[0]
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Lolev Beer//Events//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH']

  const timing: string[] = []
  if (hasTime(event.startTime)) {
    lines.push(...VTIMEZONE)
    const start = parseEventTime(event.startTime)
    const startMinutes = start.hours * 60 + start.minutes
    let endMinutes = startMinutes + 120
    if (hasTime(event.endTime)) {
      const end = parseEventTime(event.endTime)
      endMinutes = end.hours * 60 + end.minutes
      if (endMinutes <= startMinutes) endMinutes += 24 * 60
    }
    const endDayOffset = Math.floor(endMinutes / (24 * 60))
    timing.push(
      `DTSTART;TZID=${TZID}:${dayStamp(dateKey)}${wallTime(startMinutes)}`,
      `DTEND;TZID=${TZID}:${dayStamp(dateKey, endDayOffset)}${wallTime(endMinutes % (24 * 60))}`,
    )
  } else {
    timing.push(`DTSTART;VALUE=DATE:${dayStamp(dateKey)}`, `DTEND;VALUE=DATE:${dayStamp(dateKey, 1)}`)
  }

  const place = [event.locationName ? `Lolev Beer - ${event.locationName}` : 'Lolev Beer', event.address]
    .filter(Boolean)
    .join(', ')

  lines.push(
    'BEGIN:VEVENT',
    `UID:event-${event.id}@lolev.beer`,
    `DTSTAMP:${utcStamp(now)}`,
    ...timing,
    `SUMMARY:${escapeText(event.organizer)}`,
    `LOCATION:${escapeText(place)}`,
    // safeHttpUrl rejects non-http values; URL serialization percent-encodes CR/LF.
    `URL:${safeHttpUrl(event.site) ?? eventPageUrl(event.locationSlug, event.id)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  )

  return `${lines.map(foldLine).join('\r\n')}\r\n`
}
