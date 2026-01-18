'use client'

import { useMemo } from 'react'
import { useEventsStream } from '@/lib/hooks/use-events-stream'
import { Logo } from '@/components/ui/logo'
import type { BreweryEvent } from '@/lib/types/event'
import randomColor from 'randomcolor'

interface LiveEventsProps {
  location: string
  initialEvents: BreweryEvent[]
  initialLocationName: string
}

// Light mode CSS variables
const lightVars = {
  '--color-background': '#ffffff',
  '--color-foreground': '#1d1d1f',
  '--color-foreground-muted': '#6e6e73',
  '--color-card': '#ffffff',
  '--color-card-foreground': '#1d1d1f',
  '--color-primary': '#1d1d1f',
  '--color-primary-foreground': '#ffffff',
  '--color-secondary': '#f5f5f7',
  '--color-secondary-foreground': '#1d1d1f',
  '--color-muted': '#f2f2f2',
  '--color-muted-foreground': '#86868b',
  '--color-border': '#d2d2d7',
} as React.CSSProperties

// Dark mode CSS variables
const darkVars = {
  '--color-background': '#000000',
  '--color-foreground': '#f5f5f7',
  '--color-foreground-muted': '#acacae',
  '--color-card': '#1d1d1f',
  '--color-card-foreground': '#f5f5f7',
  '--color-primary': '#ffffff',
  '--color-primary-foreground': '#000000',
  '--color-secondary': '#2c2c2e',
  '--color-secondary-foreground': '#f5f5f7',
  '--color-muted': '#2c2c2e',
  '--color-muted-foreground': '#98989d',
  '--color-border': '#38383a',
} as React.CSSProperties

/**
 * Format date for display
 */
function formatEventDate(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const eventDate = new Date(date)
  eventDate.setHours(0, 0, 0, 0)

  if (eventDate.getTime() === today.getTime()) {
    return 'Today'
  }
  if (eventDate.getTime() === tomorrow.getTime()) {
    return 'Tomorrow'
  }

  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
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

/**
 * Event card for large display
 */
function EventCard({ event, accentColor }: { event: BreweryEvent; accentColor?: string }) {
  const dateDisplay = formatEventDate(event.date)
  const timeDisplay = formatTime(event.time)
  const isToday = dateDisplay === 'Today'
  const isTomorrow = dateDisplay === 'Tomorrow'

  return (
    <div className="w-full text-center" style={{ padding: '1.5vh 2vw' }}>
      <div className="flex items-center justify-center flex-wrap" style={{ gap: '1.5vh' }}>
        <h3
          className="font-bold leading-tight transition-colors duration-500"
          style={{ fontSize: '3vh', color: accentColor }}
        >
          {event.title}
        </h3>
        <span
          className={`font-semibold ${isToday ? 'text-primary' : isTomorrow ? 'text-amber-500' : 'text-foreground-muted'}`}
          style={{ fontSize: '2.2vh' }}
        >
          {dateDisplay}{timeDisplay && ` @ ${timeDisplay}`}
        </span>
      </div>
      {event.description && event.description !== event.title && (
        <p className="text-foreground-muted line-clamp-1" style={{ fontSize: '1.8vh', marginTop: '0.3vh' }}>
          {event.description}
        </p>
      )}
    </div>
  )
}

/**
 * Live-updating events display component for large displays
 */
export function LiveEvents({ location, initialEvents, initialLocationName }: LiveEventsProps) {
  const { events, locationName, theme, pollCount } = useEventsStream(
    location,
    initialEvents,
    initialLocationName,
    {
      enabled: true,
      pollInterval: 5000,
    }
  )

  // Generate random light colors that cycle every ~30 seconds (dark mode only)
  const colorSeed = Math.floor(pollCount / 6)
  const itemColors = useMemo(() => {
    const itemCount = events.length
    if (itemCount === 0 || theme !== 'dark') return undefined

    return randomColor({
      count: itemCount,
      luminosity: 'light',
      seed: colorSeed,
    })
  }, [events.length, theme, colorSeed])

  const themeVars = theme === 'dark' ? darkVars : lightVars

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-background text-foreground" style={themeVars}>
      <section className="h-full flex flex-col bg-background overflow-hidden">
        {/* Header row with Lolev Beer, title, and logo aligned */}
        <div className="flex items-center justify-between flex-shrink-0" style={{ padding: '2vh 1vw', marginBottom: '0.5vh' }}>
          <span className="font-bold text-foreground-muted" style={{ fontSize: '4vh' }}>Lolev Beer</span>
          <div className="text-center">
            <h2 className="font-bold" style={{ fontSize: '4vh' }}>
              Upcoming Events
            </h2>
            <p className="text-foreground-muted" style={{ fontSize: '2vh' }}>
              {locationName}
            </p>
          </div>
          <Logo width={48} height={52} />
        </div>
        <div className="w-full flex-1 flex flex-col" style={{ padding: '0 0 0.5vh 0' }}>

          <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center" style={{ padding: '0 1vw' }}>
            {events.length > 0 ? (
              <div className="flex flex-col items-center w-full max-w-4xl">
                {events.map((event, idx) => (
                  <EventCard
                    key={event.id || idx}
                    event={event}
                    accentColor={itemColors?.[idx]}
                  />
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <p className="text-foreground-muted" style={{ fontSize: '2.5vh' }}>
                    No upcoming events scheduled
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
