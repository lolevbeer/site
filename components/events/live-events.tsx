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
import { TV_TYPE, TV_SAFE_X, TV_SAFE_Y } from '@/lib/config/tv-display'
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

/** "Today" as the taproom sees it, not as the viewer's browser does.
 *  These boards are in Pittsburgh, but the server renders in UTC — using
 *  `new Date()` on both sides meant the server and the client could disagree
 *  about the current calendar day for five hours every evening, which both
 *  broke hydration and could mark the wrong row "Today". `getTodayEST` and
 *  `toESTDate` are the same helpers the draft board's lines-cleaned date uses,
 *  so every display agrees on the date. */
function isBeforeToday(dateStr: string): boolean {
  return toESTDate(dateStr).getTime() < toESTDate(getTodayEST()).getTime()
}

function isTodayDate(dateStr: string): boolean {
  return toESTDate(dateStr).getTime() === toESTDate(getTodayEST()).getTime()
}

/** Weekday and date for the agenda's day rail, e.g. "Fri" over "Aug 28". */
function formatDayLabel(dateStr: string): { weekday: string; day: string } {
  const date = toESTDate(dateStr)
  return {
    weekday: isTodayDate(dateStr) ? 'Today' : format(date, 'EEE'),
    day: format(date, 'MMM d'),
  }
}

/**
 * Format time for display
 * Handles both ISO date strings and HH:MM format
 */
function formatTime(time: string): string {
  if (!time) return ''

  let hours: number
  let minutes: number

  // Check if it's an ISO date string
  if (time.includes('T')) {
    const date = new Date(time)
    hours = date.getHours()
    minutes = date.getMinutes()
  } else {
    // Assume HH:MM format
    const parts = time.split(':').map(Number)
    hours = parts[0]
    minutes = parts[1] || 0
  }

  const period = hours >= 12 ? 'PM' : 'AM'
  const displayHours = hours % 12 || 12

  if (minutes === 0) {
    return `${displayHours}${period}`
  }
  return `${displayHours}:${minutes.toString().padStart(2, '0')}${period}`
}

