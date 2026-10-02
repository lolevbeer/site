/**
 * Public home, food, and events pages hand their client components only the fields those
 * components render. The projection happens in the server page, so full CMS objects never become
 * client props; JSON-LD still gets the full server objects.
 */
import { isValidElement, type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/dynamic', () => ({ default: () => () => null }))
vi.mock('@/lib/seo/resolve-metadata', () => ({ buildPageMetadata: vi.fn() }))
vi.mock('@/lib/utils/site-seo', () => ({
  getHubIntro: vi.fn().mockResolvedValue('Intro'),
  getSiteSeo: vi.fn(),
  siteDefaults: vi.fn(),
}))
vi.mock('@/components/motion', () => ({
  PageTransition: ({ children }: { children: ReactNode }) => children,
}))
vi.mock('@/lib/utils/homepage-data', () => ({ getHomePageData: vi.fn() }))
vi.mock('@/lib/utils/payload-api', () => ({
  getAllLocations: vi.fn().mockResolvedValue([]),
  getAllUpcomingEventsFromPayload: vi.fn(),
  transformPayloadEventToBreweryEvent: (event: unknown) => event,
  extractVendorInfo: (
    vendor: { name: string; site?: string; logoUrl?: string },
    site?: string,
  ) => ({
    name: vendor.name,
    site: site || vendor.site,
    logoUrl: vendor.logoUrl,
  }),
}))
vi.mock('payload', () => ({ getPayload: vi.fn() }))
vi.mock('@/src/payload.config', () => ({ default: {} }))
vi.mock('@/src/utils/recurring-food', () => ({
  getRecurringFoodState: vi.fn().mockResolvedValue({ year: 2099, schedules: {}, exclusions: {} }),
  recurringDays: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
  recurringOccurrences: ['1', '2', '3', '4'],
}))

import { getHomePageData } from '@/lib/utils/homepage-data'
import { getAllUpcomingEventsFromPayload } from '@/lib/utils/payload-api'
import { getPayload } from 'payload'
import { HomeContent } from '@/components/home/home-content'
import { JsonLd } from '@/components/seo/json-ld'
import { EventsPageClient } from '@/src/app/(frontend)/events/events-page-client'
import { FoodPageClient } from '@/src/app/(frontend)/food/food-page-client'
import Home from '@/src/app/(frontend)/page'
import EventsPage from '@/src/app/(frontend)/events/page'
import FoodPage from '@/src/app/(frontend)/food/page'
import {
  projectEventsForClient,
  projectFoodForClient,
  projectHeroCanBeers,
} from '@/lib/utils/public-client-payloads'
import type { BreweryEvent } from '@/lib/types/event'
import type { FoodVendorSchedule } from '@/lib/types/food'
import type { Beer, Menu } from '@/src/payload-types'

/** Depth-first search of a rendered element tree for every element of one component type. */
function findAll(node: ReactNode, type: unknown, found: Array<Record<string, unknown>> = []) {
  if (Array.isArray(node)) node.forEach((child) => findAll(child, type, found))
  else if (isValidElement(node)) {
    const props = node.props as Record<string, unknown>
    if (node.type === type) found.push(props)
    findAll(props.children as ReactNode, type, found)
  }
  return found
}

const media = (name: string) => ({
  url: `/api/media/file/${name}.png`,
  sizes: { thumbnail: { url: `/thumb/${name}.png` } },
})
const beer = (id: string, extra: Record<string, unknown> = {}) =>
  ({
    id,
    slug: `slug-${id}`,
    name: `Beer ${id}`,
    image: media(id),
    description: 'SECRET-DESCRIPTION',
    abv: 5,
    ...extra,
  }) as unknown as Beer
const item = (b: unknown) => ({ product: { relationTo: 'beers', value: b } })
const menu = (...items: unknown[]) =>
  ({ id: 'm', items, secretMenuField: 'SECRET-MENU' }) as unknown as Menu

describe('projectHeroCanBeers', () => {
  const a = beer('a')
  const b = beer('b')
  const noImage = beer('c', { image: null })
  const localPng = beer('d', { image: true })
  const notOnCans = beer('e')

  it('keeps availableBeers order and only cans members that resolve a thumbnail', () => {
    const result = projectHeroCanBeers(
      [b, notOnCans, noImage, a, localPng],
      [menu(item(a), item(noImage)), menu({ beer: b }, item(localPng))],
    )
    expect(result).toEqual([
      { id: 'b', slug: 'slug-b', name: 'Beer b', imageUrl: '/thumb/b.png' },
      { id: 'a', slug: 'slug-a', name: 'Beer a', imageUrl: '/thumb/a.png' },
      { id: 'd', slug: 'slug-d', name: 'Beer d', imageUrl: '/images/beer/slug-d.png' },
    ])
    for (const entry of result)
      expect(Object.keys(entry).sort()).toEqual(['id', 'imageUrl', 'name', 'slug'])
  })

  it('ignores unresolved relationships, menus without items, and keeps availableBeers duplicates', () => {
    const result = projectHeroCanBeers(
      [a, a],
      [
        { id: 'x' } as unknown as Menu,
        menu(
          { product: { relationTo: 'beers', value: 'a' } },
          { beer: 'a' },
          { product: { relationTo: 'merch', value: a } },
        ),
      ],
    )
    expect(result).toEqual([])
    expect(projectHeroCanBeers([a, a], [menu(item(a), item(a))])).toHaveLength(2)
  })
})

describe('projectFoodForClient / projectEventsForClient', () => {
  it('keeps only the fields the schedule clients read', () => {
    const food = {
      vendor: 'Truck',
      date: '2099-01-02',
      time: '',
      start: '4pm',
      finish: '9pm',
      site: 'https://t.example',
      logoUrl: '/logo.png',
      location: 'lawrenceville',
      locationName: 'L',
      day: 'Friday',
      dayNumber: 5,
      notes: 'SECRET',
    } as unknown as FoodVendorSchedule
    const [projected] = projectFoodForClient([food])
    expect(Object.keys(projected).sort()).toEqual([
      'date',
      'location',
      'logoUrl',
      'site',
      'start',
      'time',
      'vendor',
    ])
    expect(projected).toMatchObject({
      vendor: 'Truck',
      start: '4pm',
      time: '',
      logoUrl: '/logo.png',
    })

    const event = {
      id: 'e1',
      title: 'Trivia',
      description: 'Fun',
      date: '2099-01-02',
      time: '7pm',
      endTime: '9pm',
      location: 'lawrenceville',
      site: 'https://e.example',
      vendor: 'V',
      price: 'SECRET',
      tags: ['music'],
      status: 'scheduled',
      type: 'trivia',
    } as unknown as BreweryEvent
    const [projectedEvent] = projectEventsForClient([event])
    expect(Object.keys(projectedEvent).sort()).toEqual([
      'date',
      'description',
      'endTime',
      'id',
      'location',
      'site',
      'time',
      'title',
    ])
  })
})

describe('server page boundaries', () => {
  beforeEach(() => vi.clearAllMocks())

  it('Home gives HomeContent a heroBeers projection instead of full beers and cans menus', async () => {
    const a = beer('a')
    const draft = menu(item(beer('z')))
    const cans = menu(item(a))
    vi.mocked(getHomePageData).mockResolvedValue({
      locations: [],
      weeklyHours: {},
      allEvents: [],
      allFood: [],
      draftMenusByLocation: {},
      cansMenusByLocation: {},
      availableBeers: [a, beer('b')],
      allDraftMenus: [draft],
      allCansMenus: [cans],
      beerCount: {},
      cansCount: {},
      comingSoonBeers: [],
      eventsMarketingByLocation: {},
      foodMarketingByLocation: {},
      eventsByLocation: {},
      foodByLocation: {},
      siteContent: { heroDescription: 'Desc', heroImageUrl: null },
    } as unknown as Awaited<ReturnType<typeof getHomePageData>>)

    const [props] = findAll(await Home(), HomeContent)
    expect(props.heroBeers).toEqual([
      { id: 'a', slug: 'slug-a', name: 'Beer a', imageUrl: '/thumb/a.png' },
    ])
    expect(props).not.toHaveProperty('availableBeers')
    expect(props).not.toHaveProperty('cansMenus')
    expect(props.draftMenus).toEqual([draft])
    expect(JSON.stringify(props.heroBeers)).not.toContain('SECRET-')
  })

  it('Events projects client props but keeps full events for JSON-LD', async () => {
    const event = {
      id: 'e1',
      title: 'Trivia',
      description: 'Fun',
      date: '2099-01-02',
      time: '7pm',
      endTime: '9pm',
      location: 'lawrenceville',
      site: 'https://e.example',
      vendor: 'V',
      price: 'SECRET-PRICE',
      status: 'scheduled',
      type: 'trivia',
    }
    vi.mocked(getAllUpcomingEventsFromPayload).mockResolvedValue([event] as never)
    const tree = await EventsPage()
    const [props] = findAll(tree, EventsPageClient)
    expect(props.initialEvents).toEqual([
      projectEventsForClient([event as unknown as BreweryEvent])[0],
    ])
    expect(Object.keys((props.initialEvents as object[])[0]).sort()).toEqual([
      'date',
      'description',
      'endTime',
      'id',
      'location',
      'site',
      'time',
      'title',
    ])
    expect(findAll(tree, JsonLd)).toHaveLength(1)
  })

  it('Food projects client props and keeps every entry in server order', async () => {
    const entry = (id: string, date: string, vendor: string) => ({
      id,
      vendor: { id: `v${id}`, name: vendor, site: 'https://v.example' },
      date: `${date}T00:00:00.000Z`,
      time: id === '2' ? '' : '4-9pm',
      start: id === '2' ? '5pm' : undefined,
      finish: '9pm',
      location: { id: 'l1', slug: 'lawrenceville', name: 'Lawrenceville' },
      notes: 'SECRET-NOTES',
    })
    const find = vi.fn(async ({ collection }: { collection: string }) =>
      collection === 'food'
        ? { docs: [entry('1', '2099-01-03', 'B'), entry('2', '2099-01-02', 'A')] }
        : { docs: [{ id: 'l1', slug: 'lawrenceville', name: 'Lawrenceville' }] },
    )
    vi.mocked(getPayload).mockResolvedValue({ find } as never)
    const [props] = findAll(await FoodPage(), FoodPageClient)
    const schedules = props.initialSchedules as Array<Record<string, unknown>>
    expect(schedules.map((s) => s.vendor)).toEqual(['A', 'B'])
    for (const s of schedules) {
      expect(Object.keys(s).sort()).toEqual([
        'date',
        'location',
        'logoUrl',
        'site',
        'start',
        'time',
        'vendor',
      ])
    }
    expect(JSON.stringify(schedules)).not.toContain('SECRET-')
  })
})
