'use client'

/**
 * Admin field for generating 3D can-label textures, the beer image still,
 * and the menu sweep video. Runs captiva's PDF→texture pipeline (see
 * ./pdf-label-textures) in the admin browser, uploads the results to the
 * media collection, and wires them into the beer's labelBase /
 * labelMetalness / labelVideo / image fields (image stays editable so a
 * hand-shot photo can override the render).
 * Built from Payload UI primitives (Dropzone/FieldLabel/Button/Banner) so
 * it matches the rest of the admin. Source PDFs are not stored — the
 * generated files are the canonical output.
 */
import { useRef, useState } from 'react'
import { Banner, Button, Dropzone, FieldLabel, useField } from '@payloadcms/ui'
import { processLabelPdfs } from './pdf-label-textures'

/** Create a media doc from a blob; returns the new doc id. */
async function uploadMedia(blob: Blob, filename: string, alt: string): Promise<string> {
  const form = new FormData()
  form.append('file', new File([blob], filename, { type: blob.type }))
  form.append('_payload', JSON.stringify({ alt }))
  const res = await fetch('/api/media', { method: 'POST', body: form, credentials: 'include' })
  if (!res.ok) throw new Error(`Media upload failed (${res.status})`)
  return (await res.json()).doc.id
}

/** Encode a canvas as PNG and create a media doc; returns the new doc id. */
async function uploadPng(canvas: HTMLCanvasElement, alt: string): Promise<string> {
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Canvas PNG encoding failed'))),
      'image/png',
    ),
  )
  return uploadMedia(blob, `${alt}.png`, alt)
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
  return (
    <div style={{ flex: 1, minWidth: '240px' }}>
      <FieldLabel label={label} />
      <Dropzone onChange={(files) => onSelect(files[0] ?? null)}>
        <Button buttonStyle="secondary" size="small" onClick={() => inputRef.current?.click()}>
          {file ? file.name : 'Select a PDF or drag it here'}
        </Button>
        <input
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
  const { value: slug } = useField<string>({ path: 'slug' })
  const { setValue: setBase } = useField<string>({ path: 'labelBase' })
  const { setValue: setMetalness } = useField<string>({ path: 'labelMetalness' })
  const { setValue: setVideo } = useField<string>({ path: 'labelVideo' })
  const { setValue: setImage } = useField<string>({ path: 'image' })
  const [artFile, setArtFile] = useState<File | null>(null)
  const [maskFile, setMaskFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<{ type: 'error' | 'success'; msg: string } | null>(null)

  const generate = async () => {
    if (!artFile) {
      setStatus({ type: 'error', msg: 'Choose the label art PDF first' })
      return
    }
    setBusy(true)
    setStatus(null)
    try {
      const name = slug || 'beer'
      const { baseCanvas, metalnessCanvas } = await processLabelPdfs(
        await artFile.arrayBuffer(),
        maskFile ? await maskFile.arrayBuffer() : null,
      )
      const [baseId, metalnessId] = await Promise.all([
        uploadPng(baseCanvas, `${name}-label-base`),
        uploadPng(metalnessCanvas, `${name}-label-metalness`),
      ])
      setBase(baseId)
      setMetalness(metalnessId)
      // Bake the beer image + menu sweep video (records in real time, ~12s)
      const { generateCanRenders } = await import('./record-can-video')
      const { still, sweep } = await generateCanRenders(baseCanvas, metalnessCanvas)
      const [imageId, sweepId] = await Promise.all([
        uploadMedia(still, `${name}-can.png`, `${name} can`),
        uploadMedia(sweep, `${name}-label-sweep.webm`, `${name} label sweep`),
      ])
      setImage(imageId)
      setVideo(sweepId)
      setStatus({
        type: 'success',
        msg: 'Textures, can image + sweep video generated — save the beer to keep them',
      })
    } catch (err) {
      setStatus({ type: 'error', msg: err instanceof Error ? err.message : String(err) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="field-type">
      <FieldLabel label="3D label textures" />
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <PdfDropzone label="Label art PDF" file={artFile} onSelect={setArtFile} />
        <PdfDropzone label="Metallic mask PDF (optional)" file={maskFile} onSelect={setMaskFile} />
        <Button onClick={generate} disabled={busy}>
          {busy ? 'Processing…' : 'Generate'}
        </Button>
      </div>
      {status && <Banner type={status.type}>{status.msg}</Banner>}
    </div>
  )
}
