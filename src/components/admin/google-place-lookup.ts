'use client'

/**
 * The Google Business Profile lookup behind a Location's place ID, shared by
 * the place ID badge (Visitor information) and the comparison with Google's
 * hours (Hours & operations), so one page view asks Google once per ID.
 */

import { useEffect, useState } from 'react'
import { checkGooglePlaceId, type GooglePlaceCheck } from '@/src/actions/google-place-check'

const lookups = new Map<string, Promise<GooglePlaceCheck>>()

function lookUp(placeId: string): Promise<GooglePlaceCheck> {
  let lookup = lookups.get(placeId)
  if (!lookup) {
    lookup = checkGooglePlaceId(placeId).catch((): GooglePlaceCheck => ({
      ok: false,
      reason: 'unreachable',
    }))
    lookups.set(placeId, lookup)
    // Google being down is worth asking again about; any other answer stands for this page view.
    void lookup.then((result) => {
      if (!result.ok && result.reason === 'unreachable') lookups.delete(placeId)
    })
  }
  return lookup
}

/** How long typing must pause before an ID is looked up. */
const PAUSE_MS = 600

/**
 * Google's answer for `placeId` (trimmed), or null while it is being looked up
 * or when there is no ID. A blank ID is never sent.
 */
export function useGooglePlace(placeId: string): GooglePlaceCheck | null {
  // The result is kept with the ID it answers, so a stale one is never shown.
  const [answer, setAnswer] = useState<{ placeId: string; result: GooglePlaceCheck } | null>(null)

  useEffect(() => {
    if (!placeId) return
    let current = true
    const timer = setTimeout(async () => {
      const result = await lookUp(placeId)
      if (current) setAnswer({ placeId, result })
    }, PAUSE_MS)
    return () => {
      current = false
      clearTimeout(timer)
    }
  }, [placeId])

  return placeId && answer?.placeId === placeId ? answer.result : null
}

/** Why a lookup failed, in words for the admin. */
export function describeFailure(failure: Extract<GooglePlaceCheck, { ok: false }>): string {
  switch (failure.reason) {
    case 'forbidden':
      return 'Only admins can check a place ID.'
    case 'not-configured':
      return 'Google sign-in is not set up on this server, so the ID cannot be checked.'
    case 'rejected':
      return `Google refused the request (${failure.detail}).`
    case 'not-found':
      return 'No Google Business Profile managed by the signed-in Google account has this place ID.'
    case 'no-hours':
      return 'Found on Google, but the listing has no regular hours, so the nightly check would skip it.'
    case 'unreachable':
      return 'Could not reach Google. Try again.'
  }
}
