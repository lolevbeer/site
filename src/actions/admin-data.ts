'use server'

import { getPayload } from 'payload'
import type { Payload } from 'payload'
import { headers } from 'next/headers'
import config from '@payload-config'
import { hasRole, type Role } from '@/src/access/roles'
import type { FoodVendor, User } from '@/src/payload-types'
import {
  dayBounds,
  exclusionTimestamp,
  getRecurringFoodState,
  legacyObject,
  recurringDays,
  recurringOccurrences,
  type RecurringFoodExclusionsData,
  type RecurringFoodSchedulesData,
} from '@/src/utils/recurring-food'

/**
 * Server actions for admin components using the Payload Local API.
 * Every action authenticates the incoming request and explicitly enables
 * Payload access control, because Local API operations bypass access by default.
 */

interface AuthorizedPayload {
  payload: Payload
  user: User
}

const FOOD_ADMIN_ROLES: Role[] = ['admin', 'food-manager']
const EVENT_ADMIN_ROLES: Role[] = ['admin', 'event-manager']
const SCHEDULE_READER_ROLES: Role[] = ['admin', 'event-manager', 'food-manager']

async function getAuthorizedPayload(allowedRoles: Role[]): Promise<AuthorizedPayload> {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await headers() })
  const cmsUser = user as User | null

  if (!cmsUser || !hasRole(cmsUser, allowedRoles)) {
    throw new Error('Unauthorized')
  }

  return { payload, user: cmsUser }
}

function requireIdentifier(value: string, label: string): string {
  const normalized = typeof value === 'string' ? value.trim() : ''
  if (normalized.length === 0 || normalized.length > 128) {
    throw new Error(`Invalid ${label}`)
  }

  return normalized
}

function requireDateOnly(value: string): string {
  const match = typeof value === 'string' ? value.match(/^(\d{4}-\d{2}-\d{2})/) : null
  const parsed = match ? new Date(`${match[1]}T00:00:00.000Z`) : null
  if (
    !match ||
    !parsed ||
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== match[1]
  ) {
    throw new Error('Invalid date')
  }

  return match[1]
}

function requireOneOf<T extends string>(value: string, options: readonly T[], label: string): T {
  if (!options.includes(value as T)) {
    throw new Error(`Invalid ${label}`)
  }
  return value as T
}

/**
 * Helper to extract vendor data from a polymorphic vendor field
 * Handles both populated (object) and unpopulated (string ID) cases
 */
