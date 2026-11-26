/**
 * Picks how much of the homepage scroll tour a device gets, and steps that
 * down when frames turn out slow.
 *
 * - `full`: the whole 3D scene (desktop-class devices).
 * - `lite`: a cheaper scene for phones and low-memory devices.
 * - `none`: no 3D at all; the page is the plain homepage.
 *
 * See docs/plans/scroll-tour.md ("Decisions taken", "Performance rules").
 */

export type TourQuality = 'full' | 'lite' | 'none'

/** What we know about the device, as plain values so the choice is testable. */
export interface QualityFacts {
  /** The browser can create a WebGL 2 context. */
  webgl2: boolean
  /** The visitor asked for reduced motion. */
  reducedMotion: boolean
  /** The visitor asked the browser to save data. */
  saveData: boolean
  /** Touch device with a narrow screen. */
  phone: boolean
  /** Device memory in GB, where the browser reports it (Chrome only). */
  deviceMemory?: number
}

/** A device reporting this much memory (GB) or less gets `lite`. */
const LOW_MEMORY_GB = 4

/** A touch device whose shorter screen side is under this (CSS px) is a phone. */
const PHONE_MAX_SHORT_SIDE = 768

/** Frames to draw before judging a level's speed. */
export const FRAME_BUDGET_FRAMES = 60

/** Average frame time (ms) over those frames above which the level steps down. */
export const FRAME_BUDGET_MS = 40

/** The starting level for a device. Measured frame times may lower it later. */
export function chooseQuality(facts: QualityFacts): TourQuality {
  if (!facts.webgl2 || facts.reducedMotion || facts.saveData) return 'none'
  const lowMemory = facts.deviceMemory !== undefined && facts.deviceMemory <= LOW_MEMORY_GB
  return facts.phone || lowMemory ? 'lite' : 'full'
}

/** The next cheaper level: full, then lite, then none (which stays none). */
export function stepDown(quality: TourQuality): TourQuality {
  return quality === 'full' ? 'lite' : 'none'
}

/**
 * Judges whether a level is too slow for this device. Feed it the duration of
 * each frame the scene draws; `add` returns true once, on the 60th frame, if
 * the average was over 40 ms. The caller then calls `stepDown` and starts a
 * new budget for the new level. Later frames are ignored.
 *
 * The scene draws on demand, so these are the frames that were drawn, not
 * consecutive ones.
 */
export function createFrameBudget(): { add(ms: number): boolean } {
  let frames = 0
  let total = 0
  return {
    add(ms) {
      if (frames >= FRAME_BUDGET_FRAMES) return false
      frames += 1
      total += ms
      return frames === FRAME_BUDGET_FRAMES && total / frames > FRAME_BUDGET_MS
    },
  }
}

/** True if the browser can create a WebGL 2 context. The test context is
 *  released straight away so it does not count against the page's limit. */
function hasWebGL2(): boolean {
  try {
    const gl = document.createElement('canvas').getContext('webgl2')
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
    return gl !== null
  } catch {
    return false
  }
}

/** Reads the device facts from the browser and picks the starting level.
 *  Browser only: call it from an effect, not during server rendering. */
export function detectQuality(): TourQuality {
  // Neither field is in TypeScript's DOM types; both are missing in Safari and Firefox.
  const nav = navigator as Navigator & {
    connection?: { saveData?: boolean }
    deviceMemory?: number
  }
  return chooseQuality({
    webgl2: hasWebGL2(),
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    saveData: nav.connection?.saveData === true,
    phone:
      window.matchMedia('(pointer: coarse)').matches &&
      Math.min(window.screen.width, window.screen.height) < PHONE_MAX_SHORT_SIDE,
    deviceMemory: nav.deviceMemory,
  })
}
