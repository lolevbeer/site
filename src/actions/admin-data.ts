'use server'

import { getPayload } from 'payload'
import config from '@payload-config'
import type { Location, Food, FoodVendor } from '@/src/payload-types'

/**
 * Server actions for admin components using the Payload Local API
 * These bypass HTTP and query the database directly, avoiding auth issues
 */

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
 * Get multiple food vendors by IDs
 */
export async function getFoodVendorsByIds(ids: string[]): Promise<Record<string, string>> {
  const payload = await getPayload({ config })
  const names: Record<string, string> = {}

  await Promise.all(
    ids.map(async (id) => {
      try {
        const vendor = await payload.findByID({
          collection: 'food-vendors',
          id,
        })
        names[id] = vendor?.name || 'Unknown'
      } catch {
        names[id] = 'Unknown'
      }
    })
  )

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
    const vendor = doc.vendor as FoodVendor | string
    const vendorId = typeof vendor === 'object' ? vendor.id : vendor
    const vendorName = typeof vendor === 'object' ? vendor.name : doc.vendorName || 'Unknown'

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
