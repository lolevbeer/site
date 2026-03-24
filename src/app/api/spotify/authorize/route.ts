/**
 * Spotify OAuth authorization endpoint.
 * Redirects to Spotify's auth page to link a location's Spotify account.
 * Usage: GET /api/spotify/authorize?location=lawrenceville
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSpotifyAuthUrl } from '@/lib/utils/spotify'

export async function GET(request: NextRequest) {
  const locationSlug = request.nextUrl.searchParams.get('location')

  if (!locationSlug) {
    return NextResponse.json(
      { error: 'Missing location parameter' },
      { status: 400 }
    )
  }

  const authUrl = getSpotifyAuthUrl(locationSlug)

  if (request.nextUrl.searchParams.get('debug')) {
    const url = new URL(authUrl)
    return NextResponse.json({
      authUrl,
      redirect_uri: url.searchParams.get('redirect_uri'),
      client_id: url.searchParams.get('client_id') ? '***set***' : '***missing***',
      env: {
        SPOTIFY_REDIRECT_URI: process.env.SPOTIFY_REDIRECT_URI ? '***set***' : undefined,
        NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || undefined,
        VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL || undefined,
      },
    })
  }

  return NextResponse.redirect(authUrl)
}
