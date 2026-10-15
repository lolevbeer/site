/** Admin layouts preserve stored field contracts while keeping everyday editing discoverable. */
import { describe, expect, it } from 'vitest'
import type { Field, FlattenedField } from 'payload'
import { flattenAllFields } from 'payload/shared'
import { Beers } from '@/src/collections/Beers'
import { BeerReviews } from '@/src/collections/BeerReviews'
import { Styles } from '@/src/collections/Styles'
import { Tags } from '@/src/collections/Tags'
import { Menus } from '@/src/collections/Menus'
import { Products } from '@/src/collections/Products'
import { Events } from '@/src/collections/Events'
import { RecurringEvents } from '@/src/collections/RecurringEvents'
import { Food } from '@/src/collections/Food'
import { FoodVendors } from '@/src/collections/FoodVendors'
import { RecurringFoodSchedules } from '@/src/collections/RecurringFoodSchedules'
import { RecurringFoodExclusions } from '@/src/collections/RecurringFoodExclusions'
import { Locations } from '@/src/collections/Locations'
import { HolidayHours } from '@/src/collections/HolidayHours'
import { DonationRequests } from '@/src/collections/DonationRequests'
import { EventInquiries } from '@/src/collections/EventInquiries'
import { Jobs } from '@/src/collections/Jobs'
import { JobApplications } from '@/src/collections/JobApplications'
import { Users } from '@/src/collections/Users'
import { Media } from '@/src/collections/Media'
import { Distributors } from '@/src/collections/Distributors'
import { FAQs } from '@/src/collections/FAQs'
import { ComingSoon } from '@/src/globals/ComingSoon'
import { RecurringFood } from '@/src/globals/RecurringFood'
import { SiteContent } from '@/src/globals/SiteContent'
import { SiteSeo } from '@/src/globals/SiteSeo'

const configs = [
  Beers,
  BeerReviews,
  Styles,
  Tags,
  Menus,
  Products,
  Events,
  RecurringEvents,
  Food,
  FoodVendors,
  RecurringFoodSchedules,
  RecurringFoodExclusions,
  Locations,
  HolidayHours,
  DonationRequests,
  EventInquiries,
  Jobs,
  JobApplications,
  Users,
  Media,
  Distributors,
  FAQs,
  ComingSoon,
  RecurringFood,
  SiteContent,
  SiteSeo,
]

/**
 * Stored data paths, from Payload's own flattening (rows, collapsibles and unnamed
 * tabs are transparent). Named tabs prefix their children but are not listed
 * themselves, matching how the contract snapshots were first recorded.
 */
function storedFields(
  fields: FlattenedField[],
  prefix = '',
): Array<{ path: string; field: FlattenedField }> {
  return fields.flatMap((field) => {
    const path = `${prefix}${field.name}`
    const nested = 'flattenedFields' in field ? storedFields(field.flattenedFields, `${path}.`) : []
    return field.type === 'tab' ? nested : [{ path, field }, ...nested]
  })
}

const stored = (fields: Field[]) => storedFields(flattenAllFields({ fields }))

function findField(fields: Field[], path: string): FlattenedField {
  const found = stored(fields).find((entry) => entry.path === path)
  if (!found) throw new Error(`Missing field ${path}`)
  return found.field
}

function contracts(fields: Field[]) {
  return Object.fromEntries(
    stored(fields)
      .sort((a, b) => a.path.localeCompare(b.path))
      .map(({ path, field }) => {
        // Guard stored shapes, not function identity; access/filter/hook behavior has dedicated tests.
        const contract: Record<string, unknown> = { type: field.type }
        for (const key of [
          'required',
          'defaultValue',
          'hasMany',
          'relationTo',
          'unique',
          'index',
          'min',
          'max',
          'minLength',
          'maxLength',
          'virtual',
          'collection',
          'on',
        ]) {
          if (key in field) {
            const value = (field as unknown as Record<string, unknown>)[key]
            contract[key] = typeof value === 'function' ? '[function]' : value
          }
        }
        if ('options' in field)
          contract.options = field.options.map((option) =>
            typeof option === 'string' ? option : option.value,
          )
        if ('access' in field && field.access) contract.access = Object.keys(field.access).sort()
        if ('validate' in field && field.validate) contract.validate = true
        return [path, contract]
      }),
  )
}

