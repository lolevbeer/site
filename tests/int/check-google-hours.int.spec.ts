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
  runGoogleHoursCheck,
  type GoogleOpeningHours,
} from '@/src/jobs/check-google-hours'

// Sunday 2026-11-22 through Saturday 2026-11-28; Thanksgiving is Thursday the 26th.
const TODAY = '2026-11-22'

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
    expect(
      compareHours({ today: TODAY, location, holidays: [], google: matchingGoogle() }),
    ).toEqual([])
  })

  it('reports a holiday closure Google has and the site lacks', () => {
    const google = matchingGoogle()
    google.periods = google.periods!.filter((p) => p.open.date!.day !== 26)
    google.specialDays = [{ date: { year: 2026, month: 11, day: 26 } }]

    expect(compareHours({ today: TODAY, location, holidays: [], google })).toEqual([
      { date: '2026-11-26', site: '4pm–10pm', google: 'Closed', googleSpecial: true },
    ])
  })

  it('reports nothing when a Special Hours entry already matches Google', () => {
    const google = matchingGoogle()
    google.periods = google.periods!.filter((p) => p.open.date!.day !== 26)

    expect(
      compareHours({ today: TODAY, location, holidays: [thanksgivingClosed], google }),
    ).toEqual([])
  })

  it("ignores another taproom's Special Hours entry", () => {
    const other = { ...thanksgivingClosed, locations: ['loc-2'] }

    expect(
      compareHours({ today: TODAY, location, holidays: [other], google: matchingGoogle() }),
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

    expect(compareHours({ today: TODAY, location, holidays: [shortWednesday], google })).toEqual([
      { date: '2026-11-25', site: '4pm–8pm', google: '4pm–10pm', googleSpecial: false },
      { date: '2026-11-27', site: '4pm–10pm', google: '12pm–10pm', googleSpecial: false },
    ])
  })

  it('skips a day Google cut off at the edge of its seven-day window', () => {
    const google = matchingGoogle()
    google.periods![5].close = {
      ...google.periods![5].close!,
      hour: 23,
      minute: 59,
      truncated: true,
    }

    expect(compareHours({ today: TODAY, location, holidays: [], google })).toEqual([])
  })
})

describe('runGoogleHoursCheck', () => {
  const find = vi.fn()
  const findGlobal = vi.fn()
  const payload = { find, findGlobal } as unknown as Payload
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.useFakeTimers({ now: new Date('2026-11-22T06:30:00.000Z') })
    vi.stubGlobal('fetch', fetchMock)
    slackApi.mockResolvedValue(true)
    findGlobal.mockResolvedValue({ slackChannels: { hours: '#managers' } })
    find.mockImplementation(async ({ collection }: { collection: string }) => ({
      docs: collection === 'locations' ? [location] : [],
    }))
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  const googleReplies = (currentOpeningHours: GoogleOpeningHours | undefined) =>
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ currentOpeningHours })))

  it('stays quiet when everything matches', async () => {
    // 06:30 UTC is 1:30am Eastern on Sunday the 22nd, so the window is the 22nd–28th.
    googleReplies(matchingGoogle())

    await expect(runGoogleHoursCheck(payload, 'key')).resolves.toEqual({
      checked: 1,
      mismatches: 0,
    })
    expect(slackApi).not.toHaveBeenCalled()
    expect(fetchMock.mock.calls[0][0]).toBe('https://places.googleapis.com/v1/places/place-1')
  })

  it('posts the differences to the configured Slack channel', async () => {
    googleReplies({ periods: [22, 24, 25, 27, 28].map((d) => period(d)) })

    await expect(runGoogleHoursCheck(payload, 'key')).resolves.toEqual({
      checked: 1,
      mismatches: 1,
    })
    const [method, body] = slackApi.mock.calls[0]
    expect(method).toBe('chat.postMessage')
    expect(body.channel).toBe('#managers')
    expect(body.text).toContain('Lawrenceville')
    expect(body.text).toContain('Thu, Nov 26: Google says Closed, the site says 4pm–10pm')
  })

  it('skips a taproom whose hours Google does not know', async () => {
    googleReplies(undefined)

    await expect(runGoogleHoursCheck(payload, 'key')).resolves.toEqual({
      checked: 0,
      mismatches: 0,
    })
    expect(slackApi).not.toHaveBeenCalled()
  })

  it('fails so the job retries when Google or Slack is down', async () => {
    fetchMock.mockResolvedValue(new Response('nope', { status: 500 }))
    await expect(runGoogleHoursCheck(payload, 'key')).rejects.toThrow(/Google Places/)

    googleReplies({ periods: [] })
    slackApi.mockResolvedValue(false)
    await expect(runGoogleHoursCheck(payload, 'key')).rejects.toThrow(/Slack/)
  })
})
