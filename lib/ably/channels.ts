/**
 * Shared Ably channel names and invalidate payload for kiosk TV displays.
 *
 * Displays subscribe; CMS revalidation publishes lightweight "updated"
 * signals so TVs can refetch the existing stream endpoints instead of
 * waiting for the next idle poll.
 */

export const ABLY_CHANNELS = {
  menu: 'kiosk:menu',
  events: 'kiosk:events',
} as const

export type AblyChannelName = (typeof ABLY_CHANNELS)[keyof typeof ABLY_CHANNELS]

/** Message name clients subscribe to on the kiosk channels. */
export const ABLY_UPDATED_EVENT = 'updated'

export type KioskInvalidateKind = 'menu' | 'events'

/**
 * Lightweight invalidate payload. Prefer scoped `key` (menu url or location
 * slug) when known; omit it to ask every display on that channel to refresh.
 */
export interface KioskInvalidateMessage {
  kind: KioskInvalidateKind
  key?: string
  at: number
}

/** Capability map for kiosk clients: subscribe-only on the two channels. */
export const KIOSK_SUBSCRIBE_CAPABILITY: Record<string, ['subscribe']> = {
  [ABLY_CHANNELS.menu]: ['subscribe'],
  [ABLY_CHANNELS.events]: ['subscribe'],
}
