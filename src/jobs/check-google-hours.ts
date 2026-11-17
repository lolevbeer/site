/**
 * Nightly check of each taproom's hours against its Google listing.
 *
 * For every active location with a Google place ID, the next seven days of site hours
 * (weekly hours plus Special Hours overrides) are compared with what Google
 * shows for those days, holidays included, and every difference is posted to
 * Slack.
 *
 * A differing day that has no Special Hours entry is also fixed: the job adds
 * an entry that matches Google, holiday or not. So Google wins over the weekly
 * hours, one day at a time; the weekly hours themselves are never edited. A
 * day whose Special Hours entry someone already entered stays a proposal, and
 * so does every day when Google shows no hours at all for the week.
 *
 * Google only publishes holiday hours seven days ahead through the Places API,
 * so that is how early a holiday change can be noticed.
 */
import type { Payload, TaskConfig } from 'payload'
import { fromZonedTime } from 'date-fns-tz'
import type { HolidayHour, Location } from '@/src/payload-types'
import { WEEKDAYS_FROM_SUNDAY } from '@/lib/types/location'
import { getTodayEST } from '@/lib/utils/date'
import { formatTime } from '@/lib/utils/formatters'
import { getBaseUrl } from '@/lib/utils/get-base-url'
import { addDays, dayOfWeek } from '@/lib/utils/schedule-heatmap'
import { escapeMrkdwn } from '@/lib/slack/mrkdwn'
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
  /** Set when a new Special Hours entry would make the site match Google. */
  fix?: SpecialHoursFix
}

/** The `type` and `hours` of a Special Hours entry that copies Google for one day. */
type SpecialHoursFix =
  { type: 'closed' } | { type: 'modified'; hours: { open: string; close: string } }

type SiteLocation = Pick<
  Location,
  'timezone' | 'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday'
> & { id: string }
type SiteHoliday = Pick<HolidayHour, 'date' | 'type' | 'hours'> & {
  locations: Array<string | { id: string }>
}

const DAYS_AHEAD = 7
const CLOSED = 'Closed'

const dateKey = ({ year, month, day }: GoogleDate) =>
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

const googleTime = ({ hour = 0, minute = 0 }: GooglePoint) =>
  formatTime(`${hour}:${String(minute).padStart(2, '0')}`)

/**
 * A Google time as the instant Payload stores for a time field: that wall-clock
 * time in the taproom's timezone. `fallbackDay` is used when Google omits the date.
 */
function googleInstant(point: GooglePoint, fallbackDay: string, timezone: string): string {
  const day = point.date ? dateKey(point.date) : fallbackDay
  const time = `${String(point.hour ?? 0).padStart(2, '0')}:${String(point.minute ?? 0).padStart(2, '0')}`
  return fromZonedTime(`${day}T${time}:00`, timezone).toISOString()
}

/**
 * The Special Hours entry that copies Google's periods for one day, or nothing
 * when they do not fit one open/close pair (split or all-night days).
 */
function specialHoursFix(
  todays: NonNullable<GoogleOpeningHours['periods']>,
  day: string,
  timezone: string,
): SpecialHoursFix | undefined {
  const [only, ...rest] = todays
  if (!only) return { type: 'closed' }
  if (rest.length > 0 || !only.close) return undefined
  return {
    type: 'modified',
    hours: {
      open: googleInstant(only.open, day, timezone),
      close: googleInstant(only.close, day, timezone),
    },
  }
}

/**
 * What the site shows for one YYYY-MM-DD date: `holiday` (its Special Hours
 * entry) if any, else the weekly hours.
 */
