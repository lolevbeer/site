/**
 * Turns the scroll tour's progress (0 at the first stop, 1 at the last) into a
 * camera pose. Stops are evenly spaced; the camera eases from one to the next.
 * Pure maths over `TOUR_STOPS`: no three.js, no DOM.
 */
import { TOUR_STOPS, type TourStop, type TourStopId } from './stops'

export interface TourPose {
  p: [number, number, number]
  t: [number, number, number]
  stop: TourStopId
  ceil: boolean
  up: boolean
  can: [number, number, number] | null
}

type Point = [number, number, number]

const LAST = TOUR_STOPS.length - 1
/** How close to a stop counts as at it, as a share of the way to the next stop. */
const AT_STOP = 1e-3

/** Progress as a position along the stops: 0 at the first, LAST at the last. */
function along(progress: number): number {
  // The comparison is false for NaN, so NaN becomes 0.
  return progress > 0 ? Math.min(progress, 1) * LAST : 0
}

const mix = (a: Point, b: Point, k: number): Point => [
  a[0] * (1 - k) + b[0] * k,
  a[1] * (1 - k) + b[1] * k,
  a[2] * (1 - k) + b[2] * k,
]

/** The can between stops `a` and `b`: shown only where it does not have to move. */
function canBetween(a: TourStop, b: TourStop, share: number): Point | null {
  if (share === 0) return a.can
  if (share === 1) return b.can
  const same = a.can && b.can && a.can.every((v, i) => v === b.can![i])
  return same ? a.can : null
}

/** The camera, the nearer stop's switches, and the can at `progress` (clamped to 0..1). */
export function poseAt(progress: number): TourPose {
  const x = along(progress)
  const from = Math.min(Math.floor(x), LAST - 1)
  const a = TOUR_STOPS[from]
  const b = TOUR_STOPS[from + 1]

  // Share of the way from a to b, snapped to the stop when within AT_STOP of it.
  let share = x - from
  if (share < AT_STOP) share = 0
  else if (share > 1 - AT_STOP) share = 1

  const eased = share * share * (3 - 2 * share) // smoothstep
  const near = share < 0.5 ? a : b
  return {
    p: mix(a.camera.p, b.camera.p, eased),
    t: mix(a.camera.t, b.camera.t, eased),
    stop: near.id,
    ceil: near.ceil,
    up: near.up,
    can: canBetween(a, b, share),
  }
}

/** The stop nearest to `progress` (clamped to 0..1). */
export function stopAt(progress: number): TourStopId {
  return TOUR_STOPS[Math.round(along(progress))].id
}

/** The progress at which the tour is at stop `id`. */
export function progressForStop(id: TourStopId): number {
  return TOUR_STOPS.findIndex((stop) => stop.id === id) / LAST
}

/**
 * The tour's progress from where its stops are on screen. `tops` is each
 * stop's top edge in order, measured from the top of the window (negative once
 * scrolled past). A stop is reached when its top meets the top of the window,
 * so stops of different heights still land on their own cameras.
 */
export function progressFromTops(tops: number[]): number {
  // The last stop whose top has reached the window's top (the first, before any has).
  let from = 0
  while (from < LAST && tops[from + 1] <= 0) from++
  if (from >= LAST) return 1
  const share = -tops[from] / (tops[from + 1] - tops[from])
  return (from + Math.min(Math.max(share, 0), 1)) / LAST
}
