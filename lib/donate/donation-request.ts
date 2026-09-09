/**
 * Donation-request payload, gate copy, and server-side validation.
 *
 * The public form is a three-page ringer: page 1 is eligibility checkboxes,
 * page 2 is who they are, page 3 is the event and the ask. This module is the
 * single source of those rules so the UI labels and the server action cannot
 * drift. No EIN or IRS letter — fundraiser status is self-attested.
 */

import { joinLocationNames } from '@/lib/config/locations'
import {
  copyKnownFields,
  isValidEmail,
  isValidPhone,
  PUBLIC_FORM_INCOMPLETE,
  PUBLIC_FORM_MAX_EMAIL,
  PUBLIC_FORM_MAX_PHONE,
  rejectFormulaPrefix,
  trimmed,
} from '@/lib/public-forms/fields'
import { isHoneypotFilled } from '@/lib/public-forms/honeypot'
import { DEFAULT_SLACK_CHANNEL } from '@/lib/slack/mrkdwn'
import { getTodayEST } from '@/lib/utils/date'

export const DONATION_LEAD_DAYS = 30
/** Caps public text so a submit cannot dump megabytes into Mongo or Slack. */
export const DONATION_MAX_TEXT = 4000
export const DONATION_MAX_EMAIL = PUBLIC_FORM_MAX_EMAIL
export const DONATION_MAX_PHONE = PUBLIC_FORM_MAX_PHONE
export const DONATION_MAX_ATTENDEES = 10_000
export const DONATION_MAX_EVENT_YEARS = 2

/** Default Slack channel for donation pings. Prefer `donationSlackChannel()`. */
export const DONATION_SLACK_CHANNEL = DEFAULT_SLACK_CHANNEL

export type DonationAskType = 'product' | 'taproom-night'
export type PreviousDonation = 'yes' | 'no'

export const PAGE1_GATES = [
  {
    key: 'isFundraiser',
    label:
      'This request is for a nonprofit or community fundraiser, not a personal or for-profit event.',
  },
  {
    key: 'leadTimeOk',
    label: `The event is at least ${DONATION_LEAD_DAYS} days from today.`,
  },
  {
    key: 'nearbyOk',
    label: 'The venue is a reasonable drive from a Lolev taproom.',
  },
  {
    key: 'twentyOnePlus',
    label:
      'The event is 21+. Beer will not be served to anyone under 21, and this is not a school, youth, or kids event.',
  },
  {
    key: 'notExcludedCategory',
    label:
      'This is not a political, religious, sports-team, personal (wedding, birthday), or for-profit corporate event.',
  },
  {
    key: 'pickupOrOnSite',
    label:
      'If this is product, we will pick it up at a Lolev taproom. If this is a fundraiser night, it happens at a Lolev taproom.',
  },
  {
    key: 'understandsNotAYes',
    label:
      'I understand that submitting this form is not a yes. Lolev will email only if we can help.',
  },
] as const

export type Page1GateKey = (typeof PAGE1_GATES)[number]['key']

export const STEP1_KEYS: readonly Page1GateKey[] = PAGE1_GATES.map((gate) => gate.key)

export const STEP2_KEYS = [
  'organizationName',
  'contactName',
  'email',
  'phone',
  'mission',
  'howHeard',
  'previousDonation',
] as const satisfies ReadonlyArray<keyof DonationRequestInput>

/** Gate copy with taproom names from Payload — never a hardcoded list. */
export function page1Gates(
  locations: Array<{ name?: string | null }>,
): ReadonlyArray<{ key: Page1GateKey; label: string }> {
  const names = joinLocationNames(locations)
  const named = locations.filter((location) => location.name?.trim()).length
  return PAGE1_GATES.map((gate) => {
    if (gate.key !== 'nearbyOk' || !names) return gate
    const rooms = named === 1 ? 'taproom' : 'taprooms'
    return {
      ...gate,
      label: `The venue is a reasonable drive from our ${names} ${rooms}.`,
    }
  })
}

export interface DonationRequestInput {
  isFundraiser: boolean
  leadTimeOk: boolean
  nearbyOk: boolean
  twentyOnePlus: boolean
  notExcludedCategory: boolean
  pickupOrOnSite: boolean
  understandsNotAYes: boolean
  organizationName: string
  contactName: string
  email: string
  phone: string
  mission: string
  howHeard: string
  previousDonation: PreviousDonation | ''
  askType: DonationAskType | ''
  eventName: string
  eventDate: string
  venue: string
  attendees: number | ''
  requestDetails: string
  howServed: string
  recognition: string
  whyLolev: string
  pickupName: string
  taproom: string
  certify: boolean
  /** Hidden honeypot. Must stay empty. */
  companyUrlHp: string
}

export type DonationRequestErrors = Partial<Record<keyof DonationRequestInput, string>>

/** Successful, non-spam payload with askType / previousDonation / attendees narrowed. */
export type ValidatedDonationRequest = Omit<
  DonationRequestInput,
  'askType' | 'previousDonation' | 'attendees' | 'companyUrlHp'
