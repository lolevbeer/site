'use server'

import { getPayload } from 'payload'
import config from '@payload-config'
import type { Location, Food, FoodVendor } from '@/src/payload-types'

/**
 * Server actions for admin components using the Payload Local API
 * These bypass HTTP and query the database directly, avoiding auth issues
 */

/**
 * Helper to extract vendor data from a polymorphic vendor field
 * Handles both populated (object) and unpopulated (string ID) cases
 */
function extractVendorData(
  vendor: FoodVendor | string | null | undefined,
  fallbackName?: string | null
): { id: string; name: string } {
  if (typeof vendor === 'object' && vendor !== null) {
    return { id: vendor.id, name: vendor.name }
  }
  return { id: vendor || '', name: fallbackName || 'Unknown' }
}

export interface SimpleLocation {
  id: string
  name: string
  slug: string
}

export interface SimpleFoodVendor {
  id: string
  name: string
}

export interface FoodEvent {
  id: string
  date: string
  vendorId: string
  vendorName: string
}

/**
 * Get all active locations
 */
export async function getActiveLocations(): Promise<SimpleLocation[]> {
  const payload = await getPayload({ config })

  const result = await payload.find({
    collection: 'locations',
    where: {
      active: { equals: true },
    },
    sort: 'name',
    limit: 100,
  })

  return result.docs.map((loc) => ({
    id: loc.id,
    name: loc.name,
    slug: loc.slug || loc.id,
  }))
}

/**
 * Get a food vendor by ID
 */
export async function getFoodVendor(id: string): Promise<SimpleFoodVendor | null> {
  const payload = await getPayload({ config })

  try {
    const vendor = await payload.findByID({
      collection: 'food-vendors',
      id,
    })

    return vendor ? { id: vendor.id, name: vendor.name } : null
  } catch {
    return null
  }
}

/**
 * Get multiple food vendors by IDs using a single batch query
 */
export async function getFoodVendorsByIds(ids: string[]): Promise<Record<string, string>> {
  if (ids.length === 0) return {}

  const payload = await getPayload({ config })
  const names: Record<string, string> = {}

  // Single batch query instead of N individual queries
  const result = await payload.find({
    collection: 'food-vendors',
    where: { id: { in: ids } },
    limit: ids.length,
  })

  // Map results by ID
  for (const vendor of result.docs) {
    names[vendor.id] = vendor.name
  }

  // Mark any missing IDs as Unknown
  for (const id of ids) {
    if (!names[id]) {
      names[id] = 'Unknown'
    }
  }

  return names
}

/**
 * Get upcoming food events for a location
 */
export async function getUpcomingFoodForLocation(locationId: string): Promise<FoodEvent[]> {
  const payload = await getPayload({ config })

  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]

  const result = await payload.find({
    collection: 'food',
    where: {
      and: [
        { location: { equals: locationId } },
        { date: { greater_than_equal: todayStr } },
      ],
    },
    sort: 'date',
    limit: 100,
    depth: 1,
  })

  return result.docs.map((doc) => {
    const { id: vendorId, name: vendorName } = extractVendorData(doc.vendor as FoodVendor | string, doc.vendorName)

    return {
      id: doc.id,
      date: doc.date,
      vendorId,
      vendorName,
    }
  })
}

/**
 * Get recurring food global data
 */
export async function getRecurringFoodData(): Promise<{
  schedules: Record<string, Record<string, Record<string, string | null>>>
  exclusions: Record<string, string[]>
}> {
  const payload = await getPayload({ config })

  const data = await payload.findGlobal({
    slug: 'recurring-food',
    depth: 1,
  })

  return {
    schedules: (data.schedules as Record<string, Record<string, Record<string, string | null>>>) || {},
    exclusions: (data.exclusions as Record<string, string[]>) || {},
  }
}

/**
 * Get food events for a specific date and location
 */
export async function getFoodOnDate(
  date: string,
  locationId: string
): Promise<{ id: string; vendorId: string; vendorName: string }[]> {
  const payload = await getPayload({ config })

  const result = await payload.find({
    collection: 'food',
    where: {
      and: [
        { date: { equals: date } },
        { location: { equals: locationId } },
      ],
    },
    depth: 1,
    limit: 100,
  })

  return result.docs.map((doc) => {
    const { id: vendorId, name: vendorName } = extractVendorData(doc.vendor as FoodVendor | string, doc.vendorName)

    return {
      id: doc.id,
      vendorId,
      vendorName,
    }
  })
}

/**
 * Get site content global data
 */
export async function getSiteContentData(): Promise<{
  distributorPaUrl?: string
  distributorOhUrl?: string
}> {
  const payload = await getPayload({ config })

  const data = await payload.findGlobal({
    slug: 'site-content',
  })

  return {
    distributorPaUrl: data.distributorPaUrl as string | undefined,
    distributorOhUrl: data.distributorOhUrl as string | undefined,
  }
}

export interface EventOnDate {
  id: string
  organizer: string
  visibility: string
}

/**
 * Get events on a specific date for a location
 */
export async function getEventsOnDate(
  dateStr: string,
  locationId: string
): Promise<EventOnDate[]> {
  const payload = await getPayload({ config })

  const dateOnly = dateStr.split('T')[0]
  const startOfDay = `${dateOnly}T00:00:00.000Z`
  const endOfDay = `${dateOnly}T23:59:59.999Z`

  const result = await payload.find({
    collection: 'events',
    where: {
      and: [
        { date: { greater_than_equal: startOfDay } },
        { date: { less_than_equal: endOfDay } },
        { location: { equals: locationId } },
      ],
    },
    depth: 0,
    limit: 100,
  })

  return result.docs.map((doc) => ({
    id: doc.id,
    organizer: doc.organizer || 'Unknown',
    visibility: doc.visibility || 'public',
  }))
}

export interface FoodOnDateWithType {
  id: string
  vendorName: string
  type: 'individual'
}

/**
 * Get food events on a specific date for a location (with date range)
 */
export async function getFoodOnDateRange(
  dateStr: string,
  locationId: string
): Promise<FoodOnDateWithType[]> {
  const payload = await getPayload({ config })

  const dateOnly = dateStr.split('T')[0]
  const startOfDay = `${dateOnly}T00:00:00.000Z`
  const endOfDay = `${dateOnly}T23:59:59.999Z`

  const result = await payload.find({
    collection: 'food',
    where: {
      and: [
        { date: { greater_than_equal: startOfDay } },
        { date: { less_than_equal: endOfDay } },
        { location: { equals: locationId } },
      ],
    },
    depth: 1,
    limit: 100,
  })

  return result.docs.map((doc) => {
    const { name: vendorName } = extractVendorData(doc.vendor as FoodVendor | string, doc.vendorName)

    return {
      id: doc.id,
      vendorName,
      type: 'individual' as const,
    }
  })
}
