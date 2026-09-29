/**
 * Branded 1200×630 social card for beers and taprooms, served by /og/beer/[slug]
 * and /og/location/[slug]. Used as the Open Graph fallback when the CMS has no ogImage.
 */
import { ImageResponse } from 'next/og'
import sharp from 'sharp'
import { getBaseUrl } from '@/lib/utils/get-base-url'
import { logger } from '@/lib/utils/logger'
import { OG_SIZE } from './paths'

/** Card photo height in px. Originals run to several MB; a social card never shows them larger. */
const PHOTO_HEIGHT = 600

const IMAGE_FETCH_TIMEOUT_MS = 5000
const BLOB_HOST = /\.public\.blob\.vercel-storage\.com$/

/**
 * Resolve a CMS-supplied image URL against the site origin, and refuse anything that
 * is not our own origin or Vercel Blob (media uploads), so the card cannot be pointed
 * at arbitrary hosts.
 */
function allowedImageUrl(url: string): URL | undefined {
  const base = new URL(getBaseUrl())
  const target = new URL(url, base)
  const ours = target.origin === base.origin
  const blob = target.protocol === 'https:' && BLOB_HOST.test(target.hostname)
  return ours || blob ? target : undefined
}

/**
 * Inline a beer photo as a downscaled PNG data URI so a slow, huge, or failing image
 * cannot slow or break the card. Always fetched over HTTP: `public/` is served by the
 * CDN on Vercel and is not part of the function bundle, so it cannot be read from disk.
 * Returns undefined on failure or for a disallowed host.
 */
async function imageDataUri(url?: string | null): Promise<string | undefined> {
  if (!url) return undefined
  try {
    const target = allowedImageUrl(url)
    if (!target) {
      logger.warn('OG card image host not allowed, rendering without it', { url })
      return undefined
    }
    const res = await fetch(target, { signal: AbortSignal.timeout(IMAGE_FETCH_TIMEOUT_MS) })
    if (!res.ok) return undefined
    const original = Buffer.from(await res.arrayBuffer())
    const small = await sharp(original)
      .resize({ height: PHOTO_HEIGHT, withoutEnlargement: true })
      .png()
      .toBuffer()
    return `data:image/png;base64,${small.toString('base64')}`
  } catch (error) {
    logger.warn('OG card image unavailable, rendering without it', { url, error })
    return undefined
  }
}

/** 404 for unknown slugs; cached briefly so probing made-up slugs doesn't hit the DB each time. */
export const ogNotFound = () =>
  new Response('Not found', {
    status: 404,
    headers: { 'Cache-Control': 'public, max-age=300, s-maxage=3600' },
  })

type CardProps = {
  title: string
  subtitle?: string
  /** Beer photo URL (relative or absolute). */
  imageUrl?: string | null
}

export async function renderOgCard({ title, subtitle, imageUrl }: CardProps) {
  const image = await imageDataUri(imageUrl)
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '64px 80px',
        background: '#0a0a0a',
        color: '#fafafa',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, paddingRight: 40 }}>
        <div style={{ fontSize: 30, letterSpacing: 6, textTransform: 'uppercase', opacity: 0.6 }}>
          Lolev Beer
        </div>
        <div
          style={{
            fontSize: title.length > 24 ? 72 : 96,
            fontWeight: 700,
            lineHeight: 1.05,
            marginTop: 24,
          }}
        >
          {title}
        </div>
        {subtitle ? (
          <div style={{ fontSize: 40, opacity: 0.75, marginTop: 24 }}>{subtitle}</div>
        ) : null}
        <div style={{ fontSize: 28, opacity: 0.5, marginTop: 48 }}>lolev.beer · Pittsburgh</div>
      </div>
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element -- rendered by satori, not the browser
        <img src={image} alt="" height={470} style={{ objectFit: 'contain' }} />
      ) : null}
    </div>,
    {
      ...OG_SIZE,
      // A beer's name or photo can change, so don't use ImageResponse's one-year immutable default.
      headers: {
        'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
      },
    },
  )
}
