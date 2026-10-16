import { addDays, format } from 'date-fns'
import { getTodayEST } from '@/lib/utils/date'
import { formatTime } from '@/lib/utils/formatters'
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
  const through = format(addDays(new Date(`${from}T12:00:00`), 13), 'yyyy-MM-dd')
  return { from, through }
}

export function buildScheduleMessage(
  kind: 'events' | 'food',
  entries: SlackScheduleEntry[],
  from: string,
  through: string,
): Record<string, unknown> {
  const dateLabel = (date: string) =>
    format(new Date(`${date.split('T')[0]}T12:00:00`), 'EEE, MMM d')
  const heading = `Upcoming ${kind}: ${dateLabel(from)} – ${dateLabel(through)} (Pittsburgh time)`
  const sorted = [...entries].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      (a.startTime || '').localeCompare(b.startTime || '') ||
      a.location.localeCompare(b.location),
  )
  const lines = sorted.slice(0, 20).map((entry) => {
    const time = entry.startTime ? formatTime(entry.startTime) : ''
    const end = entry.endTime ? formatTime(entry.endTime) : ''
    const when = [
      dateLabel(entry.date),
      time && end ? `${time}–${end}` : time || (end ? `until ${end}` : ''),
    ]
      .filter(Boolean)
      .join(' · ')
    const title = escapeMrkdwn(slackPlainText(entry.title, 180))
    const location = escapeMrkdwn(slackPlainText(entry.location, 100))
    return `${when} — ${title} · ${location}${entry.private ? ' (Private)' : ''}`
  })
  const text = [
    heading,
    ...lines,
    ...(sorted.length === 0 ? [`No upcoming ${kind} scheduled in this period.`] : []),
    ...(sorted.length > 20
      ? [`Showing the first 20 of ${sorted.length}; see the admin panel for the full schedule.`]
      : []),
  ].join('\n')
  return {
    response_type: 'ephemeral',
    text,
    blocks: [
      { type: 'section', text: { type: 'plain_text', text: heading } },
      ...lines.map((line) => ({ type: 'section', text: { type: 'mrkdwn', text: line } })),
      ...(sorted.length === 0 || sorted.length > 20
        ? [
            {
              type: 'context',
              elements: [
                {
                  type: 'plain_text',
                  text:
                    sorted.length === 0
                      ? `No upcoming ${kind} scheduled in this period.`
                      : `Showing the first 20 of ${sorted.length}; see the admin panel for the full schedule.`,
                },
              ],
            },
          ]
        : []),
    ],
    // Names are escaped above; do not expand staff-authored URLs.
    unfurl_links: false,
    unfurl_media: false,
  }
}
