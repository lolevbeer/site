/**
 * Media `sizes` → `variants` migration (Payload 4 beta.0). Runs `up` against a
 * fake Mongo collection, with Media's upload config built the way Payload
 * builds it (sharpTransformer's init writes the Sharp variant names onto it).
 * The helper's both-keys guard depends on those names.
 */
import { describe, expect, it, vi } from 'vitest'
import { sharpTransformer } from '@payloadcms/transformer-sharp'
import { Media, mediaSharp } from '@/src/collections/Media'
import { down, up } from '@/src/migrations/20261013_090000_media_sizes_to_variants'

/** Media config after Sharp's init, as Payload sanitizes it. */
function sanitizedMedia() {
  const transformer = sharpTransformer({ collections: { media: mediaSharp } })
  const base = { collections: [Media], upload: { transformers: [transformer] } }
  const config = (transformer as unknown as { init: (c: unknown) => typeof base }).init(base)
  return config.collections[0]
}

/** In-memory media docs behind the Mongo calls the helper makes. */
function fakeMedia(docs: Record<string, unknown>[]) {
  const has = (doc: Record<string, unknown>, key: string) => doc[key] !== undefined
  return {
    docs,
    findOne: vi.fn(async (query: Record<string, unknown>) =>
      docs.find((doc) => Object.keys(query).every((key) => has(doc, key))) ?? null,
    ),
    find: vi.fn((query: Record<string, unknown>) => {
      const [key] = Object.keys(query)
      const matches = docs.filter((doc) => has(doc, key))
      return {
        async *[Symbol.asyncIterator]() {
          yield* matches
        },
        close: async () => {},
      }
    }),
    indexes: vi.fn(async () => []),
    updateMany: vi.fn(async () => {
      let modifiedCount = 0
      for (const doc of docs) {
        if (has(doc, 'sizes') && !has(doc, 'variants')) {
          doc.variants = doc.sizes
          delete doc.sizes
          modifiedCount++
        }
      }
      return { modifiedCount }
    }),
  }
}

function migrationArgs(collection: ReturnType<typeof fakeMedia>) {
  return {
    payload: {
      config: { collections: [sanitizedMedia()] },
      db: { collections: { media: { collection } }, versions: {} },
      logger: { info: vi.fn() },
    },
    req: {},
  } as never
}

const thumb = { url: '/a-150x150.webp', width: 150, height: 150, filename: 'a-150x150.webp' }

describe('media sizes → variants migration', () => {
  it('sees Media as an upload collection with its Sharp variant names', () => {
    expect(sanitizedMedia().upload).toMatchObject({
      variants: [{ name: 'thumbnail' }, { name: 'card' }, { name: 'detail' }],
    })
  })

  it('renames sizes to variants and is safe to re-run', async () => {
    const media = fakeMedia([{ _id: 'a', sizes: { thumbnail: thumb } }, { _id: 'b', variants: {} }])
    await up(migrationArgs(media))
    expect(media.docs[0]).toEqual({ _id: 'a', variants: { thumbnail: thumb } })
    await up(migrationArgs(media))
    expect(media.docs[0]).toEqual({ _id: 'a', variants: { thumbnail: thumb } })
  })

  it('writes nothing when a doc holds both keys', async () => {
    const media = fakeMedia([{ _id: 'a', sizes: { thumbnail: thumb }, variants: { thumbnail: thumb } }])
    await expect(up(migrationArgs(media))).rejects.toThrow(/both "sizes" and "variants"/)
    expect(media.updateMany).not.toHaveBeenCalled()
  })

  it('refuses to roll back', async () => {
    await expect(down()).rejects.toThrow(/roll-forward only/)
  })
})
