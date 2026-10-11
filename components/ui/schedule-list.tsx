/**
 * Day-grouped agenda for food and events. Server-safe: only serializable
 * props are passed into client TimelineItem rows. Groups are sorted by date
 * so callers do not have to pre-sort. Day headings say "Today"/"Tomorrow"
 * only after mount (ScheduleDayHeading), so cached HTML never mislabels a day.
 */
import { TimelineItem } from '@/components/ui/timeline-item'
import { ScheduleDayHeading } from '@/components/ui/schedule-day-heading'

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
}: {
  items: ScheduleListItem[]
  headingLevel?: 2 | 3
  /** Events only: link each row to /events/<id>/calendar.ics. */
  calendar?: boolean
}) {
  const days = groupItemsByDate(items)

  return (
    <ol className="text-center list-none p-0 m-0">
      {days.map(([dateKey, dayItems], groupIndex) => (
        <li key={dateKey} className={groupIndex > 0 ? 'mt-8' : undefined}>
          <ScheduleDayHeading dateKey={dateKey} level={headingLevel} />
          <ul className="space-y-3 list-none p-0 m-0">
            {sortByTime(dayItems).map((item) => (
              // Anchor target for shared links and the Event JSON-LD url.
              <li key={item.id} id={`event-${item.id}`} className="scroll-mt-20">
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
