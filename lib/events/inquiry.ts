/**
 * Private-event inquiry payload and server-side validation for the form on
 * /private-events. The inquiry lands in the staff inbox (`event-inquiries`),
 * never in Events. Shared helpers come from lib/public-forms.
 */

import { isCalendarDate, maximumEventDate } from '@/lib/donate/donation-request'
import {
  copyKnownFields,
  isValidEmail,
  isValidPhone,
  PUBLIC_FORM_INCOMPLETE,
  rejectFormulaPrefix,
  trimmed,
} from '@/lib/public-forms/fields'
import { isHoneypotFilled } from '@/lib/public-forms/honeypot'
import { getTodayEST } from '@/lib/utils/date'

export const EVENT_INQUIRY_MAX_TEXT = 2000
export const EVENT_INQUIRY_MAX_HEADCOUNT = 500
/** Extra days a flexible visitor can offer besides the preferred date. */
export const EVENT_INQUIRY_MAX_OTHER_DATES = 10

/** One-tap occasion choices. `label` is the short form button; `adminLabel` shows in Admin and Slack. */
export const EVENT_INQUIRY_OCCASIONS = [
  { value: 'birthday', label: 'Birthday', adminLabel: 'Birthday' },
  { value: 'work', label: 'Work', adminLabel: 'Work event' },
  { value: 'wedding', label: 'Wedding', adminLabel: 'Wedding or rehearsal' },
  { value: 'other', label: 'Other', adminLabel: 'Other' },
] as const

export type EventInquiryOccasion = (typeof EVENT_INQUIRY_OCCASIONS)[number]['value']

export function occasionAdminLabel(value: string): string | undefined {
  return EVENT_INQUIRY_OCCASIONS.find((option) => option.value === value)?.adminLabel
}

/** Event length. '3h' is the form's default. */
export const EVENT_INQUIRY_DURATIONS = [
  { value: '3h', label: '3 hours' },
  { value: '4h', label: '4 hours' },
  { value: '5h+', label: '5+ hours' },
] as const

export const EVENT_INQUIRY_DRINKS = [
  { value: 'host-tab', label: "I'll run a host tab" },
  { value: 'guests-pay', label: 'Guests pay for their own drinks' },
  { value: 'not-sure', label: 'Not sure yet' },
] as const

export const EVENT_INQUIRY_FOOD_PLANS = [
  { value: 'caterer', label: 'Bringing a caterer' },
  { value: 'food-truck', label: 'Food truck' },
  { value: 'own-food', label: 'Bringing our own food' },
  { value: 'suggestions', label: 'Need suggestions' },
] as const

export const EVENT_INQUIRY_YES_NO = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
] as const

type OptionValue<T extends readonly { value: string }[]> = T[number]['value']

/** Label for a stored option value; undefined when blank or unknown. */
export function optionLabel(
  options: readonly { value: string; label: string }[],
  value: string | null | undefined,
): string | undefined {
  return options.find((option) => option.value === value)?.label
}

/** HH:MM, 24-hour, from `<input type="time">`. */
const START_TIME = /^([01]\d|2[0-3]):[0-5]\d$/

export interface EventInquiryInput {
  name: string
  email: string
  /** Optional. Validated only when filled in. */
  phone: string
  /** YYYY-MM-DD. */
  preferredDate: string
  /** Visitor can move the date. */
  flexibleDate: boolean
  /** YYYY-MM-DD days that also work. Kept only when flexibleDate is true. */
  otherDates: string[]
  /** Optional YYYY-MM-DD second choice; must differ from preferredDate. */
  backupDate: string
  /** HH:MM, 24-hour, Eastern. */
  startTime: string
  /** An EVENT_INQUIRY_DURATIONS value. */
  duration: string
  /** An EVENT_INQUIRY_DRINKS value. */
  drinks: string
  /** 'yes' | 'no'. */
  companyPaid: string
  /** Required when companyPaid is 'yes'; dropped otherwise. */
  companyName: string
  /** Optional. An EVENT_INQUIRY_FOOD_PLANS value or ''. */
  foodPlan: string
  headcount: number | ''
  /** Location slug. The action stores the matching location ID. */
  taproom: string
  /** Optional. An EVENT_INQUIRY_OCCASIONS value or ''. */
  occasion: string
  /** Optional. */
  message: string
  /** Hidden honeypot. Must stay empty. */
  companyUrlHp: string
}

