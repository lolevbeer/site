/**
 * Guards the homepage scroll tour's maths: which stop a scroll position belongs
 * to, where the camera is between two stops, and when the can is shown.
 */
import { describe, it, expect } from 'vitest'
import { TOUR_STOPS } from '@/lib/tour/stops'
import { progressFromTops, poseAt, progressForStop, stopAt } from '@/lib/tour/pose'

const stop = (id: string) => TOUR_STOPS.find((s) => s.id === id)!
/** Progress halfway between two stops. */
const between = (a: string, b: string) =>
  (progressForStop(stop(a).id) + progressForStop(stop(b).id)) / 2

describe('TOUR_STOPS', () => {
  it('lists the five stops in walking order', () => {
    expect(TOUR_STOPS.map((s) => s.id)).toEqual(['can', 'bar', 'seating', 'brewery', 'visit'])
  })
})

describe('poseAt', () => {
  it('is the first stop at progress 0 and the last at 1', () => {
    const first = TOUR_STOPS[0]
    const last = TOUR_STOPS[TOUR_STOPS.length - 1]
    expect(poseAt(0)).toEqual({
      p: first.camera.p,
      t: first.camera.t,
      stop: first.id,
      ceil: first.ceil,
      up: first.up,
      can: first.can,
    })
    expect(poseAt(1)).toMatchObject({ p: last.camera.p, t: last.camera.t, stop: last.id })
  })

  it('puts the camera halfway between two stops at their midpoint', () => {
    const a = stop('bar')
    const b = stop('seating')
    const pose = poseAt(between('bar', 'seating'))
    for (const i of [0, 1, 2]) {
      expect(pose.p[i]).toBeCloseTo((a.camera.p[i] + b.camera.p[i]) / 2)
      expect(pose.t[i]).toBeCloseTo((a.camera.t[i] + b.camera.t[i]) / 2)
    }
  })

  it('eases out of a stop: a quarter of the way is less than a quarter of the distance', () => {
    const a = stop('bar')
    const b = stop('seating')
    const quarter =
      progressForStop('bar') + (progressForStop('seating') - progressForStop('bar')) / 4
    const moved = (poseAt(quarter).p[0] - a.camera.p[0]) / (b.camera.p[0] - a.camera.p[0])
    expect(moved).toBeGreaterThan(0)
    expect(moved).toBeLessThan(0.25)
  })

  it('takes stop, ceiling and upper floor from the nearer stop', () => {
    const from = progressForStop('brewery')
    const to = progressForStop('visit')
    const early = poseAt(from + (to - from) * 0.4)
    const late = poseAt(from + (to - from) * 0.6)
    expect(early).toMatchObject({ stop: 'brewery', ceil: true, up: true })
    expect(late).toMatchObject({ stop: 'visit', ceil: false, up: false })
  })

  it('shows the can at a stop that has one, and hides it at one that does not', () => {
    for (const s of TOUR_STOPS) {
      expect(poseAt(progressForStop(s.id)).can).toEqual(s.can)
    }
    expect(stop('seating').can).toBeNull()
    expect(stop('visit').can).toBeNull()
    expect(stop('brewery').can).not.toBeNull()
  })

  it('hides the can while it would have to move between stops', () => {
    expect(poseAt(between('bar', 'seating')).can).toBeNull()
    expect(poseAt(between('seating', 'brewery')).can).toBeNull()
    expect(poseAt(between('brewery', 'visit')).can).toBeNull()
    // Just off a stop counts as moving too.
    expect(poseAt(progressForStop('brewery') - 0.01).can).toBeNull()
  })

  it('keeps the can on the bar between the can and bar stops', () => {
    expect(stop('can').can).toEqual(stop('bar').can)
    expect(poseAt(between('can', 'bar')).can).toEqual(stop('bar').can)
  })

  it('treats progress a hair away from a stop as at that stop', () => {
    const brewery = stop('brewery')
    const pose = poseAt(progressForStop('brewery') + 1e-6)
    expect(pose.can).toEqual(brewery.can)
    expect(pose.p).toEqual(brewery.camera.p)
  })

  it('clamps progress outside 0..1', () => {
    expect(poseAt(-3)).toEqual(poseAt(0))
    expect(poseAt(7)).toEqual(poseAt(1))
    expect(poseAt(Number.NaN)).toEqual(poseAt(0))
  })
})

describe('stopAt and progressForStop', () => {
  it('round-trip for every stop', () => {
    for (const s of TOUR_STOPS) {
      expect(stopAt(progressForStop(s.id))).toBe(s.id)
    }
  })

  it('spaces the stops evenly from 0 to 1', () => {
    expect(TOUR_STOPS.map((s) => progressForStop(s.id))).toEqual([0, 0.25, 0.5, 0.75, 1])
  })

  it('picks the nearest stop, and clamps', () => {
    expect(stopAt(0.3)).toBe('bar')
    expect(stopAt(0.45)).toBe('seating')
    expect(stopAt(-1)).toBe('can')
    expect(stopAt(2)).toBe('visit')
  })
})

describe('progressFromTops', () => {
  it('is 0 before the tour, at each stop when its top meets the window top, and 1 after', () => {
    expect(progressFromTops([100, 800, 1500, 2200, 2900])).toBe(0)
    expect(progressFromTops([0, 700, 1400, 2100, 2800])).toBe(0)
    expect(progressFromTops([-700, 0, 700, 1400, 2100])).toBe(0.25)
    expect(progressFromTops([-2800, -2100, -1400, -700, 0])).toBe(1)
    expect(progressFromTops([-3800, -3100, -2400, -1700, -1000])).toBe(1)
  })

  it('follows stops of different heights', () => {
    // The first stop is 1000 tall and half scrolled past; the rest are 700.
    expect(progressFromTops([-500, 500, 1200, 1900, 2600])).toBe(0.125)
  })
})
