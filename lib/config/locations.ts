/**
 * Location configuration and utilities
 * Locations are now dynamically loaded from the database
 */

import {
  type PayloadLocation,
  type LocationSlug,
  type DayHours,
  type Weekday,
  WEEKDAYS,
} from '@/lib/types/location'
import { getCurrentESTDateTime } from '@/lib/utils/date'
import { formatHoursTime } from '@/lib/utils/formatters'

/**
 * LocalStorage key for persisting user's location preference
 */
export const LOCATION_STORAGE_KEY = 'brewery-location-preference'

/** Location slugs that would collide with App Router static segments. */
export const RESERVED_LOCATION_SLUGS = new Set([
  'about',
  'accessibility',
  'admin',
  'api',
  'beer',
  'beer-map',
  'e',
  'events',
  'faq',
  'food',
  'm',
  'privacy',
  'terms',
])

/**
 * Format a Payload time field as `HH:mm` in the location timezone.
 * Shared by open/closed checks and LocalBusiness openingHoursSpecification.
 */
export function formatHourMinute(time: string, timezone: string): string {
  if (!time.includes('T')) return time.slice(0, 5)
  const date = new Date(time)
  if (Number.isNaN(date.getTime())) return '00:00'
  try {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: timezone,
    })
  } catch {
    return '00:00'
  }
}

/**
 * Extract hours from Payload Location for a specific day
 * Parses ISO time strings in the location's timezone for proper comparison
 */
export function extractDayHours(location: PayloadLocation, day: Weekday): DayHours | null {
  const dayData = location[day] as { open?: string; close?: string } | undefined

  if (!dayData?.open || !dayData?.close) {
    return null
  }

  const timezone = location.timezone || 'America/New_York'

  return {
    open: formatHourMinute(dayData.open, timezone),
    close: formatHourMinute(dayData.close, timezone),
    closed: false,
  }
}

/** One-line hours summary for FAQ / llms.txt, grouped by identical open/close. */
export function formatHoursFaqAnswer(locations: PayloadLocation[]): string {
  if (locations.length === 0) {
    return 'Hours vary by location and holiday. See lolev.beer for this week\'s hours.'
  }
  const parts = locations.map((location) => {
    const groups: { label: string; hours: string }[] = []
    for (const day of WEEKDAYS) {
      const hours = getFormattedHoursForDay(location, day)
      const label = day.charAt(0).toUpperCase() + day.slice(1, 3)
      const last = groups[groups.length - 1]
      if (last && last.hours === hours) {
        last.label = `${last.label.split('–')[0]}–${label}`
      } else {
        groups.push({ label, hours })
      }
    }
    const summary = groups.map((g) => `${g.label} ${g.hours}`).join(', ')
    return `${location.name} is ${summary}`
  })
  return `${parts.join('. ')}. Holiday hours may differ — this week's hours are listed in the footer of every page.`
}

/** "Lawrenceville and Zelienople" from live location docs — never a hardcoded list. */
export function joinLocationNames(
  locations: Array<{ name?: string | null }>,
): string {
  const names = locations
    .map((location) => location.name?.trim())
    .filter((name): name is string => Boolean(name))
  if (names.length === 0) return ''
  if (names.length === 1) return names[0]
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`
}

export function formatLocationsFaqAnswer(locations: PayloadLocation[]): string {
  if (locations.length === 0) {
    return 'We have taprooms in the Pittsburgh area. See lolev.beer for addresses.'
  }
  const parts = locations.map((location) => {
    const street = location.address?.street
    const city = location.address?.city
    const state = location.address?.state
    const zip = location.address?.zip
    const address = [street, [city, state].filter(Boolean).join(', '), zip].filter(Boolean).join(', ')
    return `${location.name} at ${address || 'see lolev.beer'}`
  })
  return `We have ${locations.length} locations: ${parts.join('; ')}.`
}

/**
 * Check if a location is currently open based on current time
 */
export function isLocationOpenNow(location: PayloadLocation, date?: Date): boolean {
  const now = date || getCurrentESTDateTime()
  const days: Weekday[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const dayOfWeek = days[now.getDay()]

  const dayHours = extractDayHours(location, dayOfWeek)

  if (!dayHours || dayHours.closed) {
    return false
  }

  const currentTime = now.getHours() * 100 + now.getMinutes()
  const openTime = parseInt(dayHours.open.replace(':', ''))
  let closeTime = parseInt(dayHours.close.replace(':', ''))

  // Handle midnight closing (00:00) - treat as 24:00 (2400)
  if (closeTime === 0) {
    closeTime = 2400
  }

  // If closing time is less than opening time, it crosses midnight
  if (closeTime < openTime) {
    return currentTime >= openTime || currentTime <= closeTime
  }

  return currentTime >= openTime && currentTime < closeTime
}

/**
 * Get formatted hours string for a specific day
 */
export function getFormattedHoursForDay(location: PayloadLocation, day: Weekday): string {
  const dayHours = extractDayHours(location, day)

  if (!dayHours || dayHours.closed) {
    return 'Closed'
  }

  return `${formatHoursTime(dayHours.open)} - ${formatHoursTime(dayHours.close)}`
}

/**
 * Get next opening time for a location
 */
export function getNextOpeningTimeForLocation(
  location: PayloadLocation,
): { day: string; time: string } | null {
  const now = getCurrentESTDateTime()
  const days: Weekday[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

  for (let i = 1; i <= 7; i++) {
    const dayIndex = (now.getDay() + i) % 7
    const dayName = days[dayIndex]
    const dayHours = extractDayHours(location, dayName)

    if (dayHours && !dayHours.closed) {
      const dayDisplayName = dayName.charAt(0).toUpperCase() + dayName.slice(1)
      return {
        day: i === 1 ? 'Tomorrow' : dayDisplayName,
        time: getFormattedHoursForDay(location, dayName),
      }
    }
  }

  return null
}

/**
 * Get all hours for a location as an array
 */
export function getAllHoursForLocation(location: PayloadLocation): Array<{
  day: string
  hours: string
  isToday: boolean
}> {
  const today = new Date()
  const todayIndex = today.getDay()
  const todayName: Weekday = (
    ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const
  )[todayIndex]

  return WEEKDAYS.map((day) => ({
    day: day.charAt(0).toUpperCase() + day.slice(1),
    hours: getFormattedHoursForDay(location, day),
    isToday: day === todayName,
  }))
}

/**
 * Get the default location slug (first active location)
 */
export function getDefaultLocationSlug(locations: PayloadLocation[]): LocationSlug {
  const activeLocations = locations.filter((loc) => loc.active !== false)
  return activeLocations[0]?.slug || activeLocations[0]?.id || ''
}

/**
 * Find a location by slug from an array of locations
 */
export function findLocationBySlug(
  locations: PayloadLocation[],
  slug: LocationSlug,
): PayloadLocation | undefined {
  return locations.find((loc) => loc.slug === slug || loc.id === slug)
}

/**
 * Validate if a slug is a valid location
 */
export function isValidLocationSlug(locations: PayloadLocation[], slug: string): boolean {
  return locations.some((loc) => loc.slug === slug || loc.id === slug)
}

/**
 * Get display name for a location slug
 */
export function getLocationDisplayName(locations: PayloadLocation[], slug: LocationSlug): string {
  const location = findLocationBySlug(locations, slug)
  return location?.name || slug
}
