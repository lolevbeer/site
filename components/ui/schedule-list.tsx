/**
 * Day-grouped agenda for food and events. Server-safe: only serializable
 * props are passed into client TimelineItem rows. Groups are sorted by date
 * so callers do not have to pre-sort.
 */
import { TimelineItem } from '@/components/ui/timeline-item'
import { formatDayLabel, isToday, isTodayOrFuture } from '@/lib/utils/formatters'

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
}: {
  items: ScheduleListItem[]
  headingLevel?: 2 | 3
}) {
  const days = groupItemsByDate(items)
  const Heading = headingLevel === 2 ? 'h2' : 'h3'
  // Highlight the next calendar day with entries, not a retained past group.
  const upcomingDate = days.find(([date]) => isTodayOrFuture(date))?.[0]

  return (
    <ol className="text-left list-none p-0 m-0">
      {days.map(([dateKey, dayItems], groupIndex) => (
        <li key={dateKey} className={groupIndex > 0 ? 'mt-5' : undefined}>
          <Heading
            className={`text-base tracking-tight mb-1 ${isToday(dateKey) ? 'font-bold' : 'font-semibold'}`}
          >
            {formatDayLabel(dateKey)}
            {dateKey === upcomingDate && !isToday(dateKey) && (
              <>
                {' '}
                <span className="ml-2 text-xs font-medium text-muted-foreground">Up next</span>
              </>
            )}
          </Heading>
          <ul className="space-y-1 list-none p-0 m-0">
            {sortByTime(dayItems).map((item) => (
              <li key={item.id}>
                <TimelineItem
                  title={item.title}
                  time={item.time || undefined}
                  endTime={item.endTime || undefined}
                  location={item.locationName}
                  description={item.description}
                  site={item.site}
                  imageUrl={item.imageUrl}
                />
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  )
}
