/**
 * In-memory sliding window for public Server Actions.
 * Per-isolate only (Vercel instances do not share this map). Durable
 * per-email limits still run against the collection in the action.
 */

const hits = new Map<string, number[]>()

export const PUBLIC_FORM_IP_MAX = 3
export const PUBLIC_FORM_IP_WINDOW_MS = 60 * 60 * 1000
export const PUBLIC_FORM_EMAIL_MAX = 1
export const PUBLIC_FORM_EMAIL_WINDOW_MS = 10 * 60 * 1000
export const PUBLIC_FORM_IP_LIMIT_MESSAGE = 'Too many requests. Try again in an hour.'
export const PUBLIC_FORM_EMAIL_LIMIT_MESSAGE = 'Too many requests. Try again in a few minutes.'

/**
 * True when this `key` is still under `max` hits in `windowMs`.
 * Records the attempt on success.
 */
export function allowAttempt(
  key: string,
  max: number,
  windowMs: number,
  now = Date.now(),
): boolean {
  const cutoff = now - windowMs
  const prior = (hits.get(key) || []).filter((time) => time > cutoff)
  if (prior.length >= max) {
    hits.set(key, prior)
    return false
  }
  prior.push(now)
  hits.set(key, prior)
  return true
}

export function allowIpAttempt(scope: string, ip: string): boolean {
  return allowAttempt(`${scope}:ip:${ip}`, PUBLIC_FORM_IP_MAX, PUBLIC_FORM_IP_WINDOW_MS)
}

export function allowEmailAttempt(scope: string, email: string): boolean {
  return allowAttempt(
    `${scope}:email:${email}`,
    PUBLIC_FORM_EMAIL_MAX,
    PUBLIC_FORM_EMAIL_WINDOW_MS,
  )
}

/** True when `createdAt` is inside `windowMs`. Invalid dates are not recent. */
export function isRecentTimestamp(
  createdAt: string | undefined,
  windowMs: number,
  now = Date.now(),
): boolean {
  if (!createdAt) return false
  const then = new Date(createdAt).getTime()
  return Number.isFinite(then) && now - then < windowMs
}

/** Test-only. */
export function resetPublicFormRateLimit(): void {
  hits.clear()
}
