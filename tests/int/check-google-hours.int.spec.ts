/**
 * Google hours check: site hours (weekly hours plus Special Hours overrides)
 * are compared with the hours on each taproom's Google Business Profile for
 * the next seven days and every later special-hours day. Real differences are
 * reported to Slack, and a day with no Special Hours entry gets one that
 * copies Google.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Payload } from 'payload'

const slackApi = vi.fn()
vi.mock('@/src/utils/slack-api', () => ({
  slackApi: (...args: unknown[]) => slackApi(...args),
}))
vi.mock('@/lib/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

import {
  compareHours,
  datesToCompare,
  googleDay,
  googleWeek,
  runGoogleHoursCheck,
  type BusinessProfile,
} from '@/src/jobs/check-google-hours'

// Sunday 2026-11-22 through Saturday 2026-11-28; Thanksgiving is Thursday the 26th.
const TODAY = '2026-11-22'
const WEEK = [22, 23, 24, 25, 26, 27, 28].map((d) => `2026-11-${d}`)

// 4pm–10pm Eastern (EST) every day except Monday, which is closed.
const OPEN = '2000-01-01T21:00:00.000Z'
const CLOSE = '2000-01-02T03:00:00.000Z'
const day = { open: OPEN, close: CLOSE }
const location = {
  id: 'loc-1',
  name: 'Lawrenceville',
  timezone: 'America/New_York' as const,
  address: { googlePlaceId: 'place-1' },
  sunday: day,
  monday: {},
  tuesday: day,
  wednesday: day,
  thursday: day,
  friday: day,
  saturday: day,
}

const DAY_NAMES = ['SUNDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']

/** A Business Profile agreeing with the weekly hours above: 4pm–10pm, closed Mondays. */
const matchingProfile = (): BusinessProfile => ({
  name: 'locations/1',
  metadata: { placeId: 'place-1' },
  openInfo: { status: 'OPEN' },
  regularHours: {
    periods: DAY_NAMES.map((name) => ({
      openDay: name,
      openTime: { hours: 16 },
      closeDay: name,
      closeTime: { hours: 22 },
    })),
  },
})

const closedOn = (month: number, dayOfMonth: number) => ({
  startDate: { year: 2026, month, day: dayOfMonth },
  endDate: { year: 2026, month, day: dayOfMonth },
  closed: true,
})

/** Special hours on a November day. Google leaves out zero fields, as here. */
const specialOn = (dayOfMonth: number, openHour: number, closeHour: number) => ({
  startDate: { year: 2026, month: 11, day: dayOfMonth },
  openTime: { hours: openHour },
  closeTime: { hours: closeHour },
})

/** The matching profile with special hours added. */
const withSpecials = (
  ...specialHourPeriods: NonNullable<
    NonNullable<BusinessProfile['specialHours']>['specialHourPeriods']
  >
): BusinessProfile => ({ ...matchingProfile(), specialHours: { specialHourPeriods } })

/** The matching profile with one weekday's regular hours replaced. */
const withRegular = (
  openDay: string,
  ...hours: Array<[open: number, close: number]>
): BusinessProfile => {
  const profile = matchingProfile()
  profile.regularHours!.periods = [
    ...profile.regularHours!.periods!.filter((p) => p.openDay !== openDay),
    ...hours.map(([open, close]) => ({
      openDay,
      openTime: { hours: open },
      closeDay: openDay,
      closeTime: { hours: close },
    })),
  ]
  return profile
}

const thanksgivingClosed = {
  id: 'h-1',
  name: 'Thanksgiving',
  date: '2026-11-26T12:00:00.000Z',
  type: 'closed' as const,
  locations: ['loc-1'],
}