> & {
  askType: DonationAskType
  previousDonation: PreviousDonation
  attendees: number
}

export type DonationValidation =
  | { ok: true; spam: true }
  | { ok: true; spam: false; value: ValidatedDonationRequest }
  | { ok: false; errors: DonationRequestErrors }

function addCalendarDays(ymd: string, days: number): string {
  const [year, month, day] = ymd.split('-').map(Number)
  const dt = new Date(Date.UTC(year, month - 1, day + days))
  return dt.toISOString().slice(0, 10)
}

export function minimumEventDate(today = getTodayEST()): string {
  return addCalendarDays(today, DONATION_LEAD_DAYS)
}

function maximumEventDate(today = getTodayEST()): string {
  const [year, month, day] = today.split('-').map(Number)
  return new Date(Date.UTC(year + DONATION_MAX_EVENT_YEARS, month - 1, day)).toISOString().slice(0, 10)
}

function fail(errors: DonationRequestErrors): DonationValidation {
  return { ok: false, errors }
}

export function isCalendarDate(ymd: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return false
  const parsed = new Date(`${ymd}T00:00:00.000Z`)
  if (Number.isNaN(parsed.getTime())) return false
  return parsed.toISOString().slice(0, 10) === ymd
}

const LENGTH_KEYS = [
  'organizationName',
  'contactName',
  'mission',
  'howHeard',
  'eventName',
  'venue',
  'requestDetails',
  'howServed',
  'recognition',
  'whyLolev',
  'pickupName',
  'taproom',
] as const

const STEP2_LENGTH_KEYS = ['organizationName', 'contactName', 'mission', 'howHeard'] as const

function addLengthAndFormulaErrors(
  input: DonationRequestInput,
  errors: DonationRequestErrors,
  keys: ReadonlyArray<(typeof LENGTH_KEYS)[number]>,
): void {
  for (const key of keys) {
    const value = trimmed(input[key])
    if (value.length > DONATION_MAX_TEXT) errors[key] = 'That answer is too long.'
    rejectFormulaPrefix(value, errors, key)
  }
}

/**
 * Copy known keys off an untrusted payload. Extra keys are ignored.
 */
export function readDonationRequestInput(input: unknown): DonationRequestInput | null {
  return copyKnownFields(emptyDonationRequest(), input)
}

function addOrgErrors(input: DonationRequestInput, errors: DonationRequestErrors): void {
  if (trimmed(input.organizationName).length < 2) {
    errors.organizationName = 'Enter the organization name.'
  }
  if (trimmed(input.contactName).length < 2) {
    errors.contactName = 'Enter a contact name.'
  }
  if (!isValidEmail(trimmed(input.email))) {
    errors.email = 'Enter a valid email.'
  }
  if (!isValidPhone(trimmed(input.phone))) {
    errors.phone = 'Enter a phone number.'
  }
  if (trimmed(input.mission).length < 80) {
    errors.mission = 'Tell us what the organization does (at least 80 characters).'
  }
  if (trimmed(input.howHeard).length < 20) {
    errors.howHeard = 'Tell us how you heard about Lolev (at least 20 characters).'
  }
  if (input.previousDonation !== 'yes' && input.previousDonation !== 'no') {
    errors.previousDonation = 'Say whether we have donated before.'
  }
}

function addAskErrors(
  input: DonationRequestInput,
  errors: DonationRequestErrors,
  today: string,
  taproomSlugs?: readonly string[],
): void {
  if (input.askType !== 'product' && input.askType !== 'taproom-night') {
    errors.askType = 'Choose product pickup or a taproom fundraiser night.'
  }
  if (trimmed(input.eventName).length < 2) {
    errors.eventName = 'Enter the event name.'
  }

  const eventDate = trimmed(input.eventDate)
  if (!isCalendarDate(eventDate)) {
    errors.eventDate = 'Enter the event date.'
  } else if (eventDate < minimumEventDate(today)) {
    errors.eventDate = `The event must be at least ${DONATION_LEAD_DAYS} days out.`
  } else if (eventDate > maximumEventDate(today)) {
    errors.eventDate = 'Pick a date within two years.'
  }

  if (trimmed(input.venue).length < 5) {
    errors.venue = 'Enter the venue and city.'
  }
  const attendees = Number(input.attendees)
  if (!Number.isInteger(attendees) || attendees < 1 || attendees > DONATION_MAX_ATTENDEES) {
    errors.attendees = 'Enter expected 21+ attendance.'
  }
  if (trimmed(input.requestDetails).length < 40) {
    errors.requestDetails = 'Describe what you are asking for (at least 40 characters).'
  }
  if (input.askType === 'product' && trimmed(input.howServed).length < 20) {
    errors.howServed = 'Describe how the beer will be served.'
  }
  if (trimmed(input.recognition).length < 40) {
    errors.recognition = 'Describe how Lolev will be recognized (at least 40 characters).'
  }
  if (trimmed(input.whyLolev).length < 80) {
    errors.whyLolev = 'Tell us why Lolev, specifically (at least 80 characters).'
  }
  if (input.askType === 'product' && trimmed(input.pickupName).length < 2) {
    errors.pickupName = 'Who is picking up, and are they 21+?'
  }
  const taproom = trimmed(input.taproom)
  if (input.askType === 'taproom-night') {
    if (!taproom) {
      errors.taproom = 'Choose a taproom.'
    } else if (taproomSlugs && !taproomSlugs.includes(taproom)) {
      errors.taproom = 'Choose a taproom.'
    }
  }
  if (input.certify !== true) {
    errors.certify = 'Required'
  }
}

