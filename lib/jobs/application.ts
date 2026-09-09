/**
 * Public job-application payload and validation.
 */

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

export const JOB_APPLICATION_MAX_TEXT = 4000
export const JOB_APPLICATION_MAX_EMAIL = PUBLIC_FORM_MAX_EMAIL
export const JOB_APPLICATION_MAX_PHONE = PUBLIC_FORM_MAX_PHONE

export interface JobApplicationInput {
  jobSlug: string
  name: string
  email: string
  phone: string
  message: string
  /** Honeypot. Must stay empty. */
  companyUrlHp: string
}

export type JobApplicationErrors = Partial<Record<keyof JobApplicationInput, string>>

export type JobApplicationValidation =
  | { ok: true; spam: boolean }
  | { ok: false; errors: JobApplicationErrors }

/** Empty apply-form state for one opening. */
export function emptyJobApplication(jobSlug = ''): JobApplicationInput {
  return {
    jobSlug,
    name: '',
    email: '',
    phone: '',
    message: '',
    companyUrlHp: '',
  }
}

export function readJobApplicationInput(input: unknown): JobApplicationInput | null {
  return copyKnownFields(emptyJobApplication(), input)
}

export function validateJobApplication(input: unknown): JobApplicationValidation {
  const parsed = readJobApplicationInput(input)
  if (!parsed) {
    return { ok: false, errors: { name: PUBLIC_FORM_INCOMPLETE } }
  }
  if (isHoneypotFilled(parsed.companyUrlHp)) return { ok: true, spam: true }

  const errors: JobApplicationErrors = {}
  const jobSlug = trimmed(parsed.jobSlug)
  const name = trimmed(parsed.name)
  const email = trimmed(parsed.email)
  const phone = trimmed(parsed.phone)
  const message = trimmed(parsed.message)

  if (!jobSlug || jobSlug.length > 200) errors.jobSlug = 'Missing job.'
  if (name.length < 2) errors.name = 'Enter your name.'
  if (!isValidEmail(email)) errors.email = 'Enter a valid email.'
  if (!isValidPhone(phone)) errors.phone = 'Enter a phone number.'
  if (message.length < 40) {
    errors.message = 'Tell us why you want the role (at least 40 characters).'
  }
  if (name.length > JOB_APPLICATION_MAX_TEXT) errors.name = 'That answer is too long.'
  rejectFormulaPrefix(name, errors, 'name')
  if (message.length > JOB_APPLICATION_MAX_TEXT) errors.message = 'That answer is too long.'
  rejectFormulaPrefix(message, errors, 'message')

  if (Object.keys(errors).length > 0) return { ok: false, errors }
  return { ok: true, spam: false }
}
