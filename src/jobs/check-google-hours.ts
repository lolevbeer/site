/**
 * Nightly check of each taproom's hours against its Google listing.
 *
 * For every active location with a Google place ID, site hours (weekly hours
 * plus Special Hours overrides) are compared with the hours on its Google
 * Business Profile, and every difference is posted to Slack. The days compared
 * are the next seven, plus every later day that has special hours on Google or
 * a Special Hours entry on the site.
 *
 * A differing day that has no Special Hours entry is also fixed: the job adds
 * an entry that matches Google, holiday or not. So Google wins over the weekly
 * hours, one day at a time; the weekly hours themselves are never edited. A
 * day whose Special Hours entry someone already entered stays a proposal, and
 * so does every day when Google shows no hours at all for the week.
 *
 * Google's hours come from the Business Profile API, read as a signed-in
 * manager of the profiles (`GOOGLE_BUSINESS_*`), so holiday hours are seen as
 * soon as they are entered on Google. A taproom is matched to its profile by
 * place ID. Nothing is ever written to Google.
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
}

/** One stretch of opening hours. No `close` means open around the clock. */
interface GooglePeriod {
  open: GooglePoint
  close?: GooglePoint
}

/** Google's hours laid out day by day, as `hoursOn` builds them from a profile. */
export interface GoogleOpeningHours {
  /** One per stretch of opening hours, dated by its opening day. A closed day has none. */
  periods?: GooglePeriod[]
  /** Days whose hours differ from the regular week. */
  specialDays?: Array<{ date?: GoogleDate }>
}

/** A time of day from the Business Profile API. Zero fields are omitted; 24 hours is midnight at the day's end. */
interface ProfileTime {
  hours?: number
  minutes?: number
}

/** A location from the Business Profile API (Business Information v1). */
export interface BusinessProfile {
  metadata?: { placeId?: string }
  regularHours?: {
    periods?: Array<{
      /** "MONDAY" … "SUNDAY" */
      openDay: string
      openTime?: ProfileTime
      closeDay: string
      closeTime?: ProfileTime
    }>
  }
  specialHours?: {
    specialHourPeriods?: Array<{
      startDate: GoogleDate
      /** The same day, or the next one for a close after midnight. */
      endDate?: GoogleDate
      openTime?: ProfileTime
      closeTime?: ProfileTime
      closed?: boolean
    }>
  }
}

