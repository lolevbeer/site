/**
 * Deterministic light accent colours for dark TV displays.
 */
const GOLDEN_ANGLE = 137.508

export function seededLightColors(count: number, seed: number): string[] {
  return Array.from({ length: count }, (_, index) => {
    const hue = Math.round((seed * GOLDEN_ANGLE + index * GOLDEN_ANGLE) % 360)
    return `hsl(${hue} 70% 75%)`
  })
}
