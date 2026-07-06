/**
 * Client-side port of captiva's pdfProcessor (~/Repos/captiva/src/pdfProcessor.js):
 * rasterizes the label art + metallic-mask PDFs and thresholds the mask into a
 * black/white metalness map (white = metallic foil, black = matte paper).
 *
 * Admin-only: runs once per label in the Payload admin browser (see
 * LabelTextureGenerator). Visitors only ever download the resulting PNGs.
 */
// pdfjs-dist is loaded lazily: its module scope constructs a DOMMatrix,
// which crashes during SSR — Next still server-renders 'use client'
// components, so a top-level import would evaluate pdf.js in Node. The
// dynamic import only runs in the browser, on the Generate click. Repeat
// calls hit the ESM module cache; re-assigning workerSrc is idempotent.
async function getPdfjs() {
  const lib = await import('pdfjs-dist')
  // Bundled worker: emitted as a hashed same-origin asset, so it always
  // matches the installed pdfjs-dist version.
  lib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString()
  return lib
}

/** Rasterization DPI for label PDFs (matches captiva's print-quality setting). */
const DPI = 300
// ponytail: captiva budgets 16MP for print proofing; 4MP is plenty for a can
// rendered under ~1000px tall and keeps the stored PNGs web-sized. Raise if
// labels look soft up close.
const MAX_AREA = 4_000_000

async function renderPdf(buffer: ArrayBuffer): Promise<HTMLCanvasElement> {
  const pdfjs = await getPdfjs()
  // (captiva passed isEvalSupported: false here; pdfjs-dist 6.x removed the
  // eval font path entirely, so the option no longer exists)
  const task = pdfjs.getDocument({ data: buffer })
  const pdf = await task.promise
  const page = await pdf.getPage(1)
  let viewport = page.getViewport({ scale: DPI / 72 })
  const clamp = Math.sqrt(MAX_AREA / (viewport.width * viewport.height))
  if (clamp < 1) viewport = page.getViewport({ scale: (DPI / 72) * clamp })
  const canvas = document.createElement('canvas')
  canvas.width = viewport.width
  canvas.height = viewport.height
  await page.render({ canvas, viewport }).promise
  page.cleanup()
  await task.destroy()
  return canvas
}

/** Encode a canvas as a PNG blob (shared by the texture uploads and the
 *  still capture — toBlob snapshots the pixels at call time). */
export function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Canvas PNG encoding failed'))),
      'image/png',
    ),
  )
}

/** Encode a canvas as a lossy WebP blob (keeps alpha). Used for the sprite
 *  sheet, whose PNG encoding blows past Vercel's ~4.5MB request-body limit
 *  (413) — WebP at q=0.9 is roughly an order of magnitude smaller. */
export function canvasToWebpBlob(canvas: HTMLCanvasElement, quality = 0.9): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Canvas WebP encoding failed'))),
      'image/webp',
      quality,
    ),
  )
}

/**
 * Render the art PDF (and optional mask PDF) to canvases.
 *
 * @returns baseCanvas — the label artwork; metalnessCanvas — black/white map
 *   the 3D renderer uses for metalness/roughness/bump. All black when no mask
 *   is supplied (fully matte label).
 * @throws when the mask page size doesn't match the art page size.
 */
export async function processLabelPdfs(
  artBuffer: ArrayBuffer,
  maskBuffer: ArrayBuffer | null,
): Promise<{ baseCanvas: HTMLCanvasElement; metalnessCanvas: HTMLCanvasElement }> {
  const baseCanvas = await renderPdf(artBuffer)
  const { width, height } = baseCanvas

  const metalnessCanvas = document.createElement('canvas')
  metalnessCanvas.width = width
  metalnessCanvas.height = height
  const ctx = metalnessCanvas.getContext('2d')!
  ctx.fillStyle = 'black' // no mask → fully matte
  ctx.fillRect(0, 0, width, height)

  if (maskBuffer) {
    const mask = await renderPdf(maskBuffer)
    // 1px tolerance: the same logical page size can rasterize a pixel apart
    // due to float rounding in the viewport calculation.
    if (Math.abs(mask.width - width) > 1 || Math.abs(mask.height - height) > 1) {
      throw new Error(
        `Mask dimensions (${mask.width}x${mask.height}) don't match art dimensions (${width}x${height})`,
      )
    }
    // White-ish, unsaturated mask pixels = metallic foil; everything else matte.
    // Reading at the art's dimensions pads any 1px mismatch with transparent
    // black, which thresholds to matte.
    const src = mask.getContext('2d')!.getImageData(0, 0, width, height).data
    const out = ctx.createImageData(width, height)
    const dst = out.data
    for (let i = 0; i < dst.length; i += 4) {
      const r = src[i]
      const g = src[i + 1]
      const b = src[i + 2]
      const max = Math.max(r, g, b)
      const sat = max > 0 ? (max - Math.min(r, g, b)) / max : 0
      const v = max > 180 && sat < 0.15 ? 255 : 0
      dst[i] = dst[i + 1] = dst[i + 2] = v
      dst[i + 3] = 255
    }
    ctx.putImageData(out, 0, 0)
  }

  return { baseCanvas, metalnessCanvas }
}
