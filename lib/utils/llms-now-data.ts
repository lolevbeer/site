/**
 * Loads the current draft list, cans, food, and events for llms.txt.
 * Failures become empty lists so one taproom query cannot blank the file.
 */

import type { PayloadLocation } from '@/lib/types/location'
import { extractBeerFromMenuItem } from '@/lib/utils/menu-item-utils'
import {
  extractVendorInfo,
  getCansMenu,
  getCombinedUpcomingFood,
  getDraftMenu,
  getUpcomingEventsFromPayload,
} from '@/lib/utils/payload-api'
import type { Menu, Event as PayloadEvent, Food as PayloadFood } from '@/src/payload-types'
import { logger } from '@/lib/utils/logger'
import { formatPouringNow, type LlmsNowLocation } from '@/lib/utils/llms-now'

function dayKey(value: string | null | undefined): string {
  if (!value) return ''
  return value.split('T')[0]
}

function beerNames(menu: Menu | null): string[] {
  return (menu?.items ?? [])
    .map((item) => extractBeerFromMenuItem(item)?.name?.trim() || '')
    .filter(Boolean)
}

async function loadOrEmpty<T>(label: string, load: () => Promise<T>, empty: T): Promise<T> {
  try {
    return await load()
  } catch (error) {
    logger.error(`llms.txt ${label} failed`, error)
    return empty
  }
}

function namedOn(
  name: string | null | undefined,
  date: string | null | undefined,
): { name: string; date: string }[] {
  const trimmed = name?.trim()
  if (!trimmed) return []
  return [{ name: trimmed, date: dayKey(date) }]
}

function foodRows(
  entries: Awaited<ReturnType<typeof getCombinedUpcomingFood>>,
): { name: string; date: string }[] {
  return entries.flatMap((entry) => {
    if ('isRecurring' in entry && entry.isRecurring) {
      return namedOn(entry.vendor?.name, entry.date)
    }
    const food = entry as PayloadFood
    const date = typeof food.date === 'string' ? food.date : ''
    return namedOn(food.vendorName || extractVendorInfo(food.vendor).name, date)
  })
}

function eventRows(events: PayloadEvent[]): { name: string; date: string }[] {
  return events.flatMap((event) => namedOn(event.organizer, event.date))
}

/** Markdown "Pouring now" section, one block per location. */
export async function loadPouringNow(locations: PayloadLocation[]): Promise<string> {
  const rows: LlmsNowLocation[] = await Promise.all(
    locations.map(async (location) => {
      const slug = location.slug || location.id
      const [draft, cans, events, food] = await Promise.all([
        loadOrEmpty(`${slug} draft`, () => getDraftMenu(slug), null),
        loadOrEmpty(`${slug} cans`, () => getCansMenu(slug), null),
        loadOrEmpty(`${slug} events`, () => getUpcomingEventsFromPayload(slug, 8), []),
        loadOrEmpty(`${slug} food`, () => getCombinedUpcomingFood(slug, 8), []),
      ])
      return {
        name: location.name,
        onTap: beerNames(draft),
        cans: beerNames(cans),
        events: eventRows(events),
        food: foodRows(food),
      }
    }),
  )
  return formatPouringNow(rows)
}
