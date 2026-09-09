/**
 * Shared copy/validation helpers for public donate and job forms.
 * Extra keys on an untrusted payload are ignored.
 */

export const PUBLIC_FORM_MAX_EMAIL = 254
export const PUBLIC_FORM_MAX_PHONE = 32
export const PUBLIC_FORM_INCOMPLETE = 'Please complete every required field.'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/
const FORMULA_RE = /^[=+\-@]/

export const FORMULA_PREFIX_ERROR = 'Do not start that answer with =, +, @, or -.'

export function trimmed(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function isValidEmail(email: string): boolean {
  return email.length <= PUBLIC_FORM_MAX_EMAIL && !email.includes('..') && EMAIL_RE.test(email)
}

export function isValidPhone(phone: string, maxLength = PUBLIC_FORM_MAX_PHONE): boolean {
  const digits = phone.replace(/\D/g, '')
  return digits.length >= 10 && digits.length <= 15 && !/^0+$/.test(digits) && phone.length <= maxLength
}

export function rejectFormulaPrefix(
  value: string,
  errors: Record<string, string | undefined>,
  key: string,
): void {
  if (value && FORMULA_RE.test(value)) {
    errors[key] = FORMULA_PREFIX_ERROR
  }
}

export function firstFieldError(
  errors: Record<string, string | undefined>,
  fallback = PUBLIC_FORM_INCOMPLETE,
): string {
  return Object.values(errors).find(Boolean) || fallback
}

/**
 * Copy known keys onto `defaults`. A legacy `website` field fills the
 * honeypot when `companyUrlHp` is absent (bots that still post the old name).
 */
export function copyKnownFields<T extends { companyUrlHp: unknown }>(
  defaults: T,
  input: unknown,
): T | null {
  if (!input || typeof input !== 'object') return null
  const src = input as Record<string, unknown>
  const next = { ...defaults }
  for (const key of Object.keys(next) as Array<keyof T & string>) {
    if (key in src) {
      ;(next as Record<string, unknown>)[key] = src[key]
    }
  }
  if ('website' in src && !('companyUrlHp' in src)) {
    next.companyUrlHp = typeof src.website === 'string' ? src.website : '1'
  }
  return next
}
