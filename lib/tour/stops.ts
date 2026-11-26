/**
 * The five stops of the homepage scroll tour through the Lawrenceville brewery
 * model: where the camera stands at each, where the can stands, and the page
 * each stop links to. Plain data; `pose.ts` turns scroll progress into a camera.
 *
 * Coordinates are in the HQ model's feet: x east, y up, z south. They are copied
 * from the model's sources (cited per stop, paths under `hq/3d/src/`) and will
 * be tuned by eye once the scene renders (plan task D1).
 */

export type TourStopId = 'can' | 'bar' | 'seating' | 'brewery' | 'visit'

export interface TourStop {
  id: TourStopId
  label: string
  href: string
  /** Camera position and target, in HQ's feet. */
  camera: { p: [number, number, number]; t: [number, number, number] }
  /** HQ group switches: ceiling and upper floor. */
  ceil: boolean
  up: boolean
  /** Where the can stands at this stop, in feet; null hides it. */
  can: [number, number, number] | null
}

// The can's base on the straight bar's top. interior/bar.js: the bar runs east
// from x 31.78 for 18.55 ft, its guest edge at z 72.37 and its top 2.583 ft deep
// to the north. interior/bar-layout.js: the top is 3.5 ft high (BAR.h).
// This is the middle of its length, 9" in from the guest edge.
const CAN_ON_BAR: [number, number, number] = [41, 3.5, 71.6]

// The can's base on the brewery floor (y 0), about 2 ft south of the two 10BBL
// tanks at the east end of the second fermenter row. equipment/layout.js: those
// tanks span x 48.8 to 56.9 and their south faces are at z 33.2 (ROW2_Z10 + R10).
// The spot is on the Brewery view's line of sight.
const CAN_BY_FERMENTERS: [number, number, number] = [51, 0, 35.2]

export const TOUR_STOPS: TourStop[] = [
  {
    id: 'can',
    label: 'The can',
    // Task C3 swaps in the featured beer's page.
    href: '/beer',
    // Not an HQ view: the guest side of the bar, about 2 ft from the can and at
    // its mid-height (a 16 oz can is about 0.5 ft tall).
    camera: { p: [40.2, 3.9, 73.6], t: [41, 3.76, 71.6] },
    ceil: true,
    up: true,
    can: CAN_ON_BAR,
  },
  {
    id: 'bar',
    label: 'The bar',
    href: '/beer',
    // views.js: 'Bar'
    camera: { p: [29.5, 5.4, 83.2], t: [57, 6.2, 71.5] },
    ceil: true,
    up: true,
    can: CAN_ON_BAR,
  },
  {
    id: 'seating',
    label: 'Seating',
    href: '/events',
    // views.js: 'Seating'
    camera: { p: [89, 5.4, 92], t: [61, 5, 72] },
    ceil: true,
    up: true,
    can: null,
  },
  {
    id: 'brewery',
    label: 'The brewery',
    href: '/beer',
    // views.js: 'Brewery'
    camera: { p: [62, 7, 44], t: [24, 5, 16] },
    ceil: true,
    up: true,
    can: CAN_BY_FERMENTERS,
  },
  {
    id: 'visit',
    label: 'Visit',
    // Taproom pages are `/<slug>` with slugs set in the CMS, so there is no
    // fixed taproom URL; /about is the fixed page that covers both taprooms.
    href: '/about',
    // views.js: 'Overview'
    camera: { p: [118, 96, 150], t: [52, 0, 56] },
    ceil: false,
    up: false,
    can: null,
  },
]
