import { Metadata } from 'next'
import { getPayload } from 'payload'
import config from '@/src/payload.config'
import { JsonLd } from '@/components/seo/json-ld'
import { FoodPageClient } from './food-page-client'
import { FoodVendorSchedule, DayOfWeek } from '@/lib/types/food'
import { extractVendorInfo, getAllLocations } from '@/lib/utils/payload-api'
import { getMediaUrl } from '@/lib/utils/media-utils'
import { getTodayMidnightISO } from '@/lib/utils/date'
import { getUpcomingDatesForSlot, toDateKey } from '@/lib/utils/food-dates'
import { createLocationLookup, generateFoodEventJsonLd } from '@/lib/utils/json-ld'
import { PageTransition } from '@/components/motion'
import { logger } from '@/lib/utils/logger'
import { capitalizeName } from '@/lib/utils/formatters'
import {
  getRecurringFoodState,
  recurringDays as days,
  recurringOccurrences as weeks,
} from '@/src/utils/recurring-food'

export const metadata: Metadata = {
  title: 'Food',
  description: 'Food trucks and vendors at Lolev Beer in Lawrenceville and Zelienople',
  alternates: { canonical: '/food' },
}

// Revalidate every hour
export const revalidate = 3600

// Derived so the labels can't fall out of index alignment with `days`.
const fullDayLabels = days.map(capitalizeName)

interface PayloadFoodEntry {
  id: string
  vendor:
    | string
    | { id: string; name: string; site?: string | null; logo?: string | { url?: string } | null }
  date: string
  time: string
  start?: string
  finish?: string
  site?: string
  location?: { slug?: string; id?: string; name?: string } | string
}

interface RecurringFoodSchedules {
  [locationId: string]: {
    [day: string]: {
      [week: string]: string | null
    }
  }
}

interface RecurringFoodExclusions {
  [locationId: string]: string[]
}

/**
 * Fetch all food data server-side
 */
