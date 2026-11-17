/**
 * Google hours check: the next seven days of site hours (weekly hours plus
 * Special Hours overrides) are compared with Google's hours for the same days,
 * and only real differences are reported to Slack.
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
  hoursOn,
  runGoogleHoursCheck,
  type BusinessProfile,
  type GoogleOpeningHours,
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

const period = (dayOfMonth: number, openHour = 16, closeHour = 22) => ({
  open: { date: { year: 2026, month: 11, day: dayOfMonth }, hour: openHour, minute: 0 },
  close: { date: { year: 2026, month: 11, day: dayOfMonth }, hour: closeHour, minute: 0 },
})

/** Google agreeing with the weekly hours above: open every day but Monday the 23rd. */
const matchingGoogle = (): GoogleOpeningHours => ({
  periods: [22, 24, 25, 26, 27, 28].map((d) => period(d)),
})

const thanksgivingClosed = {
  id: 'h-1',
  name: 'Thanksgiving',
  date: '2026-11-26T12:00:00.000Z',
  type: 'closed' as const,
  locations: ['loc-1'],
}

describe('compareHours', () => {
  it('reports nothing when Google matches the weekly hours', () => {
    expect(compareHours({ dates: WEEK, location, holidays: [], google: matchingGoogle() })).toEqual(
      [],
    )
  })

  it('reports a holiday closure Google has and the site lacks', () => {
    const google = matchingGoogle()
    google.periods = google.periods!.filter((p) => p.open.date!.day !== 26)
    google.specialDays = [{ date: { year: 2026, month: 11, day: 26 } }]

    expect(compareHours({ dates: WEEK, location, holidays: [], google })).toEqual([
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
    const google = matchingGoogle()
    google.periods = google.periods!.map((p) => (p.open.date!.day === 25 ? period(25, 12, 18) : p))
    google.specialDays = [{ date: { year: 2026, month: 11, day: 25 } }]

    expect(compareHours({ dates: WEEK, location, holidays: [], google })).toEqual([
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
    const google = matchingGoogle()
    google.periods = google.periods!.map((p) => (p.open.date!.day === 26 ? period(26, 12, 18) : p))
    google.specialDays = [{ date: { year: 2026, month: 11, day: 26 } }]

    const [mismatch] = compareHours({
      dates: WEEK,
      location,
      holidays: [thanksgivingClosed],
      google,
    })
    expect(mismatch).toMatchObject({ date: '2026-11-26', site: 'Closed', googleSpecial: true })
    expect(mismatch.fix).toBeUndefined()
  })

  it('reports nothing when a Special Hours entry already matches Google', () => {
    const google = matchingGoogle()
    google.periods = google.periods!.filter((p) => p.open.date!.day !== 26)

    expect(compareHours({ dates: WEEK, location, holidays: [thanksgivingClosed], google })).toEqual(
      [],
    )
  })

  it("ignores another taproom's Special Hours entry", () => {
    const other = { ...thanksgivingClosed, locations: ['loc-2'] }

    expect(
      compareHours({ dates: WEEK, location, holidays: [other], google: matchingGoogle() }),
    ).toEqual([])
  })

  it('reports changed times, and modified Special Hours that differ', () => {
    const google = matchingGoogle()
    google.periods = google.periods!.map((p) => (p.open.date!.day === 27 ? period(27, 12, 22) : p))
    const shortWednesday = {
      id: 'h-2',
      name: 'Thanksgiving Eve',
      date: '2026-11-25T12:00:00.000Z',
      type: 'modified' as const,
      locations: ['loc-1'],
      hours: { open: OPEN, close: '2000-01-02T01:00:00.000Z' },
    }

    expect(compareHours({ dates: WEEK, location, holidays: [shortWednesday], google })).toEqual([
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
    const google = matchingGoogle()
    google.periods = google.periods!.filter((p) => p.open.date!.day !== 26)

    expect(
      compareHours({
        dates: WEEK,
        location,
        holidays: [newerOpen, thanksgivingClosed],
        google,
      }),
    ).toEqual([])
  })

  it('proposes only, with both spans, when Google shows a split day', () => {
    const google = matchingGoogle()
    google.periods = google.periods!.flatMap((p) =>
      p.open.date!.day === 25 ? [period(25, 11, 14), period(25, 17, 22)] : [p],
    )

    const [mismatch] = compareHours({ dates: WEEK, location, holidays: [], google })
    expect(mismatch).toMatchObject({ date: '2026-11-25', google: '11am–2pm, 5pm–10pm' })
    expect(mismatch.fix).toBeUndefined()
  })

  it('proposes only when Google shows a day open 24 hours', () => {
    const google = matchingGoogle()
    google.periods = google.periods!.map((p) =>
      p.open.date!.day === 25 ? { open: { date: p.open.date, hour: 0, minute: 0 } } : p,
    )

    const [mismatch] = compareHours({ dates: WEEK, location, holidays: [], google })
    expect(mismatch).toMatchObject({ date: '2026-11-25', google: 'Open 24 hours' })
    expect(mismatch.fix).toBeUndefined()
  })

  it('copies a morning half-hour open and a midnight close on the next day', () => {
    const google = matchingGoogle()
    // Google leaves out zero fields, so midnight arrives with no hour or minute.
    google.periods = google.periods!.map((p) =>
      p.open.date!.day === 27
        ? {
            open: { date: { year: 2026, month: 11, day: 27 }, hour: 9, minute: 30 },
            close: { date: { year: 2026, month: 11, day: 28 } },
          }
        : p,
    )

    expect(compareHours({ dates: WEEK, location, holidays: [], google })).toEqual([
      {
        date: '2026-11-27',
        site: '4pm–10pm',
        google: '9:30am–12am',
        googleSpecial: false,
        // 9:30am Eastern (EST) on the 27th, midnight Eastern at the start of the 28th.
        fix: {
          type: 'modified',
          hours: { open: '2026-11-27T14:30:00.000Z', close: '2026-11-28T05:00:00.000Z' },
        },
      },
    ])
  })

  it('offers no fix when Google shows no hours for the whole week', () => {
    const mismatches = compareHours({ dates: WEEK, location, holidays: [], google: {} })

    // Six open days differ, but a listing with no hours at all is not six closures.
    expect(mismatches).toHaveLength(6)
    expect(mismatches.every((m) => m.fix === undefined)).toBe(true)
  })
})

const DAY_NAMES = ['SUNDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']

/** A Business Profile agreeing with the weekly hours above: 4pm–10pm, closed Mondays. */
const matchingProfile = (): BusinessProfile => ({
  metadata: { placeId: 'place-1' },
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

describe('hoursOn', () => {
  it('lays the regular week out by date', () => {
    expect(hoursOn(matchingProfile(), WEEK)).toEqual({ ...matchingGoogle(), specialDays: [] })
  })

  it('uses special hours instead of the regular hours on their day', () => {
    const profile = matchingProfile()
    profile.specialHours = {
      specialHourPeriods: [
        closedOn(11, 26),
        {
          startDate: { year: 2026, month: 11, day: 25 },
          openTime: { hours: 12 },
          closeTime: { hours: 18, minutes: 30 },
        },
      ],
    }

    const hours = hoursOn(profile, WEEK)
    expect(hours.periods!.map((p) => p.open.date!.day)).toEqual([22, 24, 25, 27, 28])
    expect(hours.periods![2]).toEqual({
      open: { date: { year: 2026, month: 11, day: 25 }, hour: 12, minute: 0 },
      close: { date: { year: 2026, month: 11, day: 25 }, hour: 18, minute: 30 },
    })
    expect(hours.specialDays).toEqual([
      { date: { year: 2026, month: 11, day: 25 } },
      { date: { year: 2026, month: 11, day: 26 } },
    ])
  })

  it("reads Google's 24:00 close as midnight, matching a site close at 12am", () => {
    const profile = matchingProfile()
    for (const p of profile.regularHours!.periods!) p.closeTime = { hours: 24 }
    const untilMidnight = { open: OPEN, close: '2000-01-02T05:00:00.000Z' }
    const late = { ...location, sunday: untilMidnight }

    const hours = hoursOn(profile, [TODAY])
    expect(hours.periods![0].close).toEqual({
      date: { year: 2026, month: 11, day: 23 },
      hour: 0,
      minute: 0,
    })
    expect(compareHours({ dates: [TODAY], location: late, holidays: [], google: hours })).toEqual(
      [],
    )
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
    expect(text).toContain('400')
    expect(text).toContain('GOOGLE_BUSINESS_REFRESH_TOKEN')
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