describe('persistent field contracts', () => {
  it.each(configs.map((config) => [config.slug, config.fields] as const))(
    '%s retains its stored paths and validation shape',
    (slug, fields) => {
      expect(contracts(fields)).toMatchSnapshot(slug)
    },
  )
})

describe('editor task hierarchy', () => {
  it('keeps the timezone visible to lead bartenders while weekday editors remain admin-only', () => {
    const hoursTabs = Locations.fields.find((field) => field.type === 'tabs')
    if (hoursTabs?.type !== 'tabs') throw new Error('Expected location sections')
    const hours = hoursTabs.tabs[0].fields
    const timezone = hours.find((field) => 'name' in field && field.name === 'timezone')
    expect(timezone).toBeDefined()
    expect(timezone?.admin?.condition).toBeUndefined()
    const weekdaySection = hours.find((field) => field.type === 'collapsible')
    expect(
      weekdaySection?.admin?.condition?.({}, {}, { user: { roles: ['lead-bartender'] } } as never),
    ).toBe(false)
  })

  it('identifies menus with their required name instead of optional copy', () => {
    const name = findField(Menus.fields, 'name')
    expect('required' in name && name.required).toBe(true)
    expect(Menus.admin?.useAsTitle).toBe('name')
    expect(Menus.admin?.defaultColumns?.[0]).toBe('name')
  })

  it('keeps the useful beer tabs and inline-fill columns', () => {
    const tabs = Beers.fields.find((field) => field.type === 'tabs')
    expect(tabs?.type === 'tabs' && tabs.tabs.map((tab) => tab.label)).toEqual([
      'Details',
      'Pricing',
      'Label & images',
      'Untappd & reviews',
    ])
    expect(Beers.admin?.defaultColumns).toEqual(
      expect.arrayContaining(['tag', 'untappd', '_status']),
    )
    expect(Beers.admin?.defaultColumns).not.toContain('slug')
    expect(findField(Beers.fields, 'tag').admin?.components?.Cell).toBeDefined()
    expect(findField(Beers.fields, 'untappd').admin?.components?.Cell).toBeDefined()
  })

  it('puts scheduled location and time inputs together, not in the sidebar', () => {
    for (const config of [Events, RecurringEvents, Food]) {
      expect(findField(config.fields, 'location').admin?.position).not.toBe('sidebar')
    }
    expect(findField(Food.fields, 'date').admin?.position).not.toBe('sidebar')
    expect(findField(Food.fields, 'startTime').admin?.position).not.toBe('sidebar')
  })

  it('distinguishes internal event notes from public listing fields', () => {
    for (const config of [Events, RecurringEvents]) {
      const notes = findField(config.fields, 'description')
      const booking = findField(config.fields, 'otherInfo')
      expect('label' in notes && notes.label).toBe('Staff notes')
      expect('label' in booking && booking.label).toBe('Booking notes')
    }
  })

  it('keeps hiring workflows together and storage collections hidden', () => {
    expect(Jobs.admin?.group).toBe('Hiring')
    expect(JobApplications.admin?.group).toBe('Hiring')
    expect(RecurringFoodSchedules.admin?.hidden).toBe(true)
    expect(RecurringFoodExclusions.admin?.hidden).toBe(true)
  })

  it('keeps substantive location and product information in the main form', () => {
    for (const path of ['address', 'basicInfo']) {
      expect(findField(Locations.fields, path).admin?.position).not.toBe('sidebar')
    }
    for (const path of ['category', 'options', 'abv']) {
      expect(findField(Products.fields, path).admin?.position).not.toBe('sidebar')
    }
  })
})
