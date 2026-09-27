'use client'

/**
 * Admin field for generating 3D can-label textures, the beer image still,
 * and the menu can-rotation sprite sheet. Runs captiva's PDF→texture pipeline (see
 * ./pdf-label-textures) in the admin browser, uploads the results to the
 * media collection, and wires them into the beer's labelBase /
 * labelMetalness / labelVideo / image fields (image stays editable so a
 * hand-shot photo can override the render).
 * Built from Payload UI primitives (Dropzone/FieldLabel/FieldDescription/Button/Banner) so
 * it matches the rest of the admin. Source PDFs are not stored — the
 * generated files are the canonical output.
 *
 * The field lives in the beer editor's "Label & images" tab, and Payload
 * renders only the active tab, so switching tabs unmounts it mid-run. A run
 * therefore renders everything first and stops mid-render if the field has
 * unmounted (a render that already finished still uploads), and applies the
 * four files to the form together, so a failed or abandoned run never leaves
 * a half-updated set. The remounted field starts out idle, so an editor who
 * comes back can start a second run while the first is still uploading; only
 * the latest run applies its files.
 */
import { useEffect, useId, useRef, useState } from 'react'
import {
  Banner,
  Button,
  Dropzone,
  FieldDescription,
  FieldLabel,
  useDocumentInfo,
  useField,
} from '@payloadcms/ui'
import { canvasToWebpBlob, processLabelPdfs } from './pdf-label-textures'

// Latest run number per beer (unsaved beers share one key): a remounted field
// can start a run while an earlier one is still uploading, and only the latest applies.
const latestRun = new Map<number | string, number>()

/** Create a media doc from a blob; returns the new doc id. */
async function uploadMedia(blob: Blob, filename: string, alt: string): Promise<string> {
  const form = new FormData()
  form.append('file', new File([blob], filename, { type: blob.type }))
  form.append('_payload', JSON.stringify({ alt }))
  const res = await fetch('/api/media', { method: 'POST', body: form, credentials: 'include' })
  if (!res.ok) throw new Error(`Media upload failed (${res.status})`)
  return (await res.json()).doc.id
}

/** Encode a canvas as WebP (to stay under Vercel's request-body limit) and
 *  create a media doc; returns the new doc id. */
async function uploadWebp(canvas: HTMLCanvasElement, alt: string): Promise<string> {
  return uploadMedia(await canvasToWebpBlob(canvas), `${alt}.webp`, alt)
}

/** Payload-styled PDF picker: drag-and-drop zone with a browse button
 *  (same composition Payload's own upload field uses). */
