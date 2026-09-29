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
 * Read at module load on the client via NEXT_PUBLIC_*.
 */
export function isAblyClientEnabled(env: AblyEnv = process.env): boolean {
  return env.NEXT_PUBLIC_ABLY_ENABLED?.trim().toLowerCase() === 'true'
}
