/**
 * Admin-side can renderer: builds the shared 3D scene (components/beer/
 * can-scene) once and bakes both visitor-facing artifacts — a high-res
 * transparent still (beer.image) and a transparent sprite sheet of the can
 * swung through one seamless left↔right↔left sweep (beer.labelVideo). Both
 * encode as WebP so uploads stay under Vercel's ~4.5MB request-body limit
 * (see canvasToWebpBlob).
 *
 * Menu displays animate the sprite sheet with a CSS steps() sweep rather than
 * a <video>: they run on Samsung Frame TVs whose browser decodes only one
 * <video> at a time and can't composite WebM alpha, so a grid of video cans
 * showed one can plus black rectangles. See CAN_SPRITE in media-utils. Per-item
 * WebGL is out too (context limits + TV GPU cost), so everything is rendered
 * here, once, at texture-generation time.
 */
import { createCanScene } from '@/components/beer/can-scene'
import { CAN_SPRITE } from '@/lib/utils/media-utils'
import { canvasToWebpBlob } from './pdf-label-textures'

/** Still size — square, transparent background. */
const STILL_SIZE = 1080
/** Fraction of the label's wrap angle to swing each way. 0.35 shows the
 *  label edge-to-edge without exposing the bare back of the can. */
const SWEEP_RATIO = 0.35

export async function generateCanRenders(
  baseCanvas: HTMLCanvasElement,
  metalnessCanvas: HTMLCanvasElement,
): Promise<{ still: Blob; sprite: Blob }> {
  const can = await createCanScene({
    width: STILL_SIZE,
    height: STILL_SIZE,
    base: baseCanvas,
    metalness: metalnessCanvas,
  })

  try {
    // Still first: front view at high res, transparent background. The blob
    // encode must run in the same task as render() — the WebGL buffer isn't
    // preserved across tasks (preserveDrawingBuffer is off).
    can.setAzimuth(0)
    can.render()
    const still = await canvasToWebpBlob(can.renderer.domElement)

    // Sprite sheet: CAN_SPRITE.frames views of the can, tiled row-major into a
    // cols×rows grid. Frame i sits at azimuth amp*sin(2π·i/frames) — sin starts
    // and ends at 0 with matching velocity, so frame `frames` == frame 0 and
    // the CSS loop is seamless. Each frame is drawn onto the 2D sheet in the
    // same synchronous task as its render() (the WebGL buffer isn't preserved
    // across tasks), so no captureStream/MediaRecorder is involved.
    const { frames, cols, rows, frameWidth, frameHeight } = CAN_SPRITE
    can.setSize(frameWidth, frameHeight)
    const amplitude = can.wrap * SWEEP_RATIO

    const sheet = document.createElement('canvas')
    sheet.width = cols * frameWidth
    sheet.height = rows * frameHeight
    const sctx = sheet.getContext('2d')!
    for (let i = 0; i < frames; i++) {
      can.setAzimuth(amplitude * Math.sin((i / frames) * Math.PI * 2))
      can.render()
      const col = i % cols
      const row = Math.floor(i / cols)
      sctx.drawImage(can.renderer.domElement, col * frameWidth, row * frameHeight)
    }
    const sprite = await canvasToWebpBlob(sheet)

    return { still, sprite }
  } finally {
    can.dispose()
  }
}
