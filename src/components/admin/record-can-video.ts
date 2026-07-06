/**
 * Admin-side can renderer: builds the shared 3D scene (components/beer/
 * can-scene) once and bakes both visitor-facing artifacts — a high-res
 * transparent PNG still (beer.image) and a loop-perfect left↔right sweep
 * WebM (beer.labelVideo). Menu displays play the video as a muted looping
 * <video>; per-item WebGL would exceed browser context limits and burn TV
 * GPUs, so everything is rendered here, once, at texture-generation time.
 */
import { createCanScene } from '@/components/beer/can-scene'
import { LABEL_VIDEO_MIME } from '@/lib/utils/media-utils'
import { canvasToPngBlob } from './pdf-label-textures'

/** Still size — square, transparent background. */
const STILL_SIZE = 1080
/** Video size — tall portrait crop around the can, plenty for menu cards. */
const WIDTH = 640
const HEIGHT = 800
/** One full left→right→left sweep; sinusoidal, so the loop point is seamless. */
const DURATION_MS = 12000
/** Fraction of the label's wrap angle to swing each way. 0.35 shows the
 *  label edge-to-edge without exposing the bare back of the can. */
const SWEEP_RATIO = 0.35
// 2 Mbps is plenty for a 640×800 slow pan and keeps a 12s loop under ~3MB
const BITS_PER_SECOND = 2_000_000

export async function generateCanRenders(
  baseCanvas: HTMLCanvasElement,
  metalnessCanvas: HTMLCanvasElement,
): Promise<{ still: Blob; sweep: Blob }> {
  const mimeType =
    typeof MediaRecorder === 'undefined'
      ? undefined
      : [`${LABEL_VIDEO_MIME};codecs=vp9`, LABEL_VIDEO_MIME].find((m) =>
          MediaRecorder.isTypeSupported(m),
        )
  if (!mimeType) {
    throw new Error('This browser cannot record WebM video — use Chrome for label generation')
  }

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
    const still = await canvasToPngBlob(can.renderer.domElement)

    // Then the sweep at video resolution (captureStream must start after
    // the resize so the recorded track has the final dimensions)
    can.setSize(WIDTH, HEIGHT)
    const amplitude = can.wrap * SWEEP_RATIO
    can.render()

    const stream = can.renderer.domElement.captureStream(60)
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: BITS_PER_SECOND })
    const chunks: Blob[] = []
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data)
    }

    const sweep = await new Promise<Blob>((resolve, reject) => {
      recorder.onstop = () => {
        // Bare container type (no ;codecs=…) so it matches the Media
        // collection's upload allowlist exactly.
        resolve(new Blob(chunks, { type: LABEL_VIDEO_MIME }))
      }
      recorder.onerror = (e) => {
        reject(new Error(`Video recording failed: ${String(e)}`))
      }
      recorder.start()

      const start = performance.now()
      const tick = () => {
        const t = performance.now() - start
        if (t >= DURATION_MS) {
          recorder.stop()
          return
        }
        // sin() starts and ends at 0 with matching velocity → seamless loop
        can.setAzimuth(amplitude * Math.sin((t / DURATION_MS) * Math.PI * 2))
        can.render()
        requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    })

    return { still, sweep }
  } finally {
    can.dispose()
  }
}