export type EventInquiryErrors = Partial<Record<keyof EventInquiryInput, string>>

export type ValidatedEventInquiry = Omit<
  EventInquiryInput,
  'headcount' | 'occasion' | 'duration' | 'drinks' | 'companyPaid' | 'foodPlan' | 'companyUrlHp'
> & {
  headcount: number
  occasion: EventInquiryOccasion | ''
  duration: OptionValue<typeof EVENT_INQUIRY_DURATIONS>
  drinks: OptionValue<typeof EVENT_INQUIRY_DRINKS>
  companyPaid: OptionValue<typeof EVENT_INQUIRY_YES_NO>
  foodPlan: OptionValue<typeof EVENT_INQUIRY_FOOD_PLANS> | ''
}

export type EventInquiryValidation =
  | { ok: true; spam: true }
  | { ok: true; spam: false; value: ValidatedEventInquiry }
  | { ok: false; errors: EventInquiryErrors }

export function emptyEventInquiry(): EventInquiryInput {
  return {
    name: '',
    email: '',
    phone: '',
    preferredDate: '',
    flexibleDate: false,
    otherDates: [],
    backupDate: '',
    startTime: '',
    duration: '3h',
    drinks: '',
    companyPaid: '',
    companyName: '',
    foodPlan: '',
    headcount: '',
    taproom: '',
    occasion: '',
    message: '',
    companyUrlHp: '',
  }
}

export function readEventInquiryInput(input: unknown): EventInquiryInput | null {
  return copyKnownFields(emptyEventInquiry(), input)
}

/**
 * Validate an inquiry. `{ ok: true, spam: true }` is a silent success: do not
 * persist, do not Slack. `taproomSlugs` are the active locations' slugs.
 */
