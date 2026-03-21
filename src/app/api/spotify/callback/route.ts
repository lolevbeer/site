/**
 * Spotify OAuth callback endpoint.
 * Receives the authorization code from Spotify and exchanges it for tokens.
 * Stores the refresh token on the location document in Payload.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/src/payload.config'
import { exchangeCodeForTokens } from '@/lib/utils/spotify'
import { logger } from '@/lib/utils/logger'

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const locationSlug = request.nextUrl.searchParams.get('state')
  const error = request.nextUrl.searchParams.get('error')

  if (error) {
    logger.error(`Spotify auth denied: ${error}`)
    return NextResponse.json({ error: `Spotify authorization denied: ${error}` }, { status: 400 })
  }

  if (!code || !locationSlug) {
    return NextResponse.json({ error: 'Missing code or state' }, { status: 400 })
  }

  const tokens = await exchangeCodeForTokens(code)
  if (!tokens) {
    logger.error('Failed to exchange Spotify authorization code')
    return NextResponse.json({ error: 'Failed to exchange authorization code' }, { status: 500 })
  }

  // Find the location and store the refresh token
  try {
    const payload = await getPayload({ config })
    const locations = await payload.find({
      collection: 'locations',
      where: { slug: { equals: locationSlug } },
      limit: 1,
      overrideAccess: true,
    })

    if (locations.docs.length === 0) {
      return NextResponse.json({ error: `Location "${locationSlug}" not found` }, { status: 404 })
    }

    await payload.update({
      collection: 'locations',
      id: locations.docs[0].id,
      data: { spotifyRefreshToken: tokens.refreshToken },
      overrideAccess: true,
    })

    logger.info(`Spotify linked for location: ${locationSlug}`)
    return NextResponse.json({ success: true, location: locationSlug })
  } catch (err) {
    logger.error('Failed to store Spotify token:', err)
    return NextResponse.json({ error: 'Failed to store token' }, { status: 500 })
  }
}