/**
 * Validate a donation request. Callers must treat `{ ok: true, spam: true }` as
 * a silent success: do not persist, do not Slack.
 *
 * `input` is untrusted. Non-objects become a generic field error, not a throw.
 */
export function validateDonationRequest(
  input: unknown,
  today = getTodayEST(),
  taproomSlugs?: readonly string[],
): DonationValidation {
  const parsed = readDonationRequestInput(input)
  if (!parsed) {
    return fail({ organizationName: PUBLIC_FORM_INCOMPLETE })
  }

  if (isHoneypotFilled(parsed.companyUrlHp)) return { ok: true, spam: true }

  const errors: DonationRequestErrors = {}

  for (const gate of PAGE1_GATES) {
    if (parsed[gate.key] !== true) errors[gate.key] = 'Required'
  }

  addOrgErrors(parsed, errors)
  addAskErrors(parsed, errors, today, taproomSlugs)
  addLengthAndFormulaErrors(parsed, errors, LENGTH_KEYS)
  rejectFormulaPrefix(trimmed(parsed.email), errors, 'email')

  if (Object.keys(errors).length > 0) return fail(errors)
  return { ok: true, spam: false, value: toValidatedDonation(parsed) }
}

function toValidatedDonation(input: DonationRequestInput): ValidatedDonationRequest {
  const askType = input.askType === 'taproom-night' ? 'taproom-night' : 'product'
  const previousDonation = input.previousDonation === 'yes' ? 'yes' : 'no'
  return {
    isFundraiser: true,
    leadTimeOk: true,
    nearbyOk: true,
    twentyOnePlus: true,
    notExcludedCategory: true,
    pickupOrOnSite: true,
    understandsNotAYes: true,
    organizationName: trimmed(input.organizationName),
    contactName: trimmed(input.contactName),
    email: trimmed(input.email),
    phone: trimmed(input.phone),
    mission: trimmed(input.mission),
    howHeard: trimmed(input.howHeard),
    previousDonation,
    askType,
    eventName: trimmed(input.eventName),
    eventDate: trimmed(input.eventDate),
    venue: trimmed(input.venue),
    attendees: Number(input.attendees),
    requestDetails: trimmed(input.requestDetails),
    howServed: askType === 'product' ? trimmed(input.howServed) : '',
    recognition: trimmed(input.recognition),
    whyLolev: trimmed(input.whyLolev),
    pickupName: askType === 'product' ? trimmed(input.pickupName) : '',
    taproom: askType === 'taproom-night' ? trimmed(input.taproom) : '',
    certify: true,
  }
}

export function donationStepErrors(
  step: 1 | 2 | 3,
  input: DonationRequestInput,
  today = getTodayEST(),
  taproomSlugs?: readonly string[],
): DonationRequestErrors {
  const errors: DonationRequestErrors = {}
  if (step === 1) {
    for (const gate of PAGE1_GATES) {
      if (input[gate.key] !== true) errors[gate.key] = 'Required'
    }
    return errors
  }
  if (step === 2) {
    addOrgErrors(input, errors)
    addLengthAndFormulaErrors(input, errors, STEP2_LENGTH_KEYS)
    return errors
  }
  addAskErrors(input, errors, today, taproomSlugs)
  return errors
}

export function firstDonationErrorStep(errors: DonationRequestErrors): 1 | 2 | 3 {
  if (STEP1_KEYS.some((key) => errors[key])) return 1
  if (STEP2_KEYS.some((key) => errors[key])) return 2
  return 3
}

/** Empty form state for the public ringer. */
export function emptyDonationRequest(): DonationRequestInput {
  return {
    isFundraiser: false,
    leadTimeOk: false,
    nearbyOk: false,
    twentyOnePlus: false,
    notExcludedCategory: false,
    pickupOrOnSite: false,
    understandsNotAYes: false,
    organizationName: '',
    contactName: '',
    email: '',
    phone: '',
    mission: '',
    howHeard: '',
    previousDonation: '',
    askType: '',
    eventName: '',
    eventDate: '',
    venue: '',
    attendees: '',
    requestDetails: '',
    howServed: '',
    recognition: '',
    whyLolev: '',
    pickupName: '',
    taproom: '',
    certify: false,
    companyUrlHp: '',
  }
}
