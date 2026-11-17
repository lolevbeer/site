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
 * so does a day Google shows as split or open around the clock.
 *
 * Google's hours come from the Business Profile API, read as a signed-in
 * manager of the profiles (`GOOGLE_BUSINESS_*`), so holiday hours are seen as
 * soon as they are entered on Google. A taproom is matched to its profile by
 * place ID. Nothing is ever written to Google.
 */
import type { Payload, TaskConfig } from 'payload'
import { fromZonedTime } from 'date-fns-tz'
import type { HolidayHour, Location } from '@/src/payload-types'
import { WEEKDAYS_FROM_SUNDAY, type Weekday } from '@/lib/types/location'
import { getTodayEST } from '@/lib/utils/date'
import { formatOpenHours, formatTime } from '@/lib/utils/formatters'
import { getBaseUrl } from '@/lib/utils/get-base-url'
import { addDays, dayOfWeek } from '@/lib/utils/schedule-heatmap'
import { clip, escapeMrkdwn } from '@/lib/slack/mrkdwn'
import { slackChannelFor } from '@/lib/slack/notify'
import { slackApi } from '@/src/utils/slack-api'

interface GoogleDate {
  year: number
  month: number
  day: number
}

/** A time of day from the Business Profile API. Zero fields are omitted; 24 hours is midnight at the day's end. */
interface ProfileTime {
  hours?: number
  minutes?: number
}