describe('compareHours', () => {
  const compare = (profile: BusinessProfile, holidays: Array<typeof thanksgivingClosed> = []) =>
    compareHours({ dates: WEEK, location, holidays, profile })

  it('reports nothing when Google matches the weekly hours', () => {
    expect(compare(matchingProfile())).toEqual([])
  })

  it('reports a holiday closure Google has and the site lacks', () => {
    expect(compare(withSpecials(closedOn(11, 26)))).toEqual([
      {
        date: '2026-11-26',
        site: '4pm–10pm',
        google: 'Closed',
        googleSpecial: true,
        fix: { type: 'closed' },
      },
    ])
  })

  it('offers Special Hours for holiday hours Google has and the site lacks', () => {
    expect(compare(withSpecials(specialOn(25, 12, 18)))).toEqual([
      {
        date: '2026-11-25',
        site: '4pm–10pm',
        google: '12pm–6pm',
        googleSpecial: true,
        // Noon and 6pm Eastern (EST) on the day itself.
        fix: {
          type: 'modified',
          hours: { open: '2026-11-25T17:00:00.000Z', close: '2026-11-25T23:00:00.000Z' },
        },
      },
    ])
  })

  it('offers no fix when the site already has Special Hours for that day', () => {
    const [mismatch] = compare(withSpecials(specialOn(26, 12, 18)), [thanksgivingClosed])
    expect(mismatch).toMatchObject({ date: '2026-11-26', site: 'Closed', googleSpecial: true })
    expect(mismatch.fix).toBeUndefined()
  })

  it('reports nothing when a Special Hours entry already matches Google', () => {
    expect(compare(withSpecials(closedOn(11, 26)), [thanksgivingClosed])).toEqual([])
  })

  it("ignores another taproom's Special Hours entry", () => {
    const other = { ...thanksgivingClosed, locations: ['loc-2'] }
    expect(compare(matchingProfile(), [other])).toEqual([])
  })

  it('reports changed times, and modified Special Hours that differ', () => {
    const shortWednesday = {
      id: 'h-2',
      name: 'Thanksgiving Eve',
      date: '2026-11-25T12:00:00.000Z',
      type: 'modified' as const,
      locations: ['loc-1'],
      hours: { open: OPEN, close: '2000-01-02T01:00:00.000Z' },
    }

    expect(
      compareHours({
        dates: WEEK,
        location,
        holidays: [shortWednesday],
        profile: withRegular('FRIDAY', [12, 22]),
      }),
    ).toEqual([
      { date: '2026-11-25', site: '4pm–8pm', google: '4pm–10pm', googleSpecial: false },
      // No Special Hours entry on the 27th, so Google's hours can be added for it.
      {
        date: '2026-11-27',
        site: '4pm–10pm',
        google: '12pm–10pm',
        googleSpecial: false,
        fix: {
          type: 'modified',
          hours: { open: '2026-11-27T17:00:00.000Z', close: '2026-11-28T03:00:00.000Z' },
        },
      },
    ])
  })

  it('uses the same entry as the site when two Special Hours cover one day', () => {
    // Payload returns the newest entry first; the site shows the oldest.
    const newerOpen = {
      id: 'h-3',
      name: 'Open after all',
      date: '2026-11-26T12:00:00.000Z',
      type: 'modified' as const,
      locations: ['loc-1'],
      hours: day,
    }

    expect(
      compareHours({
        dates: WEEK,
        location,
        holidays: [newerOpen, thanksgivingClosed],
        profile: withSpecials(closedOn(11, 26)),
      }),
    ).toEqual([])
  })

  it('proposes only, with both spans, when Google shows a split day', () => {
    const [mismatch] = compare(withRegular('WEDNESDAY', [11, 14], [17, 22]))
    expect(mismatch).toMatchObject({ date: '2026-11-25', google: '11am–2pm, 5pm–10pm' })
    expect(mismatch.fix).toBeUndefined()
  })

  it('proposes only when Google shows a day open 24 hours', () => {
    // Midnight to 24:00, as special hours and as regular hours.
    for (const profile of [withSpecials(specialOn(25, 0, 24)), withRegular('WEDNESDAY', [0, 24])]) {
      const [mismatch] = compare(profile)
      expect(mismatch).toMatchObject({ date: '2026-11-25', google: 'Open 24 hours' })
      expect(mismatch.fix).toBeUndefined()
    }
  })

  it('copies a morning half-hour open and a midnight close on the next day', () => {
    const profile = withSpecials({
      startDate: { year: 2026, month: 11, day: 27 },
      openTime: { hours: 9, minutes: 30 },
      // Google leaves out zero fields, so midnight arrives with no hour or minute.
      endDate: { year: 2026, month: 11, day: 28 },
      closeTime: {},
    })

    expect(compare(profile)).toEqual([
      {
        date: '2026-11-27',
        site: '4pm–10pm',
        google: '9:30am–12am',
        googleSpecial: true,
        // 9:30am Eastern (EST) on the 27th, midnight Eastern at the start of the 28th.
        fix: {
          type: 'modified',
          hours: { open: '2026-11-27T14:30:00.000Z', close: '2026-11-28T05:00:00.000Z' },
        },
      },
    ])
  })

  it('offers a closure for every day of a week-long closure on Google', () => {
    const mismatches = compare(
      withSpecials(...[22, 24, 25, 26, 27, 28].map((d) => closedOn(11, d))),
    )

    expect(mismatches).toHaveLength(6)
    expect(mismatches.every((m) => m.fix?.type === 'closed')).toBe(true)
  })
})