function extractVendorData(
  vendor: FoodVendor | string | null | undefined,
  fallbackName?: string | null,
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
  const { payload, user } = await getAuthorizedPayload(FOOD_ADMIN_ROLES)

  const result = await payload.find({
    collection: 'locations',
    where: {
      active: { equals: true },
    },
    sort: 'name',
    limit: 100,
    overrideAccess: false,
    user,
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
  const { payload, user } = await getAuthorizedPayload(SCHEDULE_READER_ROLES)
  const vendorId = requireIdentifier(id, 'vendor ID')

  try {
    const vendor = await payload.findByID({
      collection: 'food-vendors',
      id: vendorId,
      overrideAccess: false,
      user,
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
  if (ids.length > 100) throw new Error('Too many vendor IDs')

  const vendorIds = [...new Set(ids.map((id) => requireIdentifier(id, 'vendor ID')))]
  const { payload, user } = await getAuthorizedPayload(FOOD_ADMIN_ROLES)
  const names: Record<string, string> = {}

  // Single batch query instead of N individual queries
  const result = await payload.find({
    collection: 'food-vendors',
    where: { id: { in: vendorIds } },
    limit: vendorIds.length,
    overrideAccess: false,
    user,
  })

  // Map results by ID
  for (const vendor of result.docs) {
    names[vendor.id] = vendor.name
  }

  // Mark any missing IDs as Unknown
  for (const id of vendorIds) {
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
  const { payload, user } = await getAuthorizedPayload(FOOD_ADMIN_ROLES)
  const validLocationId = requireIdentifier(locationId, 'location ID')

  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]

  const result = await payload.find({
    collection: 'food',
    where: {
      and: [{ location: { equals: validLocationId } }, { date: { greater_than_equal: todayStr } }],
    },
    sort: 'date',
    limit: 100,
    depth: 1,
    overrideAccess: false,
    user,
  })

  return result.docs.map((doc) => {
    const { id: vendorId, name: vendorName } = extractVendorData(
      doc.vendor as FoodVendor | string,
      doc.vendorName,
    )

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
  const { payload, user } = await getAuthorizedPayload(SCHEDULE_READER_ROLES)

  const data = await getRecurringFoodState(payload, { overrideAccess: false, user })

  return {
    schedules: data.schedules,
    exclusions: data.exclusions,
  }
}

/**
 * Update one grid slot. Before the migration runs this writes the legacy
 * global; afterwards it uses the normalized schedule collection.
 */
export async function setRecurringFoodSchedule(
  locationId: string,
  day: string,
  occurrence: string,
  vendorId: string | null,
): Promise<void> {
  const { payload, user } = await getAuthorizedPayload(FOOD_ADMIN_ROLES)
  const validLocationId = requireIdentifier(locationId, 'location ID')
  const validDay = requireOneOf(day, recurringDays, 'recurring day')
  const validOccurrence = requireOneOf(occurrence, recurringOccurrences, 'recurring occurrence')
  const validVendorId = vendorId === null ? null : requireIdentifier(vendorId, 'vendor ID')
  const legacy = await payload.findGlobal({
    slug: 'recurring-food',
    depth: 0,
    overrideAccess: false,
    user,
  })

  if (!legacy.normalizedAt) {
    // The legacy global is already fetched — mutate its JSON directly.
    const schedules: RecurringFoodSchedulesData = structuredClone(
      legacyObject<RecurringFoodSchedulesData>(legacy.schedules),
    )
    schedules[validLocationId] ??= {}
    schedules[validLocationId][validDay] ??= {}
    schedules[validLocationId][validDay][validOccurrence] = validVendorId

    await payload.updateGlobal({
      slug: 'recurring-food',
      data: { schedules },
      overrideAccess: false,
      user,
    })
    return
  }

  const existing = await payload.find({
    collection: 'recurring-food-schedules',
    where: {
      and: [
        { location: { equals: validLocationId } },
        { day: { equals: validDay } },
        { occurrence: { equals: validOccurrence } },
      ],
    },
    depth: 0,
    limit: 1,
    overrideAccess: false,
    user,
  })
  const current = existing.docs[0]

  if (validVendorId && current) {
    await payload.update({
      collection: 'recurring-food-schedules',
      id: current.id,
      data: { vendor: validVendorId, active: true },
      overrideAccess: false,
      user,
    })
  } else if (validVendorId) {
    await payload.create({
      collection: 'recurring-food-schedules',
      data: {
        location: validLocationId,
        vendor: validVendorId,
        day: validDay,
        occurrence: validOccurrence,
        active: true,
      },
      overrideAccess: false,
      user,
    })
  } else if (current) {
    await payload.delete({
      collection: 'recurring-food-schedules',
      id: current.id,
      overrideAccess: false,
      user,
    })
  }
}

/**
 * Add or remove one occurrence exclusion while preserving the grid workflow.
 */
export async function setRecurringFoodExclusion(
  locationId: string,
  date: string,
  excluded: boolean,
): Promise<void> {
  const { payload, user } = await getAuthorizedPayload(FOOD_ADMIN_ROLES)
  const validLocationId = requireIdentifier(locationId, 'location ID')
  const validDate = requireDateOnly(date)
  const legacy = await payload.findGlobal({
    slug: 'recurring-food',
    depth: 0,
    overrideAccess: false,
    user,
  })

  if (!legacy.normalizedAt) {
    // The legacy global is already fetched — mutate its JSON directly.
    const exclusions: RecurringFoodExclusionsData = structuredClone(
      legacyObject<RecurringFoodExclusionsData>(legacy.exclusions),
    )
    const current = new Set(exclusions[validLocationId] || [])
    if (excluded) current.add(validDate)
    else current.delete(validDate)
    exclusions[validLocationId] = [...current].sort()

    await payload.updateGlobal({
      slug: 'recurring-food',
      data: { exclusions },
      overrideAccess: false,
      user,
    })
    return
  }

  const existing = await payload.find({
    collection: 'recurring-food-exclusions',
    where: {
      and: [
        { location: { equals: validLocationId } },
        { date: { greater_than_equal: dayBounds(validDate).start } },
        { date: { less_than_equal: dayBounds(validDate).end } },
      ],
    },
    depth: 0,
    limit: 1,
    overrideAccess: false,
    user,
  })
  const current = existing.docs[0]

  if (excluded && !current) {
    await payload.create({
      collection: 'recurring-food-exclusions',
      data: { location: validLocationId, date: exclusionTimestamp(validDate) },
      overrideAccess: false,
      user,
    })
  } else if (!excluded && current) {
    await payload.delete({
      collection: 'recurring-food-exclusions',
      id: current.id,
      overrideAccess: false,
      user,
    })
  }
}

/**
 * Get food events for a specific date and location
 */
export async function getFoodOnDate(
  date: string,
  locationId: string,
): Promise<{ id: string; vendorId: string; vendorName: string }[]> {
  const { payload, user } = await getAuthorizedPayload(FOOD_ADMIN_ROLES)
  const dateOnly = requireDateOnly(date)
  const validLocationId = requireIdentifier(locationId, 'location ID')

  const result = await payload.find({
    collection: 'food',
    where: {
      and: [{ date: { equals: dateOnly } }, { location: { equals: validLocationId } }],
    },
    depth: 1,
    limit: 100,
    overrideAccess: false,
    user,
  })

  return result.docs.map((doc) => {
    const { id: vendorId, name: vendorName } = extractVendorData(
      doc.vendor as FoodVendor | string,
      doc.vendorName,
    )

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
  const { payload, user } = await getAuthorizedPayload(['admin'])

  const data = await payload.findGlobal({
    slug: 'site-content',
    overrideAccess: false,
    user,
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
export async function getEventsOnDate(dateStr: string, locationId: string): Promise<EventOnDate[]> {
  const { payload, user } = await getAuthorizedPayload(EVENT_ADMIN_ROLES)
  const validLocationId = requireIdentifier(locationId, 'location ID')

  const dateOnly = requireDateOnly(dateStr)
  const { start: startOfDay, end: endOfDay } = dayBounds(dateOnly)

  const result = await payload.find({
    collection: 'events',
    where: {
      and: [
        { date: { greater_than_equal: startOfDay } },
        { date: { less_than_equal: endOfDay } },
        { location: { equals: validLocationId } },
      ],
    },
    depth: 0,
    limit: 100,
    overrideAccess: false,
    user,
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
  locationId: string,
): Promise<FoodOnDateWithType[]> {
  const { payload, user } = await getAuthorizedPayload(EVENT_ADMIN_ROLES)
  const validLocationId = requireIdentifier(locationId, 'location ID')

  const dateOnly = requireDateOnly(dateStr)
  const { start: startOfDay, end: endOfDay } = dayBounds(dateOnly)

  const result = await payload.find({
    collection: 'food',
    where: {
      and: [
        { date: { greater_than_equal: startOfDay } },
        { date: { less_than_equal: endOfDay } },
        { location: { equals: validLocationId } },
      ],
    },
    depth: 1,
    limit: 100,
    overrideAccess: false,
    user,
  })

  return result.docs.map((doc) => {
    const { name: vendorName } = extractVendorData(
      doc.vendor as FoodVendor | string,
      doc.vendorName,
    )

    return {
      id: doc.id,
      vendorName,
      type: 'individual' as const,
    }
  })
}
