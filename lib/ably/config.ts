/**
 * Feature flags for the Ably kiosk realtime spike.
 *
 * - Server publish runs whenever ABLY_API_KEY is set (no-op otherwise).
 * - Clients subscribe only when NEXT_PUBLIC_ABLY_ENABLED=true, so a missing
 *   or misconfigured key never changes display behavior: polling continues.
 */

/** Readable env bag for tests and process.env. */
export type AblyEnv = Record<string, string | undefined>

/** True when the server may publish invalidate messages. */
export function isAblyPublishEnabled(env: AblyEnv = process.env): boolean {
  return Boolean(env.ABLY_API_KEY?.trim())
}

/**
 * True when kiosk clients should open an Ably connection.
 *
 * Next.js only inlines *direct* `process.env.NEXT_PUBLIC_*` member access into
 * the client bundle. Reading a key from a `process.env` object alias is always
 * undefined in the browser, which would permanently disable Ably even when the
 * Preview/Production env var is set. Call with no args in client components;
 * pass an explicit `env` bag only from tests.
 */
export function isAblyClientEnabled(env?: AblyEnv): boolean {
  if (env) {
    return env.NEXT_PUBLIC_ABLY_ENABLED?.trim().toLowerCase() === 'true'
  }
  return process.env.NEXT_PUBLIC_ABLY_ENABLED?.trim().toLowerCase() === 'true'
}
