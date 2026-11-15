/**
 * Nightly check of each taproom's hours against its Google listing.
 *
 * For every location with a Google place ID, the next seven days of site hours
 * (weekly hours plus Special Hours overrides) are compared with what Google
 * shows for those days, holidays included. Differences are posted to Slack as
 * a proposal; nothing is written to the site, because either side can be the
 * one that is wrong.
 *
 * Google only publishes holiday hours seven days ahead through the Places API,
 * so that is how early a holiday change can be noticed.
 */
import type { Payload, TaskConfig } from 'payload'
import type { HolidayHour, Location } from '@/src/payload-types'
import { getTodayEST } from '@/lib/utils/date'
import { formatTime } from '@/lib/utils/formatters'
import { getBaseUrl } from '@/lib/utils/get-base-url'
import { logger } from '@/lib/utils/logger'
import { slackChannelFor } from '@/lib/slack/notify'
import { slackApi } from '@/src/utils/slack-api'

interface GoogleDate {
  year: number
  month: number
  day: number
}

interface GooglePoint {
  date?: GoogleDate
  hour?: number
  minute?: number
  /** Set when Google clipped this time to the edge of its seven-day window. */
  truncated?: boolean
}

/** `currentOpeningHours` from Places API (New) Place Details. */
export interface GoogleOpeningHours {
  /** Omitted when the place is closed for the whole window. */
  periods?: Array<{ open: GooglePoint; close?: GooglePoint }>
  /** Days in the window whose hours differ from the regular week. */
  specialDays?: Array<{ date?: GoogleDate }>
}

export interface HoursMismatch {
  /** YYYY-MM-DD */
  date: string
  /** What the site shows, e.g. "4pm–10pm" or "Closed". */
  site: string
  google: string
  /** Google marks this day as holiday/special hours. */
  googleSpecial: boolean
}

type SiteLocation = Pick<
  Location,
  'timezone' | 'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday'
> & { id: string }
type SiteHoliday = Pick<HolidayHour, 'date' | 'type' | 'hours'> & {
  locations: Array<string | { id: string }>
}

const WEEKDAYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const
const DAYS_AHEAD = 7
const CLOSED = 'Closed'

const dateKey = ({ year, month, day }: GoogleDate) =>
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

/** The calendar date `offset` days after `key`, at noon UTC so it never shifts a day. */
const addDays = (key: string, offset: number) =>
  new Date(new Date(`${key}T12:00:00Z`).getTime() + offset * 86_400_000)

/** YYYY-MM-DD of a date built by `addDays`. */
const toKey = (date: Date) => date.toISOString().slice(0, 10)

const googleTime = ({ hour = 0, minute = 0 }: GooglePoint) =>
  formatTime(`${hour}:${String(minute).padStart(2, '0')}`)

/** What the site shows for one date: the Special Hours override if any, else the weekly hours. */
function siteHours(location: SiteLocation, holidays: SiteHoliday[], date: Date): string {
  const key = toKey(date)
  const holiday = holidays.find(
    (h) =>
      h.date.slice(0, 10) === key &&
      h.locations.some((l) => (typeof l === 'string' ? l : l.id) === location.id),
  )
  if (holiday?.type === 'closed') return CLOSED

  const hours = holiday ? holiday.hours : location[WEEKDAYS[date.getUTCDay()]]
  if (!hours?.open || !hours.close) return CLOSED
  const timezone = location.timezone || undefined
  return `${formatTime(hours.open, { timezone })}–${formatTime(hours.close, { timezone })}`
}

/** Days in the next seven where Google and the site show different hours. */
export function compareHours(args: {
  /** YYYY-MM-DD, the first day of Google's window. */
  today: string
  location: SiteLocation
  holidays: SiteHoliday[]
  google: GoogleOpeningHours
}): HoursMismatch[] {
  const periods = args.google.periods ?? []
  const special = new Set(args.google.specialDays?.map((d) => d.date && dateKey(d.date)))
  const mismatches: HoursMismatch[] = []

  for (let offset = 0; offset < DAYS_AHEAD; offset++) {
    const date = addDays(args.today, offset)
    const key = toKey(date)
    const todays = periods.filter((p) => p.open.date && dateKey(p.open.date) === key)
    // A clipped time is not the real opening or closing time, so it proves nothing.
    if (todays.some((p) => p.open.truncated || p.close?.truncated)) continue

    const google =
      todays
        .map((p) => (p.close ? `${googleTime(p.open)}–${googleTime(p.close)}` : 'Open 24 hours'))
        .join(', ') || CLOSED
    const site = siteHours(args.location, args.holidays, date)
    if (google !== site)
      mismatches.push({ date: key, site, google, googleSpecial: special.has(key) })
  }
  return mismatches
}

