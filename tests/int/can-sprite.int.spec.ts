/**
 * Guards the can-rotation sprite-sheet geometry (CAN_SPRITE / canSpriteAnimation
 * in media-utils). These invariants are what make the CSS steps() sweep line up
 * with the tiled PNG; getting them wrong shows blank/desynced frames on the menu
 * TVs, which is exactly what the sprite sheet replaced.
 */
import { describe, it, expect } from 'vitest'
import { CAN_SPRITE, canSpriteAnimation } from '@/lib/utils/media-utils'

describe('CAN_SPRITE geometry', () => {
  it('fills every grid cell (cols*rows === frames)', () => {
    // A short grid leaves trailing cells transparent → cans flash empty frames.
    expect(CAN_SPRITE.cols * CAN_SPRITE.rows).toBe(CAN_SPRITE.frames)
  })

  it('loops without drift (loopMs divisible by rows)', () => {
    // The column sweep restarts every loopMs/rows; a non-integer would slowly
    // desync the row step from the column wrap.
    expect(CAN_SPRITE.loopMs % CAN_SPRITE.rows).toBe(0)
  })
})

describe('canSpriteAnimation', () => {
  const style = canSpriteAnimation('/x.png') as Record<string, string>

  it('embeds the sheet url', () => {
    expect(style.backgroundImage).toBe('url(/x.png)')
  })

  it('sizes the background to cols×rows copies of the element', () => {
    expect(style.backgroundSize).toBe(`${CAN_SPRITE.cols * 100}% ${CAN_SPRITE.rows * 100}%`)
  })

  it('overshoots the end positions so each step lands on a frame boundary', () => {
    // 100*n/(n-1): with steps(n) over [0, end], step k lands at 100k/(n-1)% —
    // exactly frame k (0 → first frame, end → last frame, then it loops).
    expect(style['--can-sprite-x-end']).toBe(`${(100 * CAN_SPRITE.cols) / (CAN_SPRITE.cols - 1)}%`)
    expect(style['--can-sprite-y-end']).toBe(`${(100 * CAN_SPRITE.rows) / (CAN_SPRITE.rows - 1)}%`)
  })
})