function PdfDropzone({
  label,
  file,
  onSelect,
}: {
  label: string
  file: File | null
  onSelect: (file: File | null) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const inputId = useId()
  return (
    // .field-type: Payload's own label-to-control rhythm (column, --spacer-2 gap).
    // flex: 1 keeps both pickers equal width (.field-type only sets flex-grow).
    <div className="field-type" style={{ flex: 1, minWidth: '240px' }}>
      <FieldLabel as="label" htmlFor={inputId} label={label} />
      <Dropzone onChange={(files) => onSelect(files[0] ?? null)}>
        {/* Payload 4's default dropzone pads only block-wise; its own upload
            field insets content by --spacer-3, so match that (Dropzone takes no style). */}
        <div style={{ paddingInline: 'var(--spacer-3)' }}>
          <Button buttonStyle="secondary" onClick={() => inputRef.current?.click()}>
            {file ? file.name : 'Select a PDF or drag it here'}
          </Button>
        </div>
        <input
          id={inputId}
          ref={inputRef}
          type="file"
          accept="application/pdf"
          hidden
          onChange={(e) => onSelect(e.target.files?.[0] ?? null)}
        />
      </Dropzone>
    </div>
  )
}

export function LabelTextureGenerator() {
  const { id } = useDocumentInfo()
  const { value: slug } = useField<string>({ path: 'slug' })
  const { setValue: setBase } = useField<string>({ path: 'labelBase' })
  const { setValue: setMetalness } = useField<string>({ path: 'labelMetalness' })
  // The `labelVideo` field now holds the can-rotation sprite sheet PNG (the
  // field keeps its legacy name to avoid a schema migration).
  const { setValue: setSprite } = useField<string>({ path: 'labelVideo' })
  const { setValue: setImage } = useField<string>({ path: 'image' })
  const [artFile, setArtFile] = useState<File | null>(null)
  const [maskFile, setMaskFile] = useState<File | null>(null)
  // Non-null while generating: drives the progress bar + stage label.
  const [progress, setProgress] = useState<{ pct: number; label: string } | null>(null)
  const [status, setStatus] = useState<{ type: 'danger' | 'success'; msg: string } | null>(null)
  const busy = progress !== null
  // False once the editor leaves the tab (see the module comment).
  const mountedRef = useRef(false)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const generate = async () => {
    // The button stays disabled until the art PDF is chosen; this narrows the type.
    if (!artFile) return
    /** Abandon a run whose tab was left while it is still rendering. */
    const stopIfTabLeft = () => {
      if (!mountedRef.current) throw new Error('Label generation stopped: its tab was left.')
    }
    const runKey = id ?? 'unsaved'
    const run = (latestRun.get(runKey) ?? 0) + 1
    latestRun.set(runKey, run)
    setStatus(null)
    // Stage weights are rough wall-clock shares; the sprite loop (72 frames)
    // dominates and reports real per-frame progress.
    setProgress({ pct: 0, label: 'Rendering label PDFs…' })
    try {
      const name = slug || 'beer'
      const { baseCanvas, metalnessCanvas } = await processLabelPdfs(
        await artFile.arrayBuffer(),
        maskFile ? await maskFile.arrayBuffer() : null,
      )
      stopIfTabLeft()
      // Bake the beer image still + the can-rotation sprite sheet (both WebP,
      // to stay under Vercel's request-body limit)
      setProgress({ pct: 25, label: 'Rendering can…' })
      const { generateCanRenders } = await import('./record-can-video')
      const { still, sprite } = await generateCanRenders(
        baseCanvas,
        metalnessCanvas,
        (done, total) => {
          stopIfTabLeft()
          setProgress({
            pct: 25 + (done / total) * 60,
            label: `Rendering sprite frames (${done}/${total})…`,
          })
        },
      )
      setProgress({ pct: 85, label: 'Uploading label files…' })
      // The sprite sheet goes first, alone: it is the largest file and the one
      // likeliest to hit Vercel's 413, and if it fails nothing else has been
      // uploaded to orphan (media docs and their Blob files are never cleaned up).
      const spriteId = await uploadMedia(sprite, `${name}-can-sprite.webp`, `${name} can rotation`)
      const [baseId, metalnessId, imageId] = await Promise.all([
        uploadWebp(baseCanvas, `${name}-label-base`),
        uploadWebp(metalnessCanvas, `${name}-label-metalness`),
        uploadMedia(still, `${name}-can.webp`, `${name} can`),
      ])
      // All four together, even if the tab was left once the render finished
      // (the form outlives the tab), unless a newer run for this beer started
      // since: its files win, and this run's uploads are left orphaned.
      if (latestRun.get(runKey) !== run) return
      setBase(baseId)
      setMetalness(metalnessId)
      setImage(imageId)
      setSprite(spriteId)
      setStatus({
        type: 'success',
        msg: 'Textures, can image + rotation sprite generated — save the beer to keep them',
      })
    } catch (err) {
      setStatus({ type: 'danger', msg: err instanceof Error ? err.message : String(err) })
    } finally {
      setProgress(null)
    }
  }

  return (
    <div className="field-type">
      <FieldLabel as="h3" label="3D label textures" />
      <div style={{ display: 'flex', gap: 'var(--spacer-3)', flexWrap: 'wrap' }}>
        <PdfDropzone label="Label art PDF" file={artFile} onSelect={setArtFile} />
        <PdfDropzone label="Metallic mask PDF (optional)" file={maskFile} onSelect={setMaskFile} />
      </div>
      {/* The action gets its own row under the inputs it consumes, and stays
          disabled until the required art PDF is chosen. */}
      <div style={{ display: 'flex', gap: 'var(--spacer-3)', alignItems: 'center' }}>
        <Button onClick={generate} disabled={busy || !artFile} margin={false}>
          {busy ? 'Generating…' : 'Generate label files'}
        </Button>
        <FieldDescription
          path="labelTextures"
          description="Creates the label texture, metallic map, beer image, and menu sprite sheet. Stay on this tab until it finishes."
        />
      </div>
      {progress && (
        <div style={{ marginTop: '8px' }}>
          <progress value={progress.pct} max={100} style={{ width: '100%', display: 'block' }} />
          <small>{progress.label}</small>
        </div>
      )}
      {status && <Banner type={status.type}>{status.msg}</Banner>}
    </div>
  )
}