async function getFoodData(): Promise<FoodVendorSchedule[]> {
  try {
    const payload = await getPayload({ config })

    const todayStr = getTodayMidnightISO()
    // Compute the upcoming dates once per recurring slot, then derive which
    // years the three-month window actually touches so we only fetch those
    // years' recurring-food states.
    const upcomingDatesBySlot = days.map((_, dayIndex) =>
      weeks.map((__, weekIndex) => getUpcomingDatesForSlot(dayIndex, weekIndex + 1, 3)),
    )
    const years = [...new Set(upcomingDatesBySlot.flat(2).map((date) => date.getFullYear()))]

    // Fetch food entries, the recurring-food state for each needed year, and
    // locations in parallel.
    // The recurring helper falls back to the legacy global until its migration completes.
    const [foodResult, recurringFoodStates, locationsResult] = await Promise.all([
      payload.find({
        collection: 'food',
        where: {
          date: {
            greater_than_equal: todayStr,
          },
        },
        sort: 'date',
        limit: 100,
        depth: 2,
      }),
      Promise.all(years.map((year) => getRecurringFoodState(payload, { year }))),
      payload.find({
        collection: 'locations',
        where: {
          active: { equals: true },
        },
        limit: 100,
      }),
    ])
    // Look up the state that governs a given occurrence by the year the date falls in.
    const recurringFoodByYear = new Map(recurringFoodStates.map((state) => [state.year, state]))

    const locationMap: Record<string, { slug: string; name: string }> = {}
    for (const loc of locationsResult.docs) {
      locationMap[loc.id] = { slug: loc.slug || '', name: loc.name }
    }

    // Transform individual food entries.
    // Track date+vendor per location so recurring entries are only suppressed
    // when the same vendor already has an individual entry that day.
    const individualSchedules: FoodVendorSchedule[] = []
    const individualDateVendorsByLocation: Record<string, Set<string>> = {}

    for (const entry of foodResult.docs as unknown as PayloadFoodEntry[]) {
      const locId = typeof entry.location === 'object' ? entry.location?.id : entry.location
      const locationSlug = typeof entry.location === 'object' ? entry.location?.slug : undefined
      const locationName = typeof entry.location === 'object' ? entry.location?.name : undefined

      const vendorId = typeof entry.vendor === 'object' ? entry.vendor?.id : entry.vendor
      const {
        name: vendorName,
        site: vendorSite,
        logoUrl: vendorLogo,
      } = extractVendorInfo(entry.vendor, entry.site)

      const dateStr = entry.date.split('T')[0]
      const [year, month, day] = dateStr.split('-').map(Number)
      const date = new Date(year, month - 1, day, 12, 0, 0)
      const dayOfWeek = fullDayLabels[date.getDay()]

      if (locId) {
        if (!individualDateVendorsByLocation[locId]) {
          individualDateVendorsByLocation[locId] = new Set()
        }
        individualDateVendorsByLocation[locId].add(`${dateStr}::${vendorId}`)
      }

      individualSchedules.push({
        vendor: vendorName,
        date: dateStr,
        time: entry.time || '',
        site: vendorSite ?? undefined,
        logoUrl: vendorLogo ?? undefined,
        day: DayOfWeek[dayOfWeek.toUpperCase() as keyof typeof DayOfWeek],
        start: entry.start || entry.time?.split('-')[0]?.trim() || '',
        finish: entry.finish || entry.time?.split('-')[1]?.trim() || '',
        dayNumber: date.getDay(),
        location: locationSlug,
        locationName: locationName,
        specialEvent: false,
      } as FoodVendorSchedule)
    }

    // Collect vendor IDs from recurring schedules
    const vendorIds = new Set<string>()
    for (const recurringFood of recurringFoodStates) {
      const schedules = recurringFood.schedules as RecurringFoodSchedules
      for (const locationId of Object.keys(schedules)) {
        const locationSchedule = schedules[locationId]
        for (const day of days) {
          for (const week of weeks) {
            const vendorId = locationSchedule?.[day]?.[week]
            if (vendorId) vendorIds.add(vendorId)
          }
        }
      }
    }

    // Fetch vendor details
    const vendorMap: Record<
      string,
      { id: string; name: string; site?: string | null; logoUrl?: string }
    > = {}
    if (vendorIds.size > 0) {
      const vendorsResult = await payload.find({
        collection: 'food-vendors',
        where: {
          id: { in: Array.from(vendorIds) },
        },
        limit: vendorIds.size,
        depth: 2,
      })

      for (const vendor of vendorsResult.docs) {
        vendorMap[vendor.id] = {
          id: vendor.id,
          name: vendor.name,
          site: vendor.site,
          logoUrl: getMediaUrl(vendor.logo, 'thumbnail') || getMediaUrl(vendor.logo),
        }
      }
    }

    // Generate recurring food schedules
    const recurringSchedules: FoodVendorSchedule[] = []

    // A location may appear in one year's schedules but not another's, so
    // expand over the union of location IDs across the fetched states.
    const scheduledLocationIds = new Set(
      recurringFoodStates.flatMap((state) =>
        Object.keys(state.schedules as RecurringFoodSchedules),
      ),
    )

    for (const locationId of scheduledLocationIds) {
      const locationInfo = locationMap[locationId]
      if (!locationInfo) continue

      for (let dayIndex = 0; dayIndex < days.length; dayIndex++) {
        const day = days[dayIndex]
        for (let weekIndex = 0; weekIndex < weeks.length; weekIndex++) {
          const week = weeks[weekIndex]

          // Skip slots with no vendor scheduled in any fetched year.
          const slotHasVendor = recurringFoodStates.some(
            (state) => (state.schedules as RecurringFoodSchedules)[locationId]?.[day]?.[week],
          )
          if (!slotHasVendor) continue

          for (const date of upcomingDatesBySlot[dayIndex][weekIndex]) {
            // The year the date falls in determines which state's schedule applies.
            const recurringFood = recurringFoodByYear.get(date.getFullYear())
            if (!recurringFood) continue

            const schedules = recurringFood.schedules as RecurringFoodSchedules
            const vendorId = schedules[locationId]?.[day]?.[week]
            const vendor = vendorId ? vendorMap[vendorId] : undefined
            if (!vendorId || !vendor) continue

            const dateKey = toDateKey(date)

            // Skip if excluded
            const exclusions = recurringFood.exclusions as RecurringFoodExclusions
            if ((exclusions[locationId] || []).includes(dateKey)) continue

            // Skip if the same vendor already has an individual entry for this date at this location
            if (individualDateVendorsByLocation[locationId]?.has(`${dateKey}::${vendorId}`))
              continue

            const dayOfWeek = fullDayLabels[date.getDay()]

            recurringSchedules.push({
              vendor: vendor.name,
              date: dateKey,
              time: '',
              site: vendor.site ?? undefined,
              logoUrl: vendor.logoUrl,
              day: DayOfWeek[dayOfWeek.toUpperCase() as keyof typeof DayOfWeek],
              start: '',
              finish: '',
              dayNumber: date.getDay(),
              location: locationInfo.slug,
              locationName: locationInfo.name,
              specialEvent: false,
            } as FoodVendorSchedule)
          }
        }
      }
    }

    // Combine and sort
    const combined = [...individualSchedules, ...recurringSchedules]
    combined.sort((a, b) => a.date.localeCompare(b.date))

    return combined
  } catch (error) {
    logger.error('Failed to fetch food data:', error)
    return []
  }
}

export default async function FoodPage() {
  const [schedules, locations] = await Promise.all([getFoodData(), getAllLocations()])
  const locationLookup = createLocationLookup(locations)

  const validSchedules = schedules.filter(
    (schedule) => schedule && schedule.vendor && schedule.date && schedule.location,
  )
  const jsonLd =
    validSchedules.length > 0
      ? {
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          itemListElement: validSchedules.map((schedule, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            item: generateFoodEventJsonLd(schedule, locationLookup),
          })),
        }
      : null

  return (
    <>
      {/* JSON-LD structured data for all locations */}
      {jsonLd && <JsonLd data={jsonLd} />}

      <PageTransition>
        <FoodPageClient initialSchedules={schedules} />
      </PageTransition>
    </>
  )
}
