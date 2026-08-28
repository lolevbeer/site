'use client'

import { useMemo } from 'react'
import Image from 'next/image'
import { useEventsStream } from '@/lib/hooks/use-events-stream'
import { Logo } from '@/components/ui/logo'
import { FeaturedCans } from '@/components/home/featured-menu'
import type { BreweryEvent } from '@/lib/types/event'
import type { FoodItem } from '@/src/app/(frontend)/e/[location]/page'
import type { PayloadMenu } from '@/lib/utils/payload-api'
import randomColor from 'randomcolor'
import { getThemeVars } from '@/lib/utils/display-theme'
import { getTodayEST, toESTDate } from '@/lib/utils/date'
import { format } from 'date-fns'
import { formatTime } from '@/lib/utils/formatters'
import { TV_TYPE, TV_SAFE_X, TV_SAFE_Y, TV_LOGO_CLASS, TV_BADGE_STYLE } from '@/lib/config/tv-display'
import { Music, Utensils, Puzzle, Trophy, Beer, MicVocal, type LucideIcon } from 'lucide-react'

const tagIcons: Record<string, LucideIcon> = {
  music: Music,
  utensils: Utensils,
  puzzle: Puzzle,
  sports: Trophy,
  'beer-release': Beer,
  'mic-vocal': MicVocal,
}

interface LiveEventsProps {
  location: string
  initialEvents: BreweryEvent[]
  initialFood?: FoodItem[]
  cansMenu?: PayloadMenu | null
  initialLocationName: string
}

/** Weekday and date for the agenda's day rail, e.g. "Fri" over "Aug 28".
 *
 *  `isToday` is passed in rather than derived here: the caller already knows
 *  which day is today from a single comparison, and deriving it per label
 *  meant recomputing "today" for every group on every poll.
 *
 *  Dates arrive from Payload as `YYYY-MM-DD`, so comparing them against
 *  `getTodayEST()` as plain strings orders and matches them correctly without
 *  building any Date — which is why callers compare directly rather than going
 *  through a helper. The EST anchor matters: these boards are in Pittsburgh but
 *  the server renders in UTC, so using the browser's `new Date()` let the two
 *  sides disagree about the calendar day for five hours every evening, breaking
 *  hydration and mismarking "Today". */
function formatDayLabel(dateStr: string, isToday: boolean): { weekday: string; day: string } {
  const date = toESTDate(dateStr)
  return {
    weekday: isToday ? 'Today' : format(date, 'EEE'),
    day: format(date, 'MMM d'),
  }
}

interface AgendaEntry {
  key: string
  /** Raw `HH:MM` / ISO time, kept only for ordering within a day. */
  sortTime: string
  /** Display time, or "Kitchen" / "All day" when there is no clock time. */
  time: string
  name: string
  kind: 'Food' | 'Event'
  logoUrl?: string
  tags?: string[]
  description?: string
  /** Position in the combined list, which is what indexes the poll's colours. */
  colorIndex: number
}

function AgendaRow({
  time,
  name,
  kind,
  logoUrl,
  tags,
  description,
  accentColor,
}: {
  time: string
  name: string
  kind: 'Food' | 'Event'
  logoUrl?: string
  tags?: string[]
  description?: string
  accentColor?: string
}) {
  return (
    <div className="flex items-baseline w-full" style={{ gap: '2vh' }}>
      {/* Fixed width, right-aligned: times line up as a column whatever their
          length, and "Kitchen" sits where a clock time would. */}
      <span
        className="flex-shrink-0 text-right font-semibold text-foreground-muted tabular-nums"
        style={{ width: '14vh', fontSize: TV_TYPE.eventTime }}
      >
        {time}
      </span>
      <div className="flex items-baseline min-w-0 flex-grow" style={{ gap: '1.5vh' }}>
        {/* One fixed-width slot for whichever mark this row has — a vendor photo,
            a tag icon, or nothing. Reserving the width unconditionally is what
            gives every name the same left edge: a 4vh food logo and a 3vh event
            icon otherwise started their names 8.5px apart. */}
        <span
          className="flex-shrink-0 self-center flex items-center justify-center"
          style={{ width: '4vh', height: '4vh' }}
          aria-hidden
        >
          {logoUrl ? (
            <span className="relative rounded-full overflow-hidden bg-muted w-full h-full">
              <Image src={logoUrl} alt="" fill className="object-cover" sizes="48px" />
            </span>
          ) : (
            tags?.map((tag) => {
              const Icon = tagIcons[tag]
              return Icon ? (
                <Icon key={tag} style={{ width: '3vh', height: '3vh', color: accentColor }} />
              ) : null
            })
          )}
        </span>
        <h3
          className="font-bold leading-tight truncate transition-colors duration-500"
          style={{ fontSize: TV_TYPE.eventName, color: accentColor }}
        >
          {name}
        </h3>
        {/* A word, not a second icon language. Food used to be a photo
            thumbnail and events a line icon, which made the same vendor look
            like two unrelated things on adjacent rows. */}
        <span
          className="flex-shrink-0 uppercase tracking-wider font-bold text-foreground-muted border border-border rounded"
          style={{ fontSize: TV_TYPE.label, ...TV_BADGE_STYLE, borderRadius: '0.5vh' }}
        >
          {kind}
        </span>
        {description && (
          <span className="truncate text-foreground-muted" style={{ fontSize: TV_TYPE.body }}>
            {description}
          </span>
        )}
      </div>
    </div>
  )
}