describe('googleDay', () => {
  it('uses the regular hours for the weekday', () => {
    expect(googleDay(matchingProfile(), TODAY)).toEqual({
      special: false,
      periods: [{ open: '16:00', close: { date: TODAY, time: '22:00' } }],
    })
    // Monday the 23rd is closed.
    expect(googleDay(matchingProfile(), '2026-11-23')).toEqual({ special: false, periods: [] })
  })

  it('uses special hours instead of the regular hours on their day', () => {
    const profile = withSpecials(closedOn(11, 26), {
      startDate: { year: 2026, month: 11, day: 25 },
      openTime: { hours: 12 },
      closeTime: { hours: 18, minutes: 30 },
    })

    expect(googleDay(profile, '2026-11-26')).toEqual({ special: true, periods: [] })
    expect(googleDay(profile, '2026-11-25')).toEqual({
      special: true,
      periods: [{ open: '12:00', close: { date: '2026-11-25', time: '18:30' } }],
    })
  })

  it("reads Google's 24:00 close as midnight, matching a site close at 12am", () => {
    const profile = withRegular('SUNDAY', [16, 24])
    const untilMidnight = { open: OPEN, close: '2000-01-02T05:00:00.000Z' }
    const late = { ...location, sunday: untilMidnight }

    expect(googleDay(profile, TODAY).periods).toEqual([
      { open: '16:00', close: { date: '2026-11-23', time: '00:00' } },
    ])
    expect(compareHours({ dates: [TODAY], location: late, holidays: [], profile })).toEqual([])
  })
})

describe('googleWeek', () => {
  it("labels each weekday with Google's regular hours, leaving special hours out", () => {
    const profile = {
      ...withRegular('WEDNESDAY', [11, 14], [17, 22]),
      specialHours: { specialHourPeriods: [closedOn(11, 26)] },
    }

    expect(googleWeek(profile, TODAY)).toEqual({
      monday: 'Closed',
      tuesday: '4pm–10pm',
      wednesday: '11am–2pm, 5pm–10pm',
      thursday: '4pm–10pm',
      friday: '4pm–10pm',
      saturday: '4pm–10pm',
      sunday: '4pm–10pm',
    })
  })
})

describe('datesToCompare', () => {
  it('adds later days with special hours on either side to the next seven', () => {
    const profile = matchingProfile()
    profile.specialHours = {
      specialHourPeriods: [closedOn(8, 29), closedOn(11, 26), closedOn(12, 25)],
    }
    const newYear = { ...thanksgivingClosed, date: '2027-01-01T12:00:00.000Z' }
    const elsewhere = { ...thanksgivingClosed, date: '2026-12-31T12:00:00.000Z', locations: ['x'] }

    // The past special day and another taproom's entry are left out.
    expect(datesToCompare(TODAY, profile, [newYear, elsewhere], 'loc-1')).toEqual([
      ...WEEK,
      '2026-12-25',
      '2027-01-01',
    ])
  })
})

