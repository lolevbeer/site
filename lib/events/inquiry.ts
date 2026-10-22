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

export interface EventInquiryInput {
  name: string
  email: string
  /** Optional. Validated only when filled in. */
  phone: string
  /** YYYY-MM-DD. */
  preferredDate: string
  /** Visitor can move the date. */
  flexibleDate: boolean
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
  'headcount' | 'occasion' | 'companyUrlHp'
> & {
  headcount: number
  occasion: EventInquiryOccasion | ''
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
  const message = trimmed(parsed.message)

  if (name.length < 2) errors.name = 'Enter your name.'
  else if (name.length > 200) errors.name = 'That answer is too long.'
  if (!isValidEmail(email)) errors.email = 'Enter a valid email.'
  if (phone && !isValidPhone(phone)) errors.phone = 'Enter a full phone number or leave it blank.'
  if (!isCalendarDate(preferredDate)) errors.preferredDate = 'Enter a preferred date.'
  else if (preferredDate < today) errors.preferredDate = 'Pick a date in the future.'
  else if (preferredDate > maximumEventDate(today)) {
    errors.preferredDate = 'Pick a date within two years.'
  }
  if (!Number.isInteger(headcount) || headcount < 1 || headcount > EVENT_INQUIRY_MAX_HEADCOUNT) {
    errors.headcount = 'Enter how many guests.'
  }
  if (!taproom || !taproomSlugs.includes(taproom)) errors.taproom = 'Choose a taproom.'
  if (occasion && !occasionAdminLabel(occasion)) errors.occasion = 'Choose an occasion.'
  if (message.length > EVENT_INQUIRY_MAX_TEXT) errors.message = 'That answer is too long.'
  rejectFormulaPrefix(name, errors, 'name')
  rejectFormulaPrefix(email, errors, 'email')
  rejectFormulaPrefix(message, errors, 'message')

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
      headcount,
      taproom,
      // Checked against EVENT_INQUIRY_OCCASIONS above.
      occasion: occasion as EventInquiryOccasion | '',
      message,
    },
  }
}