/** What the job signs in to Google with: an OAuth client and a manager's long-lived sign-in. */
export interface BusinessCredentials {
  clientId: string
  clientSecret: string
  refreshToken: string
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

const pad = (value: number) => String(value).padStart(2, '0')

const dateKey = ({ year, month, day }: GoogleDate) => `${year}-${pad(month)}-${pad(day)}`

/** A Google time as "HH:MM" on the 24-hour clock. */
// `??` rather than a default: Google omits zero fields, and a null must also read as zero.
const clock = (point: GooglePoint) => `${pad(point.hour ?? 0)}:${pad(point.minute ?? 0)}`

const googleTime = (point: GooglePoint) => formatTime(clock(point))

/**
 * A Google time as the instant Payload stores for a time field: that wall-clock
 * time in the taproom's timezone. `fallbackDay` is used when Google omits the date.
 */
function googleInstant(point: GooglePoint, fallbackDay: string, timezone: string): string {
  const day = point.date ? dateKey(point.date) : fallbackDay
  return fromZonedTime(`${day}T${clock(point)}:00`, timezone).toISOString()
}

/** A profile time on a YYYY-MM-DD date, with Google's 24:00 moved to 00:00 the next day. */
function profilePoint(date: string, time: ProfileTime = {}): GooglePoint {
  const midnight = time.hours === 24
  const [year, month, day] = (midnight ? addDays(date, 1) : date).split('-').map(Number)
  return {
    date: { year, month, day },
    hour: midnight ? 0 : (time.hours ?? 0),
    minute: time.minutes ?? 0,
  }
}

/**
 * Google's hours on each of `dates` (YYYY-MM-DD): the profile's special hours
 * for a day that has them, else its regular hours for that weekday.
 *
 * ponytail: a regular period that runs a full 24 hours comes out as
 * "12am–12am", not "Open 24 hours". Handle it if a taproom ever never closes.
 */
export function hoursOn(profile: BusinessProfile, dates: string[]): GoogleOpeningHours {
  const specialPeriods = profile.specialHours?.specialHourPeriods ?? []
  const regularPeriods = profile.regularHours?.periods ?? []
  const periods: GooglePeriod[] = []
  const specialDays: Array<{ date: GoogleDate }> = []
  for (const date of dates) {
    const specials = specialPeriods.filter((s) => dateKey(s.startDate) === date)
    if (specials.length > 0) {
      specialDays.push({ date: specials[0].startDate })
      for (const s of specials) {
        if (s.closed) continue
        periods.push({
          open: profilePoint(date, s.openTime),
          close: profilePoint(s.endDate ? dateKey(s.endDate) : date, s.closeTime),
        })
      }
      continue
    }
    const weekday = WEEKDAYS_FROM_SUNDAY[dayOfWeek(date)].toUpperCase()
    for (const r of regularPeriods) {
      if (r.openDay !== weekday) continue
      periods.push({
        open: profilePoint(date, r.openTime),
        close: profilePoint(r.closeDay === r.openDay ? date : addDays(date, 1), r.closeTime),
      })
    }
  }
  return { periods, specialDays }
}

const coversLocation = (holiday: SiteHoliday, locationId: string) =>
  holiday.locations.some((l) => (typeof l === 'string' ? l : l.id) === locationId)

/**
 * The days to compare for one taproom, from `today` on: the next seven, plus
 * every later day with special hours on Google or a Special Hours entry on the site.
 */
export function datesToCompare(
  today: string,
  profile: BusinessProfile,
  holidays: SiteHoliday[],
  locationId: string,
): string[] {
  const dates = new Set(Array.from({ length: DAYS_AHEAD }, (_, offset) => addDays(today, offset)))
  for (const s of profile.specialHours?.specialHourPeriods ?? []) dates.add(dateKey(s.startDate))
  for (const h of holidays) {
    if (coversLocation(h, locationId)) dates.add(h.date.slice(0, 10))
  }
  return [...dates].filter((date) => date >= today).sort()
}

/**
 * The Special Hours entry that copies `periods`, Google's hours for one day, or
 * undefined when they do not fit one: a split or all-night day has no single open/close pair.
 */
function specialHoursFix(
  periods: GooglePeriod[],
  day: string,
  timezone: string,
): SpecialHoursFix | undefined {
  if (periods.length === 0) return { type: 'closed' }
  const [only] = periods
  if (periods.length > 1 || !only.close) return undefined
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

/** The days among `dates` where Google and the site show different hours. */
export function compareHours(args: {
  /** YYYY-MM-DD days to compare; `google` must hold Google's hours for each. */
  dates: string[]
  location: SiteLocation
  holidays: SiteHoliday[]
  google: GoogleOpeningHours
}): HoursMismatch[] {
  const periods = args.google.periods ?? []
  const special = new Set(args.google.specialDays?.map((d) => d.date && dateKey(d.date)))
  const mismatches: HoursMismatch[] = []

  for (const key of args.dates) {
    const todays = periods.filter((p) => p.open.date && dateKey(p.open.date) === key)

    const google =
      todays
        .map((p) => (p.close ? `${googleTime(p.open)}–${googleTime(p.close)}` : 'Open 24 hours'))
        .join(', ') || CLOSED
    // When two entries cover the same day, the site shows the last one Payload
    // returns (the `holidayMap` in lib/utils/payload-api.ts), so take the last here too.
    const holiday = args.holidays
      .filter((h) => h.date.slice(0, 10) === key && coversLocation(h, args.location.id))
      .at(-1)
    const site = siteHours(args.location, holiday, key)
    if (google === site) continue

    // Fixable only when nobody has entered Special Hours for the day. A listing
    // with no hours on any compared day (marked closed, or its hours removed) is
    // left for a person: copying it would show the taproom closed all week.
    const fixable = !holiday && periods.length > 0
    const fix = fixable
      ? specialHoursFix(todays, key, args.location.timezone || 'America/New_York')
      : undefined
    mismatches.push({ date: key, site, google, googleSpecial: special.has(key), fix })
  }
  return mismatches
}

/**
 * GET or POST to Google and parse the JSON reply. A 4xx (revoked sign-in, API
 * switched off) will not fix itself on a retry, so it comes back as
 * `rejected`; a rate limit or 5xx throws so the task retries.
 */
async function googleJson<T>(url: string, init: RequestInit): Promise<T | { rejected: number }> {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(10_000) })
  if (response.status >= 400 && response.status < 500 && response.status !== 429) {
    return { rejected: response.status }
  }
  if (!response.ok) throw new Error(`Google returned ${response.status} for ${new URL(url).host}`)
  return (await response.json()) as T
}

