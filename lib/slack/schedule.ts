/**
 * Shared pieces of the `/lolevbeer events` and `food` replies: the 14-day
 * Pittsburgh window and the ephemeral Slack message both commands render.
 */
import { formatHourMinute } from '@/lib/config/locations'
import { getTodayEST } from '@/lib/utils/date'
import { formatDate, formatTime } from '@/lib/utils/formatters'
import { addDays } from '@/lib/utils/schedule-heatmap'
import { escapeMrkdwn, slackPlainText } from '@/lib/slack/mrkdwn'

export interface SlackScheduleEntry {
  date: string
  title: string
  location: string
  startTime?: string | null
  endTime?: string | null
  private?: boolean
}

export function slackScheduleWindow() {
  const from = getTodayEST()
  return { from, through: addDays(from, 13) }
}

/** Most entries one reply lists; Slack caps a message at 50 blocks. */
const MAX_LINES = 20

/**
 * Pittsburgh `HH:mm` of a time field, for ordering. Payload stores time-only
 * fields as full UTC instants on an arbitrary reference date, so comparing the
 * raw strings does not order by time of day.
 */
const timeOfDay = (time?: string | null) => (time ? formatHourMinute(time, 'America/New_York') : '')

export function buildScheduleMessage(
  kind: 'events' | 'food',
  entries: SlackScheduleEntry[],
  from: string,
  through: string,
): Record<string, unknown> {
  const heading = `Upcoming ${kind}: ${formatDate(from)} – ${formatDate(through)} (Pittsburgh time)`
  // Decorate once: timeOfDay runs Intl per call, too slow for a comparator.
  const sorted = entries
    .map((entry) => ({ entry, time: timeOfDay(entry.startTime) }))
    .sort(
      (a, b) =>
        a.entry.date.localeCompare(b.entry.date) ||
        a.time.localeCompare(b.time) ||
        a.entry.location.localeCompare(b.entry.location),
    )
    .map(({ entry }) => entry)
  const lines = sorted.slice(0, MAX_LINES).map((entry) => {
    const time = entry.startTime ? formatTime(entry.startTime) : ''
    const end = entry.endTime ? formatTime(entry.endTime) : ''
    const span = time && end ? `${time}–${end}` : time || (end && `until ${end}`)
    const when = [formatDate(entry.date), span].filter(Boolean).join(' · ')
    const title = escapeMrkdwn(slackPlainText(entry.title, 180))
    const location = escapeMrkdwn(slackPlainText(entry.location, 100))
    return `${when} • ${title} · ${location}${entry.private ? ' (Private)' : ''}`
  })
  const footer =
    sorted.length === 0
      ? `No upcoming ${kind} scheduled in this period.`
      : sorted.length > MAX_LINES
        ? `Showing the first ${MAX_LINES} of ${sorted.length}; see the admin panel for the full schedule.`
        : null
  return {
    response_type: 'ephemeral',
    text: [heading, ...lines, ...(footer ? [footer] : [])].join('\n'),
    blocks: [
      { type: 'section', text: { type: 'plain_text', text: heading } },
      ...lines.map((line) => ({ type: 'section', text: { type: 'mrkdwn', text: line } })),
      ...(footer ? [{ type: 'context', elements: [{ type: 'plain_text', text: footer }] }] : []),
    ],
    // Names are escaped above; do not expand staff-authored URLs.
    unfurl_links: false,
    unfurl_media: false,
  }
}
