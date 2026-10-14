/**
 * Media strips EXIF (GPS, device) from uploads before Payload stores them.
 * The main file's URL is public, and Payload 4 keeps no stripped copy for us.
 */
// @vitest-environment node
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import type { PayloadRequest } from 'payload'
import { Media } from '@/src/collections/Media'

const stripMetadata = Media.hooks!.beforeOperation![0]

async function jpegWithGps() {
  return sharp({ create: { width: 8, height: 4, channels: 3, background: '#c00' } })
    .withExif({ IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '40/1 26/1 0/1' } })
    .jpeg()
    .toBuffer()
}

const editor = { id: 'u1', roles: ['bartender'] }
const admin = { id: 'u2', roles: ['admin'] }

async function run(
  file: PayloadRequest['file'],
  operation: 'create' | 'update' | 'read' = 'create',
  user: object | null = editor,
) {
  const req = { file, user } as PayloadRequest
  await stripMetadata({ args: { req }, operation, req } as never)
  return req.file
}

describe('Media upload metadata', () => {
  it('drops EXIF, keeps the format and the pixels', async () => {
    const data = await jpegWithGps()
    expect((await sharp(data).metadata()).exif).toBeDefined()

    const file = await run({ data, mimetype: 'image/jpeg', name: 'can.jpg', size: data.length })
    const meta = await sharp(file!.data).metadata()
    expect(meta.exif).toBeUndefined()
    expect(meta.format).toBe('jpeg')
    expect([meta.width, meta.height]).toEqual([8, 4])
    expect(file!.size).toBe(file!.data.length)
  })

  it('leaves non-images and other operations alone', async () => {
    const video = { data: Buffer.from('webm'), mimetype: 'video/webm', name: 'label.webm', size: 4 }
    expect(await run(video)).toBe(video)
    const jpeg = await jpegWithGps()
    const image = { data: jpeg, mimetype: 'image/jpeg', name: 'a.jpg', size: jpeg.length }
    expect(await run(image, 'read')).toBe(image)
  })

  it('decodes nothing for callers Media access would refuse', async () => {
    const jpeg = await jpegWithGps()
    const image = { data: jpeg, mimetype: 'image/jpeg', name: 'a.jpg', size: jpeg.length }
    expect(await run(image, 'create', null)).toBe(image)
    expect(await run(image, 'update', editor)).toBe(image)
    expect(await run(image, 'update', admin)).not.toBe(image)
  })
})
