import { describe, expect, it } from 'vitest'
import type { User } from '@/src/payload-types'
import { Users } from '@/src/collections/Users'
import { Menus, canUpdateMenus } from '@/src/collections/Menus'
import { Beers, canReadBeers } from '@/src/collections/Beers'
import { Events } from '@/src/collections/Events'
import { FoodVendors } from '@/src/collections/FoodVendors'
import { Locations } from '@/src/collections/Locations'
import { SiteContent } from '@/src/globals/SiteContent'
import { canRunGoogleSheetsSync } from '@/src/endpoints/sync-google-sheets'
import { canRunUntappdSync } from '@/src/endpoints/sync-untappd-ratings'
import { getAdminRelationshipID } from '@/src/components/admin/relationship-value'

function userWith(roles: User['roles'], locations: User['locations'] = []): User {
  return {
    id: 'user-id',
    collection: 'users',
    email: 'user@example.com',
    roles,
    locations,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

function callAccess(access: unknown, user: User | null) {
  if (typeof access !== 'function') throw new Error('Expected access function')
  return access({ req: { user } })
}

function findField(fields: unknown[], name: string): Record<string, unknown> {
  for (const field of fields) {
    if (!field || typeof field !== 'object') continue
    const record = field as Record<string, unknown>
    if (record.name === name) return record

    if (Array.isArray(record.fields)) {
      const nested = findField(record.fields, name)
      if (Object.keys(nested).length > 0) return nested
    }

    if (Array.isArray(record.tabs)) {
      for (const tab of record.tabs) {
        if (!tab || typeof tab !== 'object') continue
        const tabFields = (tab as Record<string, unknown>).fields
        if (!Array.isArray(tabFields)) continue
        const nested = findField(tabFields, name)
        if (Object.keys(nested).length > 0) return nested
      }
    }
  }

  return {}
}

describe('menu authorization', () => {
  it('denies unassigned bartenders instead of granting global menu access', () => {
    expect(callAccess(canUpdateMenus, userWith(['bartender']))).toBe(false)
    expect(callAccess(Menus.access?.read, userWith(['lead-bartender']))).toBe(false)
  })

  it('limits bartenders and lead bartenders to their assigned locations', () => {
    const expected = { location: { in: ['location-1'] } }

    expect(callAccess(canUpdateMenus, userWith(['bartender'], ['location-1']))).toEqual(expected)
    expect(callAccess(Menus.access?.read, userWith(['lead-bartender'], ['location-1']))).toEqual(
      expected,
    )
  })

  it('allows admins to manage every menu', () => {
    expect(callAccess(canUpdateMenus, userWith(['admin']))).toBe(true)
    expect(callAccess(Menus.access?.read, userWith(['admin']))).toBe(true)
  })
})

describe('user assignment authorization', () => {
  const locationsField = Users.fields.find((field) => 'name' in field && field.name === 'locations')

  if (!locationsField || !('access' in locationsField)) {
    throw new Error('Expected locations field access rules')
  }

  it('prevents anyone but an admin from re-scoping an existing user', () => {
    expect(callAccess(locationsField.access?.update, userWith(['lead-bartender']))).toBe(false)
    expect(callAccess(locationsField.access?.update, userWith(['bartender']))).toBe(false)
    expect(callAccess(locationsField.access?.create, userWith(['bartender']))).toBe(false)
  })

  it('allows admins to set location assignments', () => {
    expect(callAccess(locationsField.access?.create, userWith(['admin']))).toBe(true)
    expect(callAccess(locationsField.access?.update, userWith(['admin']))).toBe(true)
  })

  it('lets a lead bartender scope the bartenders they invite', () => {
    // Menu access is location-scoped and rejects unassigned bartenders, so an
    // invite that drops the selected locations produces an unusable account.
    expect(callAccess(locationsField.access?.create, userWith(['lead-bartender']))).toBe(true)
  })

  describe('lead bartender invite scoping', () => {
    const beforeChange = Users.hooks?.beforeChange?.[0]
    if (typeof beforeChange !== 'function') throw new Error('Expected a beforeChange hook')

    const runHook = (data: Record<string, unknown>, user: User) =>
      beforeChange({
        data,
        req: { user },
        operation: 'create',
      } as unknown as Parameters<typeof beforeChange>[0])

    it('keeps locations the lead bartender is assigned to', () => {
      const result = runHook(
        { roles: ['bartender'], locations: ['location-1'] },
        userWith(['lead-bartender'], ['location-1']),
      )

      expect(result).toMatchObject({ locations: ['location-1'] })
    })

    it('rejects locations the lead bartender does not hold', () => {
      expect(() =>
        runHook(
          { roles: ['bartender'], locations: ['location-2'] },
          userWith(['lead-bartender'], ['location-1']),
        ),
      ).toThrow(/only assign locations/i)
    })

    it('leaves admin invites untouched', () => {
      const result = runHook(
        { roles: ['bartender'], locations: ['location-2'] },
        userWith(['admin'], ['location-1']),
      )

      expect(result).toMatchObject({ locations: ['location-2'] })
    })
  })
})

describe('sync endpoint authorization', () => {
  it('reserves Google Sheets bulk sync for admins', () => {
    expect(canRunGoogleSheetsSync(userWith(['admin']))).toBe(true)
    expect(canRunGoogleSheetsSync(userWith(['beer-manager']))).toBe(false)
    expect(canRunGoogleSheetsSync(null)).toBe(false)
  })

  it('allows only admins and beer managers to sync Untappd', () => {
    expect(canRunUntappdSync(userWith(['admin']))).toBe(true)
    expect(canRunUntappdSync(userWith(['beer-manager']))).toBe(true)
    expect(canRunUntappdSync(userWith(['bartender']))).toBe(false)
  })
})

describe('draft and sensitive field visibility', () => {
  it('returns only published beers unless the user manages beer content', () => {
    const publishedOnly = { _status: { equals: 'published' } }

    expect(callAccess(canReadBeers, null)).toEqual(publishedOnly)
    expect(callAccess(Beers.access?.read, userWith(['bartender']))).toEqual(publishedOnly)
    expect(callAccess(canReadBeers, userWith(['beer-manager']))).toBe(true)
    expect(callAccess(canReadBeers, userWith(['admin']))).toBe(true)
  })

  it('keeps food vendor contacts available to staff but out of public responses', () => {
    for (const name of ['email', 'phone']) {
      const field = findField(FoodVendors.fields, name)
      const read = (field.access as Record<string, unknown> | undefined)?.read

      expect(callAccess(read, null)).toBe(false)
      expect(callAccess(read, userWith(['bartender']))).toBe(true)
    }
  })

  it('limits private event details to event managers and admins', () => {
    for (const name of ['attendees', 'pointOfContact', 'email', 'phone', 'otherInfo']) {
      const field = findField(Events.fields, name)
      const read = (field.access as Record<string, unknown> | undefined)?.read

      expect(callAccess(read, null)).toBe(false)
      expect(callAccess(read, userWith(['bartender']))).toBe(false)
      expect(callAccess(read, userWith(['event-manager']))).toBe(true)
    }
  })

  it('limits operational import URLs to admins', () => {
    const protectedFields = [
      findField(Menus.fields, 'sheetUrl'),
      findField(Locations.fields, 'googleSheets'),
      findField(SiteContent.fields, 'distributorPaUrl'),
      findField(SiteContent.fields, 'distributorOhUrl'),
    ]

    for (const field of protectedFields) {
      const read = (field.access as Record<string, unknown> | undefined)?.read

      expect(callAccess(read, null)).toBe(false)
      expect(callAccess(read, userWith(['food-manager']))).toBe(false)
      expect(callAccess(read, userWith(['admin']))).toBe(true)
    }
  })
})

describe('admin relationship values', () => {
  it('extracts IDs from every Payload admin relationship value shape', () => {
    expect(getAdminRelationshipID('location-1')).toBe('location-1')
    expect(getAdminRelationshipID({ id: 'location-2' })).toBe('location-2')
    expect(getAdminRelationshipID({ value: 'location-3' })).toBe('location-3')
    expect(getAdminRelationshipID({ value: { id: 'location-4' } })).toBe('location-4')
    expect(getAdminRelationshipID(null)).toBeNull()
  })
})
