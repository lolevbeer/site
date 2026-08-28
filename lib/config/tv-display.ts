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
 * Type sizes, in `vh` only.
 *
 * The frame is always 16:9, so one viewport-relative unit is enough to fix the
 * whole layout: every length below is a fraction of the frame, and the board
 * therefore looks identical on a 1920x1080 panel, a 3840x2160 one, and in a
 * 960x540 preview window. Only the pixel count changes.
 *
 * These were briefly `max(<vh>, <px>)`, with the px term meant as a legibility
 * floor for reading at ten feet. That was wrong: a px floor does not scale, so
 * below roughly 1080p the floor won every comparison and the type stayed at its
 * 1080p pixel size on a frame half the size — text then overlapped its
 * neighbours and names truncated that fit fine on the real display. Legibility
 * at distance is a function of how large the type is *relative to the screen*,
 * which is exactly what vh already expresses; the floor was solving a problem
 * that only exists for a layout not pinned to an aspect ratio.
 */
export const TV_TYPE = {
  label: '1.6vh',
  body: '1.7vh',
  badge: '1.8vh',
  tap: '2.4vh',
  /** The `/e/` agenda: a day heading, an item's time, an item's name. */
  eventDay: '1.9vh',
  eventTime: '2.2vh',
  eventName: '3vh',
} as const

/**
 * Padding and radius for a pill on the boards, matching {@link TV_TYPE.badge}.
 *
 * The shared `Badge` sets `px-2.5 py-0.5` and `rounded-full` in rem, which do
 * not scale with the frame: at half resolution the text shrank with the board
 * while the pill around it did not, so the pills bloated and pushed the beer
 * names out. Passing these as inline styles overrides the rem values.
 */
export const TV_BADGE_STYLE = {
  padding: '0.3vh 1vh',
  borderRadius: '99vh',
} as const

/**
 * Header logo, sized off the frame rather than a fixed 48x52 px. The `Logo`
 * component's own width/height props are numbers baked onto the SVG, so the
 * size is applied to its wrapper and the SVG is stretched to fill it.
 */
export const TV_LOGO_CLASS = 'w-[4.5vh] h-[4.9vh] [&>svg]:w-full [&>svg]:h-full'

/**
 * Safe-area inset. Televisions can overscan: on a 1920-wide panel a 3% crop
 * removes 58px a side, and the Full price column previously sat 19px from the
 * edge — inside the crop. 3vw/3vh keeps every column on screen on both sets.
 */
export const TV_SAFE_X = '3vw'
export const TV_SAFE_Y = '3vh'

/**
 * Fixed widths for the draft board's columns, shared by the header and the
 * rows so the two cannot drift apart.
 *
 * These are `width`, not `minWidth`, on purpose. The tap column used to be a
 * 7vh minimum holding a tap number beside a 6vh glass icon — which together
 * overflow 7vh, so the column grew to fit its content and grew by a different
 * amount for a one-digit tap than a two-digit one. Every beer name and hop
 * line then started at a slightly different x down the column.
 */
export const TV_COL = {
  /** Holds the tap number and the glass icon. Sized so the two read as one
   *  unit: at 10vh the pair was pushed to opposite ends of the column and the
   *  gap between them measured 28–42px, varying with the digit count. */
  tap: '8vh',
  abv: '7vh',
  /** Wide enough for "$11" at the price type size, and no wider. It was 8vh,
   *  which left the beer column ~8px short of fitting the longest beer name;
   *  that space is worth more to the name than to padding beside a price. */
  price: '7vh',
  /** Reserved for the Untappd rating, so the hop list starts at the same x
   *  whether or not a beer has been scored yet. */
  rating: '7vh',
} as const
