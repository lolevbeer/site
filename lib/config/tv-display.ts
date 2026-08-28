/**
 * Sizing constants for the fullscreen `/m/<id>` and `/e/<id>` boards.
 *
 * Those pages only ever render on a 16:9 television — a Samsung Frame and a
 * TCL — read from across the taproom. Two things follow from that, and both
 * are easy to lose track of inside component styles, so they live here.
 *
 * Kept in their own module rather than in featured-menu.tsx so that
 * draft-beer-card.tsx can use them without importing the component that
 * renders it.
 */

/**
 * Type sizes, each `max(<vh>, <px>)`: the vh term keeps a board scaling with
 * its frame, the px term is a floor so nothing falls below what is legible at
 * roughly ten feet. The column labels were previously a bare `1.2vh`, which is
 * 13px on a 1080p panel — under 1% of screen height.
 */
export const TV_TYPE = {
  label: 'max(1.6vh, 15px)',
  body: 'max(1.7vh, 16px)',
  badge: 'max(1.8vh, 16px)',
  tap: 'max(2.4vh, 22px)',
  /** The `/e/` agenda: a day heading, an item's time, an item's name. */
  eventDay: 'max(1.9vh, 17px)',
  eventTime: 'max(2.2vh, 20px)',
  eventName: 'max(3vh, 26px)',
} as const

/**
 * Safe-area inset. Televisions can overscan: on a 1920-wide panel a 3% crop
 * removes 58px a side, and the Full price column previously sat 19px from the
 * edge — inside the crop. 3vw/3vh keeps every column on screen on both sets.
 */
export const TV_SAFE_X = '3vw'
export const TV_SAFE_Y = '3vh'
