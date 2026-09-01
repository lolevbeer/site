/**
 * Contract tests for deterministic light TV accent colours.
 */
import { describe, expect, it } from 'vitest'
import { seededLightColors } from '@/lib/utils/seeded-colors'

describe('seededLightColors', () => {
  it('returns a stable light colour for every requested item', () => {
    const colors = seededLightColors(3, 4)

    expect(colors).toHaveLength(3)
    expect(colors).toEqual(seededLightColors(3, 4))
    expect(colors.every((color) => /^hsl\(\d+ 70% 75%\)$/.test(color))).toBe(true)
  })

  it('changes the palette when the seed changes', () => {
    expect(seededLightColors(2, 4)).not.toEqual(seededLightColors(2, 5))
  })
})