/** A location from the Business Profile API (Business Information v1). */
export interface BusinessProfile {
  /** Resource name, "locations/123". */
  name?: string
  /** The business name shown on Google. */
  title?: string
  storefrontAddress?: {
    addressLines?: string[]
    locality?: string
    /** State, e.g. "PA". */
    administrativeArea?: string
    postalCode?: string
  }
  phoneNumbers?: { primaryPhone?: string }
  metadata?: {
    placeId?: string
    /** Google has edits of its own to this listing that the owner has not reviewed. */
    hasGoogleUpdated?: boolean
  }
  /** `status` is "OPEN", "CLOSED_TEMPORARILY" or "CLOSED_PERMANENTLY". */
  openInfo?: { status?: string }
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

/** Google refused a request for a reason a retry cannot fix. `detail` is Google's own error text. */
export interface GoogleRejection {
  rejected: number
  detail: string
}

/** GET a Business Profile API URL as the signed-in manager. */
type GoogleGet = <T>(url: string) => Promise<T | GoogleRejection>

/** One stretch of opening hours. Times are "HH:MM"; no `close` means open around the clock. */
interface DayPeriod {
  open: string
  /** The close, and the day it falls on (the next day for a close at or after midnight). */
  close?: { date: string; time: string }
}

/** Google's hours for one day. A closed day has no periods. */
export interface GoogleDay {
  periods: DayPeriod[]
  /** The day has special hours on Google, in place of the regular week. */
  special: boolean
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
const BUSINESS_API = 'https://mybusinessbusinessinformation.googleapis.com/v1'

const pad = (value: number) => String(value).padStart(2, '0')

const dateKey = ({ year, month, day }: GoogleDate) => `${year}-${pad(month)}-${pad(day)}`

/** A profile time as "HH:MM" on the 24-hour clock. */
const clock = (time: ProfileTime = {}) => `${pad(time.hours ?? 0)}:${pad(time.minutes ?? 0)}`

/** One of Google's opening spans as a period of the day it opens on, `date`. */
function dayPeriod(
  date: string,
  span: { openTime?: ProfileTime; closeDate: string; closeTime?: ProfileTime },
): DayPeriod {
  const open = clock(span.openTime)
  // Google writes midnight at the end of a day as 24:00; that is 00:00 on the next day.
  const midnight = span.closeTime?.hours === 24
  const close = {
    date: midnight ? addDays(span.closeDate, 1) : span.closeDate,
    time: midnight ? '00:00' : clock(span.closeTime),
  }
  const allDay = open === '00:00' && close.time === '00:00' && close.date === addDays(date, 1)
  return allDay ? { open } : { open, close }
}

/**
 * Google's hours on one YYYY-MM-DD date: the profile's special hours for a day
 * that has them, else its regular hours for that weekday.
 */
export function googleDay(profile: BusinessProfile, date: string): GoogleDay {
  const specials = (profile.specialHours?.specialHourPeriods ?? []).filter(
    (s) => dateKey(s.startDate) === date,
  )
  if (specials.length > 0) {
    const open = specials.filter((s) => !s.closed)
    return {
      special: true,
      periods: open.map((s) =>
        dayPeriod(date, {
          openTime: s.openTime,
          closeDate: s.endDate ? dateKey(s.endDate) : date,
          closeTime: s.closeTime,
        }),
      ),
    }
  }

  const weekday = WEEKDAYS_FROM_SUNDAY[dayOfWeek(date)].toUpperCase()
  const regular = (profile.regularHours?.periods ?? []).filter((r) => r.openDay === weekday)
  return {
    special: false,
    periods: regular.map((r) =>
      dayPeriod(date, {
        openTime: r.openTime,
        closeDate: r.closeDay === r.openDay ? date : addDays(date, 1),
        closeTime: r.closeTime,
      }),
    ),
  }
}

/** One day of Google's hours as the comparison writes it: "4pm–10pm", "Closed", "Open 24 hours". */
function googleDayLabel(day: GoogleDay): string {
  const spans = day.periods.map((p) =>
    p.close ? `${formatTime(p.open)}–${formatTime(p.close.time)}` : 'Open 24 hours',
  )
  return spans.join(', ') || CLOSED
}

/**
 * Google's regular hours for each weekday, special hours left out, labelled as
 * the comparison writes them. The admin shows these beside the weekly hours.
 */
export function googleWeek(profile: BusinessProfile, today: string): Record<Weekday, string> {
  const regular = { ...profile, specialHours: undefined }
  const days = Array.from({ length: 7 }, (_, offset) => addDays(today, offset))
  return Object.fromEntries(
    days.map((date) => [
      WEEKDAYS_FROM_SUNDAY[dayOfWeek(date)],
      googleDayLabel(googleDay(regular, date)),
    ]),
  ) as Record<Weekday, string>
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
 * The Special Hours entry that copies `periods`, Google's hours for `date`, or
 * undefined when they do not fit one: a split or all-night day has no single
 * open/close pair. Times are stored as Payload stores a time field: that
 * wall-clock time in the taproom's timezone.
 */
function specialHoursFix(
  periods: DayPeriod[],
  date: string,
  timezone: string,
): SpecialHoursFix | undefined {
  if (periods.length === 0) return { type: 'closed' }
  const [only] = periods
  if (periods.length > 1 || !only.close) return undefined
  const instant = (day: string, time: string) =>
    fromZonedTime(`${day}T${time}:00`, timezone).toISOString()
  return {
    type: 'modified',
    hours: { open: instant(date, only.open), close: instant(only.close.date, only.close.time) },
  }
}

/**
 * What the site shows for one YYYY-MM-DD date: `holiday` (its Special Hours
 * entry) if any, else the weekly hours.
 */
function siteHours(location: SiteLocation, holiday: SiteHoliday | undefined, date: string): string {
  if (holiday?.type === 'closed') return CLOSED

  const hours = holiday ? holiday.hours : location[WEEKDAYS_FROM_SUNDAY[dayOfWeek(date)]]
  return formatOpenHours(hours, location.timezone)
}

/** The days among `dates` (YYYY-MM-DD) where Google's profile and the site show different hours. */
export function compareHours(args: {
  dates: string[]
  location: SiteLocation
  holidays: SiteHoliday[]
  profile: BusinessProfile
}): HoursMismatch[] {
  const mismatches: HoursMismatch[] = []

  for (const date of args.dates) {
    const day = googleDay(args.profile, date)
    const google = googleDayLabel(day)
    // When two entries cover the same day, the site shows the last one Payload
    // returns (the `holidayMap` in lib/utils/payload-api.ts), so take the last here too.
    const holiday = args.holidays
      .filter((h) => h.date.slice(0, 10) === date && coversLocation(h, args.location.id))
      .at(-1)
    const site = siteHours(args.location, holiday, date)
    if (google === site) continue

    // Fixable only when nobody has entered Special Hours for the day.
    const fix = holiday
      ? undefined
      : specialHoursFix(day.periods, date, args.location.timezone || 'America/New_York')
    mismatches.push({ date, site, google, googleSpecial: day.special, fix })
  }
  return mismatches
}

/** Google's own words for a refused request: the OAuth or API error code and message. */
async function rejectionDetail(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as {
      error?: string | { status?: string; message?: string }
      error_description?: string
    }
    const parts =
      typeof body.error === 'string'
        ? [body.error, body.error_description]
        : [body.error?.status, body.error?.message]
    return clip(parts.filter(Boolean).join(': '), 200)
  } catch {
    return ''
  }
}

/**
 * Call Google and parse the JSON reply. A 4xx (revoked sign-in, API switched
 * off, wrong client secret) will not fix itself on a retry, so it comes back
 * as a rejection with Google's reason; a rate limit or 5xx throws so the task retries.
 */
async function googleJson<T>(url: string, init: RequestInit): Promise<T | GoogleRejection> {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(10_000) })
  if (response.status >= 400 && response.status < 500 && response.status !== 429) {
    return { rejected: response.status, detail: await rejectionDetail(response) }
  }
  if (!response.ok) throw new Error(`Google returned ${response.status} for ${new URL(url).host}`)
  return (await response.json()) as T
}

