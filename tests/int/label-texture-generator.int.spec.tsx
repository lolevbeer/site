/**
 * LabelTextureGenerator sits in the beer editor's "Label & images" tab, and
 * Payload renders only the active tab, so switching tabs unmounts it mid-run.
 * These tests pin the two guarantees that keep that safe: the four generated
 * files are applied to the form together or not at all, and a run whose tab
 * was left stops before uploading anything. They also pin the upload order:
 * the sprite sheet, the likeliest to fail, goes first and alone, so its
 * failure leaves no orphaned media.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const setters = vi.hoisted(() => ({
  labelBase: vi.fn(),
  labelMetalness: vi.fn(),
  labelVideo: vi.fn(),
  image: vi.fn(),
}))

vi.mock('@payloadcms/ui', () => ({
  Banner: ({ children }: { children: ReactNode }) =>
    createElement('div', { role: 'status' }, children),
  Button: ({
    children,
    onClick,
    disabled,
  }: {
    children: ReactNode
    onClick?: () => void
    disabled?: boolean
  }) => createElement('button', { onClick, disabled, type: 'button' }, children),
  Dropzone: ({ children }: { children: ReactNode }) => createElement('div', null, children),
  FieldDescription: ({ description }: { description: string }) =>
    createElement('p', null, description),
  FieldLabel: ({ label }: { label: string }) => createElement('span', null, label),
  useField: ({ path }: { path: string }) => ({
    value: path === 'slug' ? 'test-beer' : undefined,
    setValue: setters[path as keyof typeof setters] ?? vi.fn(),
  }),
}))

vi.mock('@/src/components/admin/pdf-label-textures', () => ({
  processLabelPdfs: vi.fn(async () => ({ baseCanvas: {}, metalnessCanvas: {} })),
  canvasToWebpBlob: vi.fn(async () => new Blob(['texture'], { type: 'image/webp' })),
}))

const generateCanRenders = vi.hoisted(() => vi.fn())
vi.mock('@/src/components/admin/record-can-video', () => ({ generateCanRenders }))

import { LabelTextureGenerator } from '@/src/components/admin/LabelTextureGenerator'

/** Media upload stub: every upload succeeds unless its filename matches `failOn`. */
function stubUploads(failOn?: string) {
  let next = 0
  const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
    const file = (init.body as FormData).get('file') as File
    if (failOn && file.name.includes(failOn)) return { ok: false, status: 413 }
    next += 1
    return { ok: true, json: async () => ({ doc: { id: `media-${next}` } }) }
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function startGeneration() {
  const view = render(createElement(LabelTextureGenerator))
  const [artInput] = view.container.querySelectorAll<HTMLInputElement>('input[type="file"]')
  const art = new File(['%PDF'], 'art.pdf', { type: 'application/pdf' })
  Object.defineProperty(art, 'arrayBuffer', { value: async () => new ArrayBuffer(4) })
  fireEvent.change(artInput, { target: { files: [art] } })
  fireEvent.click(screen.getByRole('button', { name: 'Generate label files' }))
  return view
}

const allSetters = () => Object.values(setters)

beforeEach(() => {
  for (const setter of allSetters()) setter.mockClear()
  generateCanRenders.mockReset()
  generateCanRenders.mockImplementation(async () => ({
    still: new Blob(['still'], { type: 'image/webp' }),
    sprite: new Blob(['sprite'], { type: 'image/webp' }),
  }))
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('LabelTextureGenerator', () => {
  it('applies all four generated files once every upload has succeeded', async () => {
    stubUploads()
    startGeneration()

    await waitFor(() => expect(setters.labelVideo).toHaveBeenCalled())
    for (const setter of allSetters()) expect(setter).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('status').textContent).toContain('save the beer to keep them')
  })

  it('applies none of them when a later upload fails', async () => {
    stubUploads('-can.webp')
    startGeneration()

    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('413'))
    for (const setter of allSetters()) expect(setter).not.toHaveBeenCalled()
  })

  it('uploads nothing else when the sprite sheet, the likeliest 413, fails', async () => {
    const fetchMock = stubUploads('-can-sprite.webp')
    startGeneration()

    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('413'))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    for (const setter of allSetters()) expect(setter).not.toHaveBeenCalled()
  })

  it('stops without uploading when the editor leaves the tab mid-render', async () => {
    const fetchMock = stubUploads()
    let finishRender!: () => void
    generateCanRenders.mockImplementation(
      async (
        _base: unknown,
        _metal: unknown,
        onProgress?: (done: number, total: number) => void,
      ) => {
        await new Promise<void>((resolve) => {
          finishRender = resolve
        })
        onProgress?.(1, 72)
        return { still: new Blob(['still']), sprite: new Blob(['sprite']) }
      },
    )
    const view = startGeneration()

    await waitFor(() => expect(generateCanRenders).toHaveBeenCalled())
    view.unmount()
    finishRender()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(fetchMock).not.toHaveBeenCalled()
    for (const setter of allSetters()) expect(setter).not.toHaveBeenCalled()
  })
})
