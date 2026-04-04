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
  return NextResponse.redirect(authUrl)
}
