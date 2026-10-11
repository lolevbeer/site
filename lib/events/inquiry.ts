/**
 * Private-event inquiry payload and server-side validation for the short
 * form on /events. The inquiry lands in the staff inbox (`event-inquiries`),
 * never in Events. Shared helpers come from lib/public-forms.
 */

import { isCalendarDate } from '@/lib/donate/donation-request'
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

export interface EventInquiryInput {
  name: string
  email: string
  phone: string
  /** YYYY-MM-DD. */
  preferredDate: string
  headcount: number | ''
  /** Location slug. The action stores the matching location ID. */
  taproom: string
  /** Optional. */
  message: string
  /** Hidden honeypot. Must stay empty. */
  companyUrlHp: string
}

export type EventInquiryErrors = Partial<Record<keyof EventInquiryInput, string>>

export type ValidatedEventInquiry = Omit<EventInquiryInput, 'headcount' | 'companyUrlHp'> & {
  headcount: number
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
    headcount: '',
    taproom: '',
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
  const email = trimmed(parsed.email)
  const phone = trimmed(parsed.phone)
  const preferredDate = trimmed(parsed.preferredDate)
  const headcount = Number(parsed.headcount)
  const taproom = trimmed(parsed.taproom)
  const message = trimmed(parsed.message)

  if (name.length < 2) errors.name = 'Enter your name.'
  else if (name.length > 200) errors.name = 'That answer is too long.'
  if (!isValidEmail(email)) errors.email = 'Enter a valid email.'
  if (!isValidPhone(phone)) errors.phone = 'Enter a phone number.'
  if (!isCalendarDate(preferredDate)) errors.preferredDate = 'Enter a preferred date.'
  else if (preferredDate < today) errors.preferredDate = 'Pick a date in the future.'
  if (
    parsed.headcount === '' ||
    !Number.isInteger(headcount) ||
    headcount < 1 ||
    headcount > EVENT_INQUIRY_MAX_HEADCOUNT
  ) {
    errors.headcount = 'Enter how many guests.'
  }
  if (!taproom || !taproomSlugs.includes(taproom)) errors.taproom = 'Choose a taproom.'
  if (message.length > EVENT_INQUIRY_MAX_TEXT) errors.message = 'That answer is too long.'
  rejectFormulaPrefix(name, errors, 'name')
  rejectFormulaPrefix(message, errors, 'message')

  if (Object.keys(errors).length > 0) return { ok: false, errors }
  return {
    ok: true,
    spam: false,
    value: { name, email, phone, preferredDate, headcount, taproom, message },
  }
}