export function validateEventInquiry(
  input: unknown,
  today = getTodayEST(),
  taproomSlugs: readonly string[] = [],
): EventInquiryValidation {
  const parsed = readEventInquiryInput(input)
  if (!parsed) return { ok: false, errors: { name: PUBLIC_FORM_INCOMPLETE } }
  if (isHoneypotFilled(parsed.companyUrlHp)) return { ok: true, spam: true }

  const errors: EventInquiryErrors = {}
  const name = trimmed(parsed.name)
  // Lowercase so the duplicate check and the email rate limit see one address.
  const email = trimmed(parsed.email).toLowerCase()
  const phone = trimmed(parsed.phone)
  const preferredDate = trimmed(parsed.preferredDate)
  // Untrusted: a number, or a digit string from a plain form post. Number()
  // alone would turn `true` into 1 and '1e2' into 100.
  const headcount =
    typeof parsed.headcount === 'number' ||
    (typeof parsed.headcount === 'string' && /^\d+$/.test(parsed.headcount))
      ? Number(parsed.headcount)
      : NaN
  const taproom = trimmed(parsed.taproom)
  const occasion = trimmed(parsed.occasion)
  // Untrusted: only a real boolean true counts.
  const flexibleDate = parsed.flexibleDate === true
  // Untrusted: must be an array of strings. Sorted, de-duplicated, and
  // without the preferred date; ignored unless the date is flexible.
  const rawOtherDates: unknown = flexibleDate ? parsed.otherDates : []
  const otherDates = Array.isArray(rawOtherDates)
    ? [...new Set(rawOtherDates.map((d) => (typeof d === 'string' ? d.trim() : '')))]
        .filter((d) => d !== preferredDate)
        .sort()
    : null
  const message = trimmed(parsed.message)
  const backupDate = trimmed(parsed.backupDate)
  const startTime = trimmed(parsed.startTime)
  const duration = trimmed(parsed.duration)
  const drinks = trimmed(parsed.drinks)
  const companyPaid = trimmed(parsed.companyPaid)
  // Only kept when a company is paying.
  const companyName = companyPaid === 'yes' ? trimmed(parsed.companyName) : ''
  const foodPlan = trimmed(parsed.foodPlan)

  if (name.length < 2) errors.name = 'Enter your name.'
  else if (name.length > 200) errors.name = 'That answer is too long.'
  if (!isValidEmail(email)) errors.email = 'Enter a valid email.'
  if (phone && !isValidPhone(phone)) errors.phone = 'Enter a full phone number or leave it blank.'
  if (!isCalendarDate(preferredDate)) errors.preferredDate = 'Enter a preferred date.'
  else if (preferredDate < today) errors.preferredDate = 'Pick a date in the future.'
  else if (preferredDate > maximumEventDate(today)) {
    errors.preferredDate = 'Pick a date within two years.'
  }
  if (backupDate) {
    if (!isCalendarDate(backupDate)) errors.backupDate = 'Enter a backup date or leave it blank.'
    else if (backupDate < today) errors.backupDate = 'Pick a date in the future.'
    else if (backupDate > maximumEventDate(today)) {
      errors.backupDate = 'Pick a date within two years.'
    } else if (backupDate === preferredDate) {
      errors.backupDate = 'Pick a different day than the preferred date.'
    }
  }
  if (!START_TIME.test(startTime)) errors.startTime = 'Enter a start time.'
  if (!optionLabel(EVENT_INQUIRY_DURATIONS, duration)) errors.duration = 'Choose how long.'
  if (!optionLabel(EVENT_INQUIRY_DRINKS, drinks)) errors.drinks = 'Choose how drinks are handled.'
  if (!optionLabel(EVENT_INQUIRY_YES_NO, companyPaid)) errors.companyPaid = 'Choose yes or no.'
  if (companyPaid === 'yes') {
    if (companyName.length < 2) errors.companyName = 'Enter the company name.'
    else if (companyName.length > 200) errors.companyName = 'That answer is too long.'
  }
  if (foodPlan && !optionLabel(EVENT_INQUIRY_FOOD_PLANS, foodPlan)) {
    errors.foodPlan = 'Choose a food plan.'
  }
  if (!Number.isInteger(headcount) || headcount < 1 || headcount > EVENT_INQUIRY_MAX_HEADCOUNT) {
    errors.headcount = 'Enter how many guests.'
  }
  if (!taproom || !taproomSlugs.includes(taproom)) errors.taproom = 'Choose a taproom.'
  if (occasion && !occasionAdminLabel(occasion)) errors.occasion = 'Choose an occasion.'
  if (
    !otherDates ||
    otherDates.length > EVENT_INQUIRY_MAX_OTHER_DATES ||
    otherDates.some((d) => !isCalendarDate(d) || d < today || d > maximumEventDate(today))
  ) {
    errors.otherDates = `Pick up to ${EVENT_INQUIRY_MAX_OTHER_DATES} other dates within two years.`
  }
  if (message.length > EVENT_INQUIRY_MAX_TEXT) errors.message = 'That answer is too long.'
  rejectFormulaPrefix(name, errors, 'name')
  rejectFormulaPrefix(email, errors, 'email')
  rejectFormulaPrefix(message, errors, 'message')
  rejectFormulaPrefix(companyName, errors, 'companyName')

  if (Object.keys(errors).length > 0) return { ok: false, errors }
  return {
    ok: true,
    spam: false,
    value: {
      name,
      email,
      phone,
      preferredDate,
      flexibleDate,
      otherDates: otherDates ?? [],
      backupDate,
      startTime,
      // Option values are checked against their lists above.
      duration: duration as ValidatedEventInquiry['duration'],
      drinks: drinks as ValidatedEventInquiry['drinks'],
      companyPaid: companyPaid as ValidatedEventInquiry['companyPaid'],
      companyName,
      foodPlan: foodPlan as ValidatedEventInquiry['foodPlan'],
      headcount,
      taproom,
      // Checked against EVENT_INQUIRY_OCCASIONS above.
      occasion: occasion as EventInquiryOccasion | '',
      message,
    },
  }
}