function siteHours(location: SiteLocation, holiday: SiteHoliday | undefined, date: string): string {
  if (holiday?.type === 'closed') return CLOSED

  const hours = holiday ? holiday.hours : location[WEEKDAYS_FROM_SUNDAY[dayOfWeek(date)]]
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
    const key = addDays(args.today, offset)
    // A clipped opening time is the tail of hours that began before the window
    // (last night, running past midnight), so it is not part of this day.
    const todays = periods.filter(
      (p) => p.open.date && dateKey(p.open.date) === key && !p.open.truncated,
    )
    // A clipped closing time is not the real one. Google does this to a midnight
    // close on the window's last day; the day is compared in full the next night.
    if (todays.some((p) => p.close?.truncated)) continue

    const google =
      todays
        .map((p) => (p.close ? `${googleTime(p.open)}–${googleTime(p.close)}` : 'Open 24 hours'))
        .join(', ') || CLOSED
    // When two entries cover the same day, the site shows the last one Payload
    // returns (the `holidayMap` in lib/utils/payload-api.ts), so take the last here too.
    const holiday = args.holidays
      .filter(
        (h) =>
          h.date.slice(0, 10) === key &&
          h.locations.some((l) => (typeof l === 'string' ? l : l.id) === args.location.id),
      )
      .at(-1)
    const site = siteHours(args.location, holiday, key)
    if (google === site) continue

    // Fixable only when nobody has entered Special Hours for the day. A listing
    // with no hours for the whole week (marked closed, or its hours removed) is
    // left for a person: copying it would show the taproom closed all week.
    const fix =
      !holiday && periods.length > 0
        ? specialHoursFix(todays, key, args.location.timezone || 'America/New_York')
        : undefined
    mismatches.push({ date: key, site, google, googleSpecial: special.has(key), fix })
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

/**
 * The Slack message for one taproom: one line per differing day, then what to
 * do about the days the job did not fix. `added` maps a date to the ID of the
 * Special Hours entry the job created for it.
 */
function slackText(
  location: Pick<Location, 'id' | 'name'>,
  mismatches: HoursMismatch[],
  added: Map<string, string>,
): string {
  const admin = `${getBaseUrl()}/admin/collections`
  const lines = mismatches.map(({ date, site, google, googleSpecial }) => {
    const day = new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    })
    const googleSays = `• ${day}: Google says ${google}${googleSpecial ? ' (holiday hours)' : ''}`
    const entry = added.get(date)
    return entry
      ? `${googleSays}, the site said ${site}. <${admin}/holiday-hours/${entry}|Added Special Hours> to match.`
      : `${googleSays}, the site says ${site}`
  })
  const text = [`*${escapeMrkdwn(location.name)}: hours on Google differ from the site*`, ...lines]
  if (added.size < mismatches.length) {
    text.push(
      `If Google is right, <${admin}/holiday-hours/create|add Special Hours> for a one-off day or <${admin}/locations/${location.id}|change the weekly hours>. If the site is right, fix the Google listing.`,
    )
  }
  return text.join('\n')
}

/**
 * Compares every active location that has a Google place ID and posts one
 * Slack message per taproom with differences. Throws when Google is down or
 * rate-limiting, or when Slack fails, so the task retries. Google is asked
 * about every taproom before anything is posted, so a failed Google request
 * retries the whole run without repeating a message.
 *
 * A missing API key, a request Google rejects (bad key or place ID), or a
 * place ID Google has no hours for is reported in Slack instead of thrown: a
 * retry cannot fix it, and a silent skip would look like "no differences".
 *
 * Google's hours for a differing day with no Special Hours entry are added to
 * the site (see `HoursMismatch.fix`); the public pages pick the entry up
 * through the collection's normal revalidation.
 *
 * ponytail: a weekly-hours difference is never resolved by these entries, so
 * it adds one entry per night as each new day enters the seven-day window,
 * until someone fixes the weekly hours or the Google listing.
 *
 * ponytail: stateless, so an unresolved difference is re-posted every night
 * until someone fixes one side. Store what was last posted if that gets noisy.
 *
 * ponytail: an entry is added before Slack is told. If that Slack post then
 * fails, the retry finds the site matching and says nothing; the entry is
 * still recognisable by its "Hours from Google" name. Post first if that ever bites.
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
      where: {
        and: [{ 'address.googlePlaceId': { exists: true } }, { active: { equals: true } }],
      },
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
          { date: { less_than: addDays(today, DAYS_AHEAD) } },
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

  // A place ID of only spaces is not a place ID.
  const taprooms = locations.docs.flatMap((location) => {
    const placeId = location.address?.googlePlaceId?.trim()
    return placeId ? [{ location, placeId }] : []
  })

  const result = { checked: 0, mismatches: 0 }
  if (!apiKey) {
    // Quiet until a taproom has a place ID: before that the check is simply not set up.
    if (taprooms.length > 0) {
      await post('*Google hours check is not running:* `GOOGLE_PLACES_API_KEY` is not set.')
    }
    return result
  }

  const replies = await Promise.all(
    taprooms.map(async ({ location, placeId }) => ({
      location,
      google: await fetchGoogleHours(placeId, apiKey),
    })),
  )
  for (const { location, google } of replies) {
    const notRunning = `*${escapeMrkdwn(location.name)}: Google hours check is not running.*`
    if (!google) {
      await post(
        `${notRunning} Google has no hours for this taproom's Google place ID. Check the place ID and that the Google listing has hours.`,
      )
      continue
    }
    if ('rejected' in google) {
      await post(
        `${notRunning} Google rejected the request (HTTP ${google.rejected}). Check \`GOOGLE_PLACES_API_KEY\` and this taproom's Google place ID.`,
      )
      continue
    }
    result.checked++

    const mismatches = compareHours({ today, location, holidays: holidays.docs, google })
    if (mismatches.length === 0) continue
    result.mismatches += mismatches.length

    // ponytail: one entry per taproom per day, even when both taprooms close
    // for the same holiday. Merge them by hand if the list gets long.
    const added = new Map<string, string>()
    for (const { date, fix } of mismatches) {
      if (!fix) continue
      const entry = await payload.create({
        collection: 'holiday-hours',
        data: {
          name: 'Hours from Google',
          date: `${date}T12:00:00.000Z`,
          locations: [location.id],
          ...fix,
        },
        overrideAccess: true,
      })
      added.set(date, String(entry.id))
    }

    await post(slackText(location, mismatches, added))
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
