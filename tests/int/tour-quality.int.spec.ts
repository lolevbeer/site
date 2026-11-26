/**
 * Guards how the homepage scroll tour picks its quality level (full, lite or
 * none) and how slow frames step it down one level at a time.
 */
import { describe, expect, it } from 'vitest'
import {
  FRAME_BUDGET_FRAMES,
  FRAME_BUDGET_MS,
  chooseQuality,
  createFrameBudget,
  stepDown,
  type TourQuality,
} from '@/lib/tour/quality'

const desktop = {
  webgl2: true,
  reducedMotion: false,
  saveData: false,
  phone: false,
  deviceMemory: 8,
}

/** Feed `count` frames of `ms` each; true if the budget fired on any of them. */
function feed(budget: { add(ms: number): boolean }, ms: number, count: number): boolean {
  let fired = false
  for (let i = 0; i < count; i++) fired = budget.add(ms) || fired
  return fired
}

describe('chooseQuality', () => {
  it('gives a desktop the full tour', () => {
    expect(chooseQuality(desktop)).toBe('full')
  })

  it('gives the full tour when the browser does not report memory', () => {
    expect(chooseQuality({ ...desktop, deviceMemory: undefined })).toBe('full')
  })

  it('turns the tour off under reduced motion', () => {
    expect(chooseQuality({ ...desktop, reducedMotion: true })).toBe('none')
  })

  it('turns the tour off under Save-Data', () => {
    expect(chooseQuality({ ...desktop, saveData: true })).toBe('none')
  })

  it('turns the tour off without WebGL 2', () => {
    expect(chooseQuality({ ...desktop, webgl2: false })).toBe('none')
  })

  it('gives a phone the lite tour', () => {
    expect(chooseQuality({ ...desktop, phone: true })).toBe('lite')
  })

  it('gives a low-memory device the lite tour', () => {
    expect(chooseQuality({ ...desktop, deviceMemory: 4 })).toBe('lite')
  })

  it('keeps the tour off on a phone that asks for reduced motion', () => {
    expect(chooseQuality({ ...desktop, phone: true, reducedMotion: true })).toBe('none')
  })
})

describe('stepDown', () => {
  it('goes full, lite, none and stays at none', () => {
    expect(stepDown('full')).toBe('lite')
    expect(stepDown('lite')).toBe('none')
    expect(stepDown('none')).toBe('none')
  })
})

describe('createFrameBudget', () => {
  it('uses the numbers from the plan', () => {
    expect(FRAME_BUDGET_FRAMES).toBe(60)
    expect(FRAME_BUDGET_MS).toBe(40)
  })

  it('does not fire before 60 frames, however slow they are', () => {
    expect(feed(createFrameBudget(), 500, FRAME_BUDGET_FRAMES - 1)).toBe(false)
  })

  it('fires on the 60th frame when the average is over 40 ms', () => {
    const budget = createFrameBudget()
    feed(budget, 50, FRAME_BUDGET_FRAMES - 1)
    expect(budget.add(50)).toBe(true)
  })

  it('never fires for fast frames', () => {
    expect(feed(createFrameBudget(), 16, 600)).toBe(false)
  })

  it('does not fire when the average is exactly 40 ms', () => {
    expect(feed(createFrameBudget(), FRAME_BUDGET_MS, FRAME_BUDGET_FRAMES)).toBe(false)
  })

  it('judges the average, not single frames', () => {
    const budget = createFrameBudget()
    // One long frame (shader compile) among fast ones stays under budget.
    budget.add(400)
    expect(feed(budget, 16, FRAME_BUDGET_FRAMES - 1)).toBe(false)
  })

  it('fires only once, and only judges the first 60 frames', () => {
    const slow = createFrameBudget()
    feed(slow, 50, FRAME_BUDGET_FRAMES)
    expect(feed(slow, 50, 200)).toBe(false)

    const fastThenSlow = createFrameBudget()
    feed(fastThenSlow, 16, FRAME_BUDGET_FRAMES)
    expect(feed(fastThenSlow, 500, 200)).toBe(false)
  })

  it('steps down one level at a time: full, then lite, then none', () => {
    // What the scene does: a new budget for each level it lands on.
    let quality: TourQuality = 'full'
    const levels: TourQuality[] = [quality]
    while (quality !== 'none') {
      const budget = createFrameBudget()
      if (!feed(budget, 50, FRAME_BUDGET_FRAMES)) break
      quality = stepDown(quality)
      levels.push(quality)
    }
    expect(levels).toEqual(['full', 'lite', 'none'])
  })
})
