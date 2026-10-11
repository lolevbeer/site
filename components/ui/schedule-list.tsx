/**
 * Day-grouped agenda for food and events. Server-safe: only serializable
 * props are passed into client TimelineItem rows. Groups are sorted by date
 * so callers do not have to pre-sort.
 */
import { TimelineItem } from '@/components/ui/timeline-item'
import { formatDayLabel, isToday } from '@/lib/utils/formatters'

export interface ScheduleListItem {
  id: string
  date: string
  title: string
  time?: string | null
  endTime?: string | null
  site?: string
  imageUrl?: string
  locationName?: string
  description?: string
}

function groupItemsByDate(items: ScheduleListItem[]): Array<[string, ScheduleListItem[]]> {
  const groups = new Map<string, ScheduleListItem[]>()
  for (const item of items) {
    const key = item.date.split('T')[0]
    const list = groups.get(key)
    if (list) list.push(item)
    else groups.set(key, [item])
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))
}

function sortByTime(items: ScheduleListItem[]): ScheduleListItem[] {
  return items.slice().sort((a, b) => (a.time || '').localeCompare(b.time || ''))
}

export function ScheduleList({
  items,
  headingLevel = 3,
  calendar = false,
  anchors = false,
}: {
  items: ScheduleListItem[]
  headingLevel?: 2 | 3
  /** Events only: link each row to /events/<id>/calendar.ics. */
  calendar?: boolean
  /**
   * /events only: give each row an `event-<id>` anchor (see eventPageUrl) so
   * shared links and the Event JSON-LD url land on it. Ids must be URL-safe.
   */
  anchors?: boolean
}) {
  const days = groupItemsByDate(items)
  const Heading = headingLevel === 2 ? 'h2' : 'h3'

  return (
    <ol className="text-center list-none p-0 m-0">
      {days.map(([dateKey, dayItems], groupIndex) => (
        <li key={dateKey} className={groupIndex > 0 ? 'mt-8' : undefined}>
          <Heading
            className={`text-lg font-semibold tracking-tight mb-3 ${
              isToday(dateKey) ? 'text-primary' : ''
            }`}
          >
            {formatDayLabel(dateKey)}
          </Heading>
          <ul className="space-y-3 list-none p-0 m-0">
            {sortByTime(dayItems).map((item) => (
              <li
                key={item.id}
                id={anchors ? `event-${item.id}` : undefined}
                className={anchors ? 'scroll-mt-20' : undefined}
              >
                <TimelineItem
                  title={item.title}
                  time={item.time || undefined}
                  endTime={item.endTime || undefined}
                  location={item.locationName}
                  description={item.description}
                  site={item.site}
                  imageUrl={item.imageUrl}
                  calendarHref={
                    calendar ? `/events/${encodeURIComponent(item.id)}/calendar.ics` : undefined
                  }
                />
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  )
}