/**
 * Live-updating events display component for large displays
 */
export function LiveEvents({
  location,
  initialEvents,
  initialFood = [],
  cansMenu,
  initialLocationName,
}: LiveEventsProps) {
  const { events, locationName, theme, pollCount } = useEventsStream(
    location,
    initialEvents,
    initialLocationName,
    {
      enabled: true,
      pollInterval: 5000,
    },
  )

  // Combine events and food into a single sorted list
  type DisplayItem = { type: 'event'; data: BreweryEvent } | { type: 'food'; data: FoodItem }
  const combinedItems = useMemo(() => {
    const today = getTodayEST()
    const items: DisplayItem[] = [
      ...events.map((e) => ({ type: 'event' as const, data: e })),
      ...initialFood.map((f) => ({ type: 'food' as const, data: f })),
    ]
    return (
      items
        // The page query filters by date, but this board is left running for
        // days: without a client-side check, everything before today stays on
        // screen after midnight, above the row marked "Today".
        .filter((i) => i.data.date >= today)
        .sort((a, b) => a.data.date.localeCompare(b.data.date))
        .slice(0, 10)
    )
  }, [events, initialFood])

  /** The items grouped by calendar day, each already resolved to exactly what a
   *  row renders. Grouping is what makes the board answerable at a glance —
   *  "what's on Friday" was previously ten unaligned rows to read — and it also
   *  resolves the pairs that looked like duplicate data: a truck and the event
   *  it is cooking for now sit under one day instead of appearing as two
   *  near-identical rows. Within a day, the kitchen comes first, then events in
   *  time order.
   *
   *  Flattening an event or a food truck into one shape here, rather than
   *  branching at the call site, keeps the two row variants from drifting and
   *  lets each row carry the colour index it was assigned — the render used to
   *  recover that with `combinedItems.indexOf(item)` per row, an O(n) scan
   *  inside an O(n) loop, repeated on every five-second poll for the life of
   *  the display. */
  const dayGroups = useMemo(() => {
    const today = getTodayEST()
    const byDate = new Map<string, AgendaEntry[]>()

    combinedItems.forEach((item, colorIndex) => {
      const entry: AgendaEntry =
        item.type === 'event'
          ? {
              key: `event-${item.data.id || colorIndex}`,
              sortTime: item.data.time || '',
              time: item.data.time ? formatTime(item.data.time) : 'All day',
              name: item.data.title,
              kind: 'Event',
              tags: item.data.tags,
              // A description that only repeats the title adds nothing.
              description:
                item.data.description !== item.data.title ? item.data.description : undefined,
              colorIndex,
            }
          : {
              key: `food-${item.data.id || colorIndex}`,
              sortTime: item.data.time || '',
              time: item.data.time ? formatTime(item.data.time) : 'Kitchen',
              name: item.data.vendor,
              kind: 'Food',
              logoUrl: item.data.logoUrl,
              colorIndex,
            }

      const list = byDate.get(item.data.date)
      if (list) list.push(entry)
      else byDate.set(item.data.date, [entry])
    })

    return [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, items]) => ({
        date,
        isToday: date === today,
        // Untimed entries (the kitchen) lead the day, then everything by time.
        items: items.sort((a, b) => {
          if (!a.sortTime !== !b.sortTime) return a.sortTime ? 1 : -1
          return a.sortTime.localeCompare(b.sortTime)
        }),
      }))
  }, [combinedItems])

  // Dynamic title based on content
  const hasEvents = events.length > 0
  const hasFood = initialFood.length > 0

  let title: string
  if (hasEvents && hasFood) {
    title = 'Upcoming Food & Events'
  } else if (hasFood) {
    title = 'Upcoming Food'
  } else if (hasEvents) {
    title = 'Upcoming Events'
  } else if (cansMenu) {
    title = 'Cans'
  } else {
    title = 'Upcoming Events'
  }

  // Generate random light colors that cycle every ~30 seconds (dark mode only)
  const colorSeed = Math.floor(pollCount / 6)
  const itemColors = useMemo(() => {
    const itemCount = combinedItems.length
    if (itemCount === 0 || theme !== 'dark') return undefined

    return randomColor({
      count: itemCount,
      luminosity: 'light',
      seed: colorSeed,
    })
  }, [combinedItems.length, theme, colorSeed])

  const themeVars = getThemeVars(theme)

  return (
    <div
      className="h-screen w-screen overflow-hidden flex flex-col bg-background text-foreground"
      style={themeVars}
    >
      <section className="h-full flex flex-col bg-background overflow-hidden">
        {/* Header row with Lolev Beer, title, and logo aligned */}
        <div
          className="flex items-center flex-shrink-0"
          style={{ padding: `${TV_SAFE_Y} ${TV_SAFE_X}`, marginBottom: '0.5vh' }}
        >
          <div className="flex-1">
            <span className="font-bold text-foreground-muted" style={{ fontSize: '4vh' }}>
              Lolev Beer
            </span>
          </div>
          <div className="flex-1 text-center">
            <h2 className="font-bold" style={{ fontSize: '4vh' }}>
              {title}
            </h2>
            <p
              className="text-foreground-muted"
              style={{ fontSize: TV_TYPE.body, marginTop: '0.5vh' }}
            >
              {locationName}
            </p>
          </div>
          <div className="flex-1 flex justify-end">
            <Logo className={TV_LOGO_CLASS} />
          </div>
        </div>
        <div className="w-full flex-1 flex flex-col" style={{ padding: `0 0 ${TV_SAFE_Y} 0` }}>
          <div
            className="flex-1 overflow-y-auto flex flex-col"
            style={{ padding: `0 ${TV_SAFE_X}` }}
          >
            {dayGroups.length > 0 ? (
              /* One row per day: a fixed day rail, then that day's items. The
                 rail width is what gives every name and time a single left
                 edge — the old layout centred each row independently. */
              <div className="flex flex-col justify-evenly h-full w-full">
                {dayGroups.map((group) => {
                  const { weekday, day } = formatDayLabel(group.date, group.isToday)
                  return (
                    <div
                      key={group.date}
                      className="flex w-full border-t border-border"
                      style={{ gap: '2vh', paddingTop: '1.2vh', paddingBottom: '1.2vh' }}
                    >
                      <div
                        className={`flex-shrink-0 uppercase tracking-wider font-bold leading-tight ${
                          group.isToday ? 'text-amber-500' : 'text-foreground-muted'
                        }`}
                        style={{ width: '16vh', fontSize: TV_TYPE.eventDay }}
                      >
                        <div>{weekday}</div>
                        <div>{day}</div>
                      </div>
                      <div className="flex flex-col flex-grow min-w-0" style={{ gap: '1vh' }}>
                        {group.items.map((item) => (
                          <AgendaRow
                            key={item.key}
                            time={item.time}
                            name={item.name}
                            kind={item.kind}
                            tags={item.tags}
                            logoUrl={item.logoUrl}
                            description={item.description}
                            accentColor={itemColors?.[item.colorIndex]}
                          />
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : cansMenu ? (
              <FeaturedCans menu={cansMenu} hideHeader />
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <p className="text-foreground-muted" style={{ fontSize: '2.5vh' }}>
                    No upcoming food or events scheduled
                  </p>
                  <p
                    className="text-foreground-muted"
                    style={{ fontSize: '1.8vh', marginTop: '1vh' }}
                  >
                    Check back soon!
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
