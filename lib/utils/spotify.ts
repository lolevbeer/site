/**
 * Spotify API utilities for fetching currently playing track.
 * Uses OAuth refresh token flow for persistent per-location access.
 * @module
 */

import { logger } from './logger'

const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token'
const SPOTIFY_NOW_PLAYING_URL = 'https://api.spotify.com/v1/me/player/currently-playing'

/** Currently playing track info returned to the client */
export interface NowPlaying {
  trackName: string
  artistName: string
  albumName: string
  albumArtUrl: string | null
  isPlaying: boolean
  /** Progress within the track in ms */
  progressMs: number
  /** Total track duration in ms */
  durationMs: number
}

/** In-memory cache for access tokens (refresh tokens are long-lived, access tokens expire) */
const tokenCache = new Map<string, { accessToken: string; expiresAt: number }>()

/**
 * Get a valid Spotify access token for a location, refreshing if needed.
 */
async function getAccessToken(refreshToken: string): Promise<string | null> {
  const clientId = process.env.SPOTIFY_CLIENT_ID
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    logger.error('Spotify client credentials not configured')
    return null
  }

  // Check cache
  const cached = tokenCache.get(refreshToken)
  if (cached && cached.expiresAt > Date.now() + 60_000) {
    return cached.accessToken
  }

  try {
    const response = await fetch(SPOTIFY_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    })

    if (!response.ok) {
      logger.error(`Spotify token refresh failed: ${response.status}`)
      return null
    }

    const data = await response.json()
    const accessToken = data.access_token as string
    const expiresIn = (data.expires_in as number) || 3600

    // Cache the token
    tokenCache.set(refreshToken, {
      accessToken,
      expiresAt: Date.now() + expiresIn * 1000,
    })

    return accessToken
  } catch (error) {
    logger.error('Spotify token refresh error:', error)
    return null
  }
}

/**
 * Fetch the currently playing track for a Spotify account.
 * Returns null if nothing is playing or on error.
 */
export async function getNowPlaying(refreshToken: string): Promise<NowPlaying | null> {
  const accessToken = await getAccessToken(refreshToken)
  if (!accessToken) return null

  try {
    const response = await fetch(SPOTIFY_NOW_PLAYING_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
      // Don't cache — we want fresh data every poll
      cache: 'no-store',
    })

    // 204 = nothing playing
    if (response.status === 204) return null
    if (!response.ok) return null

    const data = await response.json()

    // Only handle track type (not episodes/ads)
    if (data.currently_playing_type !== 'track' || !data.item) return null

    const track = data.item
    const album = track.album

    return {
      trackName: track.name,
      artistName: track.artists?.map((a: { name: string }) => a.name).join(', ') || 'Unknown',
      albumName: album?.name || '',
      albumArtUrl: album?.images?.[0]?.url || null,
      isPlaying: data.is_playing === true,
      progressMs: data.progress_ms || 0,
      durationMs: track.duration_ms || 0,
    }
  } catch (error) {
    logger.error('Spotify now playing error:', error)
    return null
  }
}

/**
 * Build the Spotify authorization URL for linking a location.
 */
/**
 * Get the canonical site URL for OAuth redirects.
 * Spotify requires HTTPS, so we always use the production domain for OAuth.
 * Set SPOTIFY_REDIRECT_URI to override (e.g. for staging).
 */
function getSpotifyRedirectBase(): string {
  return process.env.SPOTIFY_REDIRECT_URI
    || process.env.NEXT_PUBLIC_SITE_URL
    || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '')
    || 'https://new.lolev.beer'
}

export function getSpotifyAuthUrl(locationSlug: string): string {
  const clientId = process.env.SPOTIFY_CLIENT_ID
  const redirectUri = `${getSpotifyRedirectBase()}/api/spotify/callback`

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId || '',
    scope: 'user-read-currently-playing user-read-playback-state',
    redirect_uri: redirectUri,
    state: locationSlug,
  })

  return `https://accounts.spotify.com/authorize?${params.toString()}`
}

/**
 * Exchange an authorization code for access + refresh tokens.
 */
export async function exchangeCodeForTokens(code: string): Promise<{ accessToken: string; refreshToken: string } | null> {
  const clientId = process.env.SPOTIFY_CLIENT_ID
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET
  const redirectUri = `${getSpotifyRedirectBase()}/api/spotify/callback`

  if (!clientId || !clientSecret) return null

  try {
    const response = await fetch(SPOTIFY_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    })

    if (!response.ok) return null

    const data = await response.json()
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
    }
  } catch {
    return null
  }
}
