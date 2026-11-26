/**
 * Guards the label wrap angle on the 3D can (labelWrapAngle in can-scene).
 * The label is a strip bent around the can: too wide an angle stretches the
 * artwork, and a full circle would make its two ends overlap.
 */
import { describe, expect, it } from 'vitest'
import { CAN_HEIGHT, MAX_WRAP_ANGLE, labelWrapAngle } from '@/components/beer/can-scene'

// Mirrors of the label constants in can-scene: the label covers 82% of the
// can's height and sits 0.5% off its surface.
const LABEL_HEIGHT = CAN_HEIGHT * 0.82
const CAN_RADIUS = 0.033
const LABEL_RADIUS = CAN_RADIUS * 1.005

describe('labelWrapAngle', () => {
  it('keeps the artwork proportions for a normal label', () => {
    const wrap = labelWrapAngle(2000, 1000, CAN_RADIUS)
    // Width along the curve over height must equal the artwork's 2:1.
    expect((wrap * LABEL_RADIUS) / LABEL_HEIGHT).toBeCloseTo(2, 10)
    expect(wrap).toBeLessThan(MAX_WRAP_ANGLE)
  })

  it('stops short of a full circle for a very wide label', () => {
    expect(labelWrapAngle(20000, 1000, CAN_RADIUS)).toBe(MAX_WRAP_ANGLE)
    expect(MAX_WRAP_ANGLE).toBeLessThan(Math.PI * 2)
  })
})