/** The Google sign-in from `GOOGLE_BUSINESS_*`, or undefined unless all three are set. */
export function businessCredentials(): BusinessCredentials | undefined {
  const clientId = process.env.GOOGLE_BUSINESS_CLIENT_ID?.trim()
  const clientSecret = process.env.GOOGLE_BUSINESS_CLIENT_SECRET?.trim()
  const refreshToken = process.env.GOOGLE_BUSINESS_REFRESH_TOKEN?.trim()
  if (!clientId || !clientSecret || !refreshToken) return undefined
  return { clientId, clientSecret, refreshToken }
}

/**
 * Signs in to Google and lists every Business Profile location the manager can
 * see, with its name, address, phone, open status and hours. `get` makes further
 * calls with the same sign-in. Also used by the place ID check in the admin
 * (`src/actions/google-place-check.ts`).
 */
export async function fetchProfiles(
  credentials: BusinessCredentials,
): Promise<{ profiles: BusinessProfile[]; get: GoogleGet } | GoogleRejection> {
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
  const get: GoogleGet = (url) =>
    googleJson(url, { headers: { Authorization: `Bearer ${token.access_token}` } })

  // ponytail: one page of 100 locations across all the manager's accounts.
  // Follow `nextPageToken` if the business ever has more.
  const list = await get<{ locations?: BusinessProfile[] }>(
    `${BUSINESS_API}/accounts/-/locations?pageSize=100&readMask=name,title,storefrontAddress,phoneNumbers,metadata,openInfo,regularHours,specialHours`,
  )
  if ('rejected' in list) return list
  return { profiles: list.locations ?? [], get }
}

/**
 * Whether Google has put hours of its own on a listing, in place of the ones
 * the owner entered and this check reads. Maps then shows Google's version
 * until the owner accepts or rejects the edit in Business Profile.
 */
