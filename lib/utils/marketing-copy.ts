/**
 * Builds the plain-text "#marketing" copy (draft list, cans list, upcoming
 * events, food and releases) on the server.
 *
 * The copy is staff tooling, shown by components/home/marketing-text.tsx when
 * the homepage URL hash is `#marketing`. Building it here means the client
 * receives a few KB of strings instead of the full menus, event and food
 * schedules it used to get as props (~33 KB of RSC payload on every homepage
 * view, hydrated by every visitor for a view almost none of them open).
 */

import type {
  ComingSoon,
  Event as PayloadEvent,
  Location as PayloadLocation,
  Menu,
} from '@/src/payload-types'
import { getLocationDisplayName } from '@/lib/config/locations'
import { formatAbv } from './formatters'
import { extractBeerFromMenuItem } from './menu-item-utils'

export interface MarketingSection {
  /** Bold-Unicode heading, e.g. "𝗟𝗔𝗪𝗥𝗘𝗡𝗖𝗘𝗩𝗜𝗟𝗟𝗘 - 𝗢𝗡 𝗗𝗥𝗔𝗙𝗧". */
  heading: string
  lines: string[]
}

export interface MarketingCopy {
  /** One section per location. */
  draft: MarketingSection[]
  /** One section per location. */
  cans: MarketingSection[]
  /** Events per location, then food per location, then beer releases. */
  upcoming: MarketingSection[]
}

/** Minimal food shape covering both PayloadFood and RecurringFoodEntry. */
export interface MarketingFood {
  vendor: string | { name?: string; id?: string }
  date: string
  time?: string
}

type ComingSoonEntry = NonNullable<ComingSoon['beers']>[number]

export interface MarketingCopyInput {
  locations: PayloadLocation[]
  draftMenusByLocation: Record<string, Menu | null>
  cansMenusByLocation: Record<string, Menu | null>
  eventsByLocation: Record<string, PayloadEvent[]>
  foodByLocation: Record<string, MarketingFood[]>
  comingSoonBeers: ComingSoonEntry[]
  /** "Today" for the upcoming filters; defaults to now. */
  now?: Date
}

const BOLD_OFFSET_UPPER = 0x1d5d4 - 'A'.charCodeAt(0)
const BOLD_OFFSET_LOWER = 0x1d5ee - 'a'.charCodeAt(0)

/** Sans-serif bold Unicode letters, so the heading stays bold when pasted into social posts. */
export function toBoldUnicode(text: string): string {
  return Array.from(text, (char) => {
    if (char >= 'A' && char <= 'Z') return String.fromCodePoint(char.charCodeAt(0) + BOLD_OFFSET_UPPER)
    if (char >= 'a' && char <= 'z') return String.fromCodePoint(char.charCodeAt(0) + BOLD_OFFSET_LOWER)
    return char
  }).join('')
}

/** Upcoming entries from today on, soonest first, at most ten. */
const UPCOMING_LIMIT = 10

function menuLines(menu: Menu | null): string[] {
  return (menu?.items ?? []).flatMap((item) => {
    const beer = extractBeerFromMenuItem(item)
    if (!beer) return []
    const style =
      typeof beer.style === 'object' && beer.style?.name
        ? beer.style.name
        : typeof beer.style === 'string'
          ? beer.style
          : ''
    return [`${beer.name} • ${style} • ${formatAbv(beer.abv || 0)}`]
  })
}

function dayAndDate(date: Date, timeZone: string): string {
  const day = date.toLocaleDateString('en-US', { weekday: 'long', timeZone })
  const monthDay = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone })
  return `${day}, ${monthDay}`
}

function eventLine(event: PayloadEvent, timeZone: string): string {
  let time = ''
  if (event.startTime && typeof event.startTime === 'string') {
    // startTime from Payload is an ISO string where only the time matters
    if (event.startTime.includes('T')) {
      const parsed = new Date(event.startTime)
      if (!isNaN(parsed.getTime())) {
        time = ` (${parsed.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone })})`
      }
    } else {
      time = ` (${event.startTime.trim()})`
    }
  }
  return `${dayAndDate(new Date(event.date), timeZone)} • ${event.organizer || 'Event'}${time}`
}

function foodLine(food: MarketingFood, timeZone: string): string {
  const vendor = typeof food.vendor === 'object' ? food.vendor?.name : food.vendor
  const time = food.time ? ` (${food.time})` : ''
  return `${dayAndDate(new Date(food.date), timeZone)} • ${vendor}${time}`
}

function upcoming<T extends { date: string }>(entries: T[], today: Date): T[] {
  return entries
    .filter((entry) => new Date(entry.date) >= today)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, UPCOMING_LIMIT)
}

function releaseLine(entry: ComingSoonEntry): string {
  if (typeof entry.beer === 'object' && entry.beer?.name) return entry.beer.name
  if (typeof entry.style === 'object' && entry.style?.name) return entry.style.name
  return 'Coming Soon'
}

export function buildMarketingCopy(input: MarketingCopyInput): MarketingCopy {
  const { locations } = input
  const today = new Date(input.now ?? Date.now())
  today.setHours(0, 0, 0, 0)

  const name = (slug: string) => getLocationDisplayName(locations, slug).toUpperCase()
  const timeZone = (slug: string) =>
    locations.find((loc) => loc.slug === slug || loc.id === slug)?.timezone || 'America/New_York'
  const section = (heading: string, lines: string[]): MarketingSection => ({
    heading: toBoldUnicode(heading),
    lines,
  })

  const draft = Object.entries(input.draftMenusByLocation).map(([slug, menu]) =>
    section(`${name(slug)} - ON DRAFT`, menuLines(menu)),
  )
  const cans = Object.entries(input.cansMenusByLocation).map(([slug, menu]) =>
    section(`${name(slug)} - CANS`, menuLines(menu)),
  )

  const events = Object.entries(input.eventsByLocation).flatMap(([slug, list]) => {
    const soon = upcoming(list, today)
    if (soon.length === 0) return []
    const tz = timeZone(slug)
    return [section(`${name(slug)} - UPCOMING EVENTS`, soon.map((event) => eventLine(event, tz)))]
  })
  const food = Object.entries(input.foodByLocation).flatMap(([slug, list]) => {
    const soon = upcoming(list, today)
    if (soon.length === 0) return []
    const tz = timeZone(slug)
    return [section(`${name(slug)} - UPCOMING FOOD`, soon.map((entry) => foodLine(entry, tz)))]
  })
  const releases =
    input.comingSoonBeers.length > 0
      ? [section('UPCOMING BEER RELEASES', input.comingSoonBeers.map(releaseLine))]
      : []

  return { draft, cans, upcoming: [...events, ...food, ...releases] }
}