async function fetchGoogleHours(
  placeId: string,
  apiKey: string,
): Promise<GoogleOpeningHours | { rejected: number } | undefined> {
  const response = await fetch(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
    {
      headers: { 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': 'currentOpeningHours' },
      signal: AbortSignal.timeout(10_000),
    },
  )
  // A 4xx (bad key, bad place ID) will not fix itself on a retry; a rate limit or 5xx might.
  if (response.status >= 400 && response.status < 500 && response.status !== 429) {
    return { rejected: response.status }
  }
  if (!response.ok) throw new Error(`Google Places returned ${response.status} for ${placeId}`)
  const place = (await response.json()) as { currentOpeningHours?: GoogleOpeningHours }
  return place.currentOpeningHours
}

/** The Slack message for one taproom: one line per differing day, then what to do. */
function slackText(location: Pick<Location, 'id' | 'name'>, mismatches: HoursMismatch[]): string {
  const lines = mismatches.map(({ date, site, google, googleSpecial }) => {
    const day = addDays(date, 0).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    })
    return `• ${day}: Google says ${google}${googleSpecial ? ' (holiday hours)' : ''}, the site says ${site}`
  })
  const admin = `${getBaseUrl()}/admin/collections`
  return [
    `*${location.name}: hours on Google differ from the site*`,
    ...lines,
    `If Google is right, <${admin}/holiday-hours/create|add Special Hours> for a one-off day or <${admin}/locations/${location.id}|change the weekly hours>. If the site is right, fix the Google listing.`,
  ].join('\n')
}

/**
 * Compares every location that has a Google place ID and posts one Slack
 * message per taproom with differences. Throws when Google is down or
 * rate-limiting, or when Slack fails, so the task retries.
 *
 * A missing API key, or a request Google rejects (bad key or place ID), is
 * reported in Slack instead of thrown: a retry cannot fix it, and a silent
 * skip would look like "no differences".
 *
 * ponytail: stateless, so an unresolved difference is re-posted every night
 * until someone fixes one side. Store what was last posted if that gets noisy.
 */
export async function runGoogleHoursCheck(
  payload: Payload,
  apiKey: string | undefined,
): Promise<{ checked: number; mismatches: number }> {
  // ponytail: Eastern "today" for every taproom; use each location's timezone
  // if one ever opens outside Eastern time.
  const today = getTodayEST()
  const [locations, holidays, channel] = await Promise.all([
    payload.find({
      collection: 'locations',
      where: { 'address.googlePlaceId': { exists: true } },
      limit: 100,
      depth: 0,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'holiday-hours',
      // Dates are stored at noon UTC, so day-key bounds cover whole days.
      where: {
        and: [
          { date: { greater_than_equal: today } },
          { date: { less_than: toKey(addDays(today, DAYS_AHEAD)) } },
        ],
      },
      limit: 100,
      depth: 0,
      overrideAccess: true,
    }),
    slackChannelFor(payload, 'hours'),
  ])

  const post = async (text: string) => {
    const posted = await slackApi('chat.postMessage', {
      channel,
      unfurl_links: false,
      unfurl_media: false,
      text,
      blocks: [{ type: 'section', text: { type: 'mrkdwn', text } }],
    })
    if (!posted) throw new Error(`Slack post about Google hours to ${channel} failed`)
  }

  const result = { checked: 0, mismatches: 0 }
  if (!apiKey) {
    // Quiet until a taproom has a place ID: before that the check is simply not set up.
    if (locations.docs.length > 0) {
      await post('*Google hours check is not running:* `GOOGLE_PLACES_API_KEY` is not set.')
    }
    return result
  }

  for (const location of locations.docs) {
    const placeId = location.address?.googlePlaceId?.trim()
    if (!placeId) continue
    const google = await fetchGoogleHours(placeId, apiKey)
    if (!google) {
      logger.warn(`Google has no hours for ${location.name}`, { placeId })
      continue
    }
    if ('rejected' in google) {
      await post(
        `*${location.name}: Google hours check is not running.* Google rejected the request (HTTP ${google.rejected}). Check \`GOOGLE_PLACES_API_KEY\` and this taproom's Google place ID.`,
      )
      continue
    }
    result.checked++

    const mismatches = compareHours({ today, location, holidays: holidays.docs, google })
    if (mismatches.length === 0) continue
    result.mismatches += mismatches.length

    await post(slackText(location, mismatches))
  }
  return result
}

export const checkGoogleHoursTask: TaskConfig = {
  slug: 'checkGoogleHours',
  label: 'Check Hours Against Google',
  inputSchema: [],
  outputSchema: [
    { name: 'checked', type: 'number', required: true },
    { name: 'mismatches', type: 'number', required: true },
  ],
  retries: {
    attempts: 2,
    backoff: { type: 'exponential', delay: 60_000 },
  },
  // 06:30 UTC, inside the window the Vercel cron wakes the maintenance queue (vercel.json).
  schedule: [{ cron: '0 30 6 * * *', queue: 'maintenance' }],
  handler: async ({ req }) => {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY?.trim()
    return { output: await runGoogleHoursCheck(req.payload, apiKey) }
  },
}