/** One row of the agenda: when it happens, what it is, and whether it is food
 *  or an event. Replaces the separate EventCard/FoodCard, which were centred —
 *  so ten rows started at ten different x positions and neither the names nor
 *  the times formed a column you could scan down. */
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
            <span
              className="relative rounded-full overflow-hidden bg-muted w-full h-full"
            >
              <Image src={logoUrl} alt="" fill className="object-cover" sizes="48px" />
            </span>
          ) : (
            tags?.map((tag) => {
              const Icon = tagIcons[tag]
              return Icon ? (
                <Icon
                  key={tag}
                  style={{ width: '3vh', height: '3vh', color: accentColor }}
                />
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
          style={{ fontSize: TV_TYPE.label, padding: '0.2vh 0.8vh' }}
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
export function LiveEvents({ location, initialEvents, initialFood = [], cansMenu, initialLocationName }: LiveEventsProps) {
  const { events, locationName, theme, pollCount } = useEventsStream(
    location,
    initialEvents,
    initialLocationName,
    {
      enabled: true,
      pollInterval: 5000,
    }
  )

  // Combine events and food into a single sorted list
  type DisplayItem = { type: 'event'; data: BreweryEvent } | { type: 'food'; data: FoodItem }
  const combinedItems = useMemo(() => {
    const items: DisplayItem[] = [
      ...events.map((e) => ({ type: 'event' as const, data: e })),
      ...initialFood.map((f) => ({ type: 'food' as const, data: f })),
    ]
    return (
      items
        // The page query filters by date, but this board is left running for
        // days: without a client-side check, everything before today stays on
        // screen after midnight, above the row marked "Today".
        .filter((i) => !isBeforeToday(i.data.date))
        .sort((a, b) => a.data.date.localeCompare(b.data.date))
        .slice(0, 10)
    )
  }, [events, initialFood])

  /** The same items grouped by calendar day. Grouping is what makes the board
   *  answerable at a glance — "what's on Friday" was previously ten unaligned
   *  rows to read — and it also resolves the pairs that looked like duplicate
   *  data: a truck and the event it is cooking for now sit under one day
   *  instead of appearing as two near-identical rows. Within a day, the
   *  kitchen comes first, then events in time order. */
  const dayGroups = useMemo(() => {
    const byDate = new Map<string, DisplayItem[]>()
    for (const item of combinedItems) {
      const list = byDate.get(item.data.date)
      if (list) list.push(item)
      else byDate.set(item.data.date, [item])
    }
    return [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, items]) => ({
        date,
        items: items.sort((a, b) => {
          const at = a.data.time ? formatTime(a.data.time) : ''
          const bt = b.data.time ? formatTime(b.data.time) : ''
          if (!at && bt) return -1
          if (at && !bt) return 1
          return (a.data.time || '').localeCompare(b.data.time || '')
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
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-background text-foreground" style={themeVars}>
      <section className="h-full flex flex-col bg-background overflow-hidden">
        {/* Header row with Lolev Beer, title, and logo aligned */}
        <div
          className="flex items-center flex-shrink-0"
          style={{ padding: `${TV_SAFE_Y} ${TV_SAFE_X}`, marginBottom: '0.5vh' }}
        >
          <div className="flex-1">
            <span className="font-bold text-foreground-muted" style={{ fontSize: '4vh' }}>Lolev Beer</span>
          </div>
          <div className="flex-1 text-center">
            <h2 className="font-bold" style={{ fontSize: '4vh' }}>
              {title}
            </h2>
            <p className="text-foreground-muted" style={{ fontSize: TV_TYPE.body, marginTop: '0.5vh' }}>
              {locationName}
            </p>
          </div>
          <div className="flex-1 flex justify-end">
            <Logo width={48} height={52} />
          </div>
        </div>
        <div className="w-full flex-1 flex flex-col" style={{ padding: `0 0 ${TV_SAFE_Y} 0` }}>

          <div className="flex-1 overflow-y-auto flex flex-col" style={{ padding: `0 ${TV_SAFE_X}` }}>
            {dayGroups.length > 0 ? (
              /* One row per day: a fixed day rail, then that day's items. The
                 rail width is what gives every name and time a single left
                 edge — the old layout centred each row independently. */
              <div className="flex flex-col justify-evenly h-full w-full">
                {dayGroups.map((group) => {
                  const { weekday, day } = formatDayLabel(group.date)
                  const today = isTodayDate(group.date)
                  return (
                    <div
                      key={group.date}
                      className="flex w-full border-t border-border"
                      style={{ gap: '2vh', paddingTop: '1.2vh', paddingBottom: '1.2vh' }}
                    >
                      <div
                        className={`flex-shrink-0 uppercase tracking-wider font-bold leading-tight ${
                          today ? 'text-amber-500' : 'text-foreground-muted'
                        }`}
                        style={{ width: '16vh', fontSize: TV_TYPE.eventDay }}
                      >
                        <div>{weekday}</div>
                        <div>{day}</div>
                      </div>
                      <div className="flex flex-col flex-grow min-w-0" style={{ gap: '1vh' }}>
                        {group.items.map((item, idx) =>
                          item.type === 'event' ? (
                            <AgendaRow
                              key={`event-${item.data.id || idx}`}
                              time={item.data.time ? formatTime(item.data.time) : 'All day'}
                              name={item.data.title}
                              kind="Event"
                              tags={item.data.tags}
                              description={
                                item.data.description !== item.data.title
                                  ? item.data.description
                                  : undefined
                              }
                              accentColor={itemColors?.[combinedItems.indexOf(item)]}
                            />
                          ) : (
                            <AgendaRow
                              key={`food-${item.data.id || idx}`}
                              time={item.data.time ? formatTime(item.data.time) : 'Kitchen'}
                              name={item.data.vendor}
                              kind="Food"
                              logoUrl={item.data.logoUrl}
                              accentColor={itemColors?.[combinedItems.indexOf(item)]}
                            />
                          ),
                        )}
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
                  <p className="text-foreground-muted" style={{ fontSize: '1.8vh', marginTop: '1vh' }}>
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
