/**
 * Admin-side sweep-video recorder: renders the 3D can (shared scene from
 * components/beer/can-scene) and records one loop-perfect left↔right camera
 * sweep across the label as a WebM. Menu displays play the result as a
 * muted looping <video> — per-item WebGL would exceed browser context
 * limits and burn TV GPUs, so the rotation is baked here, once, at
 * texture-generation time.
 */
import { createCanScene } from '@/components/beer/can-scene'

/** Output size — tall portrait crop around the can, plenty for menu cards. */
const WIDTH = 640
const HEIGHT = 800
/** One full left→right→left sweep; sinusoidal, so the loop point is seamless. */
const DURATION_MS = 12000
/** Fraction of the label's wrap angle to swing each way. 0.35 shows the
 *  label edge-to-edge without exposing the bare back of the can. */
const SWEEP_RATIO = 0.35
// 2 Mbps is plenty for a 640×800 slow pan and keeps a 12s loop under ~3MB
const BITS_PER_SECOND = 2_000_000

export async function recordCanSweep(
  baseCanvas: HTMLCanvasElement,
  metalnessCanvas: HTMLCanvasElement,
): Promise<Blob> {
  const mimeType =
    typeof MediaRecorder === 'undefined'
      ? undefined
      : ['video/webm;codecs=vp9', 'video/webm'].find((m) => MediaRecorder.isTypeSupported(m))
  if (!mimeType) {
    throw new Error('This browser cannot record WebM video — use Chrome for label generation')
  }

  const can = await createCanScene({
    width: WIDTH,
    height: HEIGHT,
    base: baseCanvas,
    metalness: metalnessCanvas,
  })

  const amplitude = can.wrap * SWEEP_RATIO
  can.setAzimuth(0)
  can.render()

  const stream = can.renderer.domElement.captureStream(60)
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: BITS_PER_SECOND })
  const chunks: Blob[] = []
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data)
  }

  return new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => {
      can.dispose()
      // Bare container type (no ;codecs=…): must stay equal to the
      // 'video/webm' entry in Media.ts's mimeTypes allowlist.
      resolve(new Blob(chunks, { type: 'video/webm' }))
    }
    recorder.onerror = (e) => {
      can.dispose()
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
}