async function googleChangedHours(get: GoogleGet, profile: BusinessProfile): Promise<boolean> {
  if (!profile.metadata?.hasGoogleUpdated || !profile.name) return false
  const update = await get<{ diffMask?: string }>(
    `${BUSINESS_API}/${profile.name}:getGoogleUpdated?readMask=regularHours,specialHours`,
  )
  return !('rejected' in update) && /hours/i.test(update.diffMask ?? '')
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

/** Slack caps a section block at 3,000 characters, so a long message is split at line breaks. */
function slackSections(text: string): string[] {
  const sections: string[] = []
  for (const line of text.split('\n')) {
    const last = sections.at(-1)
    if (last !== undefined && last.length + line.length < 2900) {
      sections[sections.length - 1] = `${last}\n${line}`
    } else {
      sections.push(line)
    }
  }
  return sections
}

/**
 * Compares every active location that has a Google place ID and posts one
 * Slack message per taproom with differences. Throws when Google is down or
 * rate-limiting, or when Slack fails, so the task retries. Everything is read
 * from Google before anything is posted, so a failed Google request retries
 * the whole run without repeating a message.
 *
 * Missing credentials, a request Google rejects, a place ID with no profile or
 * no hours, and a listing Google marks closed are reported in Slack instead of
 * thrown: a retry cannot fix them, and a silent skip would look like "no
 * differences". So is a listing where Google has put its own hours in place of
 * the owner's, since Maps then shows hours this check does not read.
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
      blocks: slackSections(text).map((section) => ({
        type: 'section',
        text: { type: 'mrkdwn', text: section },
      })),
    })
    if (!posted) throw new Error(`Slack post about Google hours to ${channel} failed`)
  }

  const result = { checked: 0, mismatches: 0 }
  // A place ID of only spaces is not a place ID. Quiet until a taproom has
  // one: before that the check is simply not set up.
  const withPlaceId = locations.docs.flatMap((location) => {
    const placeId = location.address?.googlePlaceId?.trim()
    return placeId ? [{ location, placeId }] : []
  })
  if (withPlaceId.length === 0) return result
  if (!credentials) {
    await post(
      '*Google hours check is not running:* `GOOGLE_BUSINESS_CLIENT_ID`, `GOOGLE_BUSINESS_CLIENT_SECRET` and `GOOGLE_BUSINESS_REFRESH_TOKEN` are not all set.',
    )
    return result
  }

  const google = await fetchProfiles(credentials)
  if ('rejected' in google) {
    const reason = google.detail ? `: ${escapeMrkdwn(google.detail)}` : ''
    await post(
      `*Google hours check is not running.* Google rejected the request (HTTP ${google.rejected}${reason}). If it says \`invalid_grant\`, the saved Google sign-in was revoked: run \`node scripts/google-business-signin.mjs\` again (see the README).`,
    )
    return result
  }
  const taprooms = await Promise.all(
    withPlaceId.map(async ({ location, placeId }) => {
      const profile = google.profiles.find((p) => p.metadata?.placeId === placeId)
      const googleEdited = profile ? await googleChangedHours(google.get, profile) : false
      return { location, profile, googleEdited }
    }),
  )

  for (const { location, profile, googleEdited } of taprooms) {
    const name = escapeMrkdwn(location.name)
    const notRunning = `*${name}: Google hours check is not running.*`
    if (!profile) {
      await post(
        `${notRunning} The signed-in Google account manages no Business Profile with this taproom's Google place ID. Check the place ID.`,
      )
      continue
    }
    const status = profile.openInfo?.status
    if (status && status !== 'OPEN') {
      const closed = status === 'CLOSED_PERMANENTLY' ? 'permanently closed' : 'temporarily closed'
      await post(`${notRunning} Google shows this listing as ${closed}.`)
      continue
    }
    if (!profile.regularHours?.periods?.length) {
      await post(`${notRunning} Its Google Business Profile has no regular hours.`)
      continue
    }
    if (googleEdited) {
      await post(
        `*${name}: Google has put its own hours on this listing.* Maps may show hours that differ from the ones compared here. Review Google's edits in Business Profile.`,
      )
    }
    result.checked++

    const dates = datesToCompare(today, profile, holidays.docs, location.id)
    const mismatches = compareHours({ dates, location, holidays: holidays.docs, profile })
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
    return { output: await runGoogleHoursCheck(req.payload, businessCredentials()) }
  },
}