/** Every Business Profile location the signed-in manager can see, with its hours. */
async function fetchProfiles(
  credentials: BusinessCredentials,
): Promise<BusinessProfile[] | { rejected: number }> {
  const token = await googleJson<{ access_token: string }>('https://oauth2.googleapis.com/token', {
    method: 'POST',
    body: new URLSearchParams({
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      refresh_token: credentials.refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  if ('rejected' in token) return token

  // ponytail: one page of 100 locations across all the manager's accounts.
  // Follow `nextPageToken` if the business ever has more.
  const list = await googleJson<{ locations?: BusinessProfile[] }>(
    'https://mybusinessbusinessinformation.googleapis.com/v1/accounts/-/locations?pageSize=100&readMask=name,metadata.placeId,regularHours,specialHours',
    { headers: { Authorization: `Bearer ${token.access_token}` } },
  )
  if ('rejected' in list) return list
  return list.locations ?? []
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
 * once, for every profile, before anything is posted, so a failed Google
 * request retries the whole run without repeating a message.
 *
 * Missing credentials, a request Google rejects (the sign-in was revoked), or
 * a place ID with no profile or no hours is reported in Slack instead of
 * thrown: a retry cannot fix it, and a silent skip would look like "no differences".
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
  credentials: BusinessCredentials | undefined,
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
      // Dates are stored at noon UTC, so a day-key bound covers the whole day.
      // ponytail: the first 500 upcoming entries; page if that is ever too few.
      where: { date: { greater_than_equal: today } },
      limit: 500,
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
  // Quiet until a taproom has a place ID: before that the check is simply not set up.
  if (taprooms.length === 0) return result
  if (!credentials) {
    await post(
      '*Google hours check is not running:* `GOOGLE_BUSINESS_CLIENT_ID`, `GOOGLE_BUSINESS_CLIENT_SECRET` and `GOOGLE_BUSINESS_REFRESH_TOKEN` are not all set.',
    )
    return result
  }

  const profiles = await fetchProfiles(credentials)
  if ('rejected' in profiles) {
    await post(
      `*Google hours check is not running.* Google rejected the request (HTTP ${profiles.rejected}). The Google sign-in in \`GOOGLE_BUSINESS_REFRESH_TOKEN\` may have been revoked; sign in again (see the README).`,
    )
    return result
  }

  for (const { location, placeId } of taprooms) {
    const notRunning = `*${escapeMrkdwn(location.name)}: Google hours check is not running.*`
    const profile = profiles.find((p) => p.metadata?.placeId === placeId)
    if (!profile) {
      await post(
        `${notRunning} The signed-in Google account manages no Business Profile with this taproom's Google place ID. Check the place ID.`,
      )
      continue
    }
    if (!profile.regularHours?.periods?.length) {
      await post(`${notRunning} Its Google Business Profile has no regular hours.`)
      continue
    }
    result.checked++

    const dates = datesToCompare(today, profile, holidays.docs, location.id)
    const mismatches = compareHours({
      dates,
      location,
      holidays: holidays.docs,
      google: hoursOn(profile, dates),
    })
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
    const clientId = process.env.GOOGLE_BUSINESS_CLIENT_ID?.trim()
    const clientSecret = process.env.GOOGLE_BUSINESS_CLIENT_SECRET?.trim()
    const refreshToken = process.env.GOOGLE_BUSINESS_REFRESH_TOKEN?.trim()
    const credentials =
      clientId && clientSecret && refreshToken
        ? { clientId, clientSecret, refreshToken }
        : undefined
    return { output: await runGoogleHoursCheck(req.payload, credentials) }
  },
}