describe('runGoogleHoursCheck', () => {
  const find = vi.fn()
  const findGlobal = vi.fn()
  const create = vi.fn()
  const payload = { find, findGlobal, create } as unknown as Payload
  const fetchMock = vi.fn()
  const credentials = { clientId: 'id', clientSecret: 'secret', refreshToken: 'refresh' }

  /** Google signs the job in, then returns `profiles` (or `listStatus`) for the locations call. */
  const googleReplies = (profiles: BusinessProfile[], listStatus = 200) =>
    fetchMock.mockImplementation(async (url: string) =>
      url.startsWith('https://oauth2.googleapis.com/')
        ? new Response(JSON.stringify({ access_token: 'access' }))
        : new Response(JSON.stringify({ locations: profiles }), { status: listStatus }),
    )

  beforeEach(() => {
    // 06:30 UTC is 1:30am Eastern on Sunday the 22nd, so the week is the 22nd–28th.
    vi.useFakeTimers({ now: new Date('2026-11-22T06:30:00.000Z') })
    vi.stubGlobal('fetch', fetchMock)
    slackApi.mockResolvedValue(true)
    create.mockResolvedValue({ id: 'h-new' })
    findGlobal.mockResolvedValue({ slackChannels: { hours: '#managers' } })
    find.mockImplementation(async ({ collection }: { collection: string }) => ({
      docs: collection === 'locations' ? [location] : [],
    }))
    googleReplies([matchingProfile()])
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('stays quiet when everything matches', async () => {
    await expect(runGoogleHoursCheck(payload, credentials)).resolves.toEqual({
      checked: 1,
      mismatches: 0,
    })
    expect(slackApi).not.toHaveBeenCalled()

    const [tokenCall, listCall] = fetchMock.mock.calls
    expect(tokenCall[0]).toBe('https://oauth2.googleapis.com/token')
    expect(String(tokenCall[1].body)).toContain('refresh_token=refresh')
    expect(listCall[0]).toContain(
      'https://mybusinessbusinessinformation.googleapis.com/v1/accounts/-/locations?',
    )
    expect(listCall[1].headers).toEqual({ Authorization: 'Bearer access' })
  })

  it('only proposes, in the configured Slack channel, when Special Hours already exist', async () => {
    find.mockImplementation(async ({ collection }: { collection: string }) => ({
      docs: collection === 'locations' ? [location] : [thanksgivingClosed],
    }))

    await expect(runGoogleHoursCheck(payload, credentials)).resolves.toEqual({
      checked: 1,
      mismatches: 1,
    })
    const [method, body] = slackApi.mock.calls[0]
    expect(method).toBe('chat.postMessage')
    expect(body.channel).toBe('#managers')
    expect(body.text).toContain('Lawrenceville')
    expect(body.text).toContain('Thu, Nov 26: Google says 4pm–10pm, the site says Closed')
    expect(body.text).toContain('If Google is right')
    // Someone entered that closure, so the job does not overrule it.
    expect(create).not.toHaveBeenCalled()
  })

  it('adds Special Hours for an ordinary day that differs from Google', async () => {
    const profile = matchingProfile()
    profile.regularHours!.periods = profile.regularHours!.periods!.filter(
      (p) => p.openDay !== 'THURSDAY',
    )
    googleReplies([profile])

    await runGoogleHoursCheck(payload, credentials)

    expect(create.mock.calls[0][0].data).toMatchObject({
      name: 'Hours from Google',
      date: '2026-11-26T12:00:00.000Z',
      type: 'closed',
    })
    expect(slackApi.mock.calls[0][1].text).toContain(
      'Thu, Nov 26: Google says Closed, the site said 4pm–10pm',
    )
  })

  it('adds Special Hours for a holiday closure Google has, however far ahead', async () => {
    const profile = matchingProfile()
    profile.specialHours = { specialHourPeriods: [closedOn(12, 25)] }
    googleReplies([profile])

    await expect(runGoogleHoursCheck(payload, credentials)).resolves.toEqual({
      checked: 1,
      mismatches: 1,
    })

    expect(create).toHaveBeenCalledTimes(1)
    expect(create.mock.calls[0][0]).toMatchObject({
      collection: 'holiday-hours',
      overrideAccess: true,
      data: { date: '2026-12-25T12:00:00.000Z', locations: ['loc-1'], type: 'closed' },
    })
    const { text } = slackApi.mock.calls[0][1]
    expect(text).toContain(
      'Fri, Dec 25: Google says Closed (holiday hours), the site said 4pm–10pm',
    )
    expect(text).toContain('/admin/collections/holiday-hours/h-new|Added Special Hours>')
    // Nothing is left for a person to decide.
    expect(text).not.toContain('If Google is right')
  })

  it('reports a Special Hours entry beyond the week that Google does not have', async () => {
    const christmas = { ...thanksgivingClosed, date: '2026-12-25T12:00:00.000Z' }
    find.mockImplementation(async ({ collection }: { collection: string }) => ({
      docs: collection === 'locations' ? [location] : [christmas],
    }))

    await runGoogleHoursCheck(payload, credentials)

    expect(slackApi.mock.calls[0][1].text).toContain(
      'Fri, Dec 25: Google says 4pm–10pm, the site says Closed',
    )
    expect(create).not.toHaveBeenCalled()
  })

  it('reads every upcoming Special Hours entry, not just the next week', async () => {
    await runGoogleHoursCheck(payload, credentials)
    const query = find.mock.calls.find(([args]) => args.collection === 'holiday-hours')![0]
    expect(query.where).toEqual({ date: { greater_than_equal: '2026-11-22' } })
  })

  it('says so in Slack when no managed profile has the place ID', async () => {
    googleReplies([{ ...matchingProfile(), metadata: { placeId: 'someone-else' } }])

    await expect(runGoogleHoursCheck(payload, credentials)).resolves.toEqual({
      checked: 0,
      mismatches: 0,
    })
    const { text } = slackApi.mock.calls[0][1]
    expect(text).toContain('Lawrenceville')
    expect(text).toContain('no Business Profile')
    expect(text).toContain('Google place ID')
  })

  it('says so in Slack when the profile has no regular hours', async () => {
    googleReplies([{ metadata: { placeId: 'place-1' } }])

    await runGoogleHoursCheck(payload, credentials)
    expect(slackApi.mock.calls[0][1].text).toContain('no regular hours')
    expect(create).not.toHaveBeenCalled()
  })

  it('says so in Slack when Google marks the listing closed', async () => {
    googleReplies([{ ...matchingProfile(), openInfo: { status: 'CLOSED_TEMPORARILY' } }])

    await expect(runGoogleHoursCheck(payload, credentials)).resolves.toEqual({
      checked: 0,
      mismatches: 0,
    })
    expect(slackApi.mock.calls[0][1].text).toContain('temporarily closed')
  })

  it('says so in Slack when Google has put its own hours on the listing', async () => {
    const profile = matchingProfile()
    profile.metadata!.hasGoogleUpdated = true
    fetchMock.mockImplementation(async (url: string) => {
      if (url.startsWith('https://oauth2.googleapis.com/')) {
        return new Response(JSON.stringify({ access_token: 'access' }))
      }
      return new Response(
        JSON.stringify(
          url.includes('locations/1:getGoogleUpdated')
            ? { diffMask: 'regularHours' }
            : { locations: [profile] },
        ),
      )
    })

    await expect(runGoogleHoursCheck(payload, credentials)).resolves.toEqual({
      checked: 1,
      mismatches: 0,
    })
    expect(slackApi).toHaveBeenCalledTimes(1)
    expect(slackApi.mock.calls[0][1].text).toContain('Google has put its own hours')
  })

  it("stays quiet about Google's edits to anything but the hours", async () => {
    const profile = matchingProfile()
    profile.metadata!.hasGoogleUpdated = true
    // The locations reply carries no diffMask, as when Google changed something else.
    googleReplies([profile])

    await runGoogleHoursCheck(payload, credentials)
    expect(slackApi).not.toHaveBeenCalled()
  })

  it('splits a long message into Slack sections of at most 3,000 characters', async () => {
    const days = Array.from({ length: 30 }, (_, i) => closedOn(12, i + 1))
    googleReplies([withSpecials(...days)])

    await runGoogleHoursCheck(payload, credentials)

    const { text, blocks } = slackApi.mock.calls[0][1]
    expect(create).toHaveBeenCalledTimes(26) // December's Mondays are already closed.
    expect(blocks.length).toBeGreaterThan(1)
    for (const block of blocks) expect(block.text.text.length).toBeLessThanOrEqual(3000)
    expect(blocks.map((b: { text: { text: string } }) => b.text.text).join('\n')).toBe(text)
  })

  it('only looks at active taprooms', async () => {
    await runGoogleHoursCheck(payload, credentials)
    const locationsQuery = find.mock.calls.find(([args]) => args.collection === 'locations')![0]
    expect(locationsQuery.where).toEqual({
      and: [{ 'address.googlePlaceId': { exists: true } }, { active: { equals: true } }],
    })
  })

  it('escapes the taproom name in Slack messages', async () => {
    find.mockImplementation(async ({ collection }: { collection: string }) => ({
      docs:
        collection === 'locations'
          ? [{ ...location, name: 'Tap <!channel> & Grill' }]
          : [thanksgivingClosed],
    }))

    await runGoogleHoursCheck(payload, credentials)
    expect(slackApi.mock.calls[0][1].text).toContain('Tap &lt;!channel&gt; &amp; Grill')
  })

  it('says so in Slack when the credentials are missing, without calling Google', async () => {
    await expect(runGoogleHoursCheck(payload, undefined)).resolves.toEqual({
      checked: 0,
      mismatches: 0,
    })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(slackApi).toHaveBeenCalledTimes(1)
    expect(slackApi.mock.calls[0][1].channel).toBe('#managers')
    expect(slackApi.mock.calls[0][1].text).toContain('GOOGLE_BUSINESS_REFRESH_TOKEN')
  })

  it('does nothing while no taproom has a place ID', async () => {
    find.mockResolvedValue({ docs: [] })
    await runGoogleHoursCheck(payload, undefined)

    // A place ID of only spaces is not a place ID.
    find.mockResolvedValue({ docs: [{ ...location, address: { googlePlaceId: '  ' } }] })
    await runGoogleHoursCheck(payload, credentials)

    expect(slackApi).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('says so once in Slack, without retrying, when Google rejects the sign-in', async () => {
    fetchMock.mockResolvedValue(new Response('{"error":"invalid_grant"}', { status: 400 }))

    await expect(runGoogleHoursCheck(payload, credentials)).resolves.toEqual({
      checked: 0,
      mismatches: 0,
    })
    expect(slackApi).toHaveBeenCalledTimes(1)
    const { text } = slackApi.mock.calls[0][1]
    // Google's own reason is passed on, so a revoked sign-in is told from a disabled API.
    expect(text).toContain('HTTP 400: invalid_grant')
    expect(text).toContain('google-business-signin.mjs')
  })

  it('fails so the job retries when Google or Slack is down', async () => {
    googleReplies([], 503)
    await expect(runGoogleHoursCheck(payload, credentials)).rejects.toThrow(/Google returned 503/)
    expect(slackApi).not.toHaveBeenCalled()

    find.mockImplementation(async ({ collection }: { collection: string }) => ({
      docs: collection === 'locations' ? [location] : [thanksgivingClosed],
    }))
    googleReplies([matchingProfile()])
    slackApi.mockResolvedValue(false)
    await expect(runGoogleHoursCheck(payload, credentials)).rejects.toThrow(/Slack/)
  })
})
