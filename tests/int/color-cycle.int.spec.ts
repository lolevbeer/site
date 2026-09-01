/**
 * Dark-mode live display color cycle is wall-clock, not pollCount.
 */
import { describe, expect, it } from 'vitest'
import { COLOR_CYCLE_MS, colorCycleSeed } from '@/lib/hooks/color-cycle'

describe('colorCycleSeed', () => {
  it('stays on seed 0 for the first 30 seconds', () => {
    expect(colorCycleSeed(0)).toBe(0)
    expect(colorCycleSeed(COLOR_CYCLE_MS - 1)).toBe(0)
  })

  it('advances about every 30 seconds of elapsed time', () => {
    expect(colorCycleSeed(COLOR_CYCLE_MS)).toBe(1)
    expect(colorCycleSeed(COLOR_CYCLE_MS * 2)).toBe(2)
  })

  it('does not depend on poll count', () => {
    expect(colorCycleSeed(90_000)).toBe(3)
  })
})
