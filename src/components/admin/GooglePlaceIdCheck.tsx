'use client'

/**
 * Under a Location's "Google place ID" field: looks the typed ID up on Google
 * Business Profile and shows the profile's name and address in green when one
 * matches, so a wrong ID is caught before the nightly hours check uses it.
 * Checks on load and again shortly after the value changes, before saving.
 */

import { useEffect, useState } from 'react'
import { useAuth, useField } from '@payloadcms/ui'
import { isAdmin } from '@/src/access/roles'
import type { User } from '@/src/payload-types'
import { checkGooglePlaceId, type GooglePlaceCheck } from '@/src/actions/google-place-check'

type Failure = Extract<GooglePlaceCheck, { ok: false }>

/** What to show for a failed check. */
function describe(failure: Failure): string {
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

/** How long typing must pause before the ID is looked up. */
const PAUSE_MS = 600

export function GooglePlaceIdCheck({ path }: { path: string }) {
  const { value } = useField<string>({ path })
  // Only admins may run the check, so nobody else gets a line here at all.
  const admin = isAdmin(useAuth<User>().user)
  const placeId = admin ? (value?.trim() ?? '') : ''
  // The result is kept with the ID it answers, so a stale one is never shown.
  const [checked, setChecked] = useState<{ placeId: string; result: GooglePlaceCheck } | null>(null)

  useEffect(() => {
    if (!placeId) return
    let current = true
    const timer = setTimeout(async () => {
      const result = await checkGooglePlaceId(placeId).catch((): GooglePlaceCheck => ({
        ok: false,
        reason: 'unreachable',
      }))
      if (current) setChecked({ placeId, result })
    }, PAUSE_MS)
    return () => {
      current = false
      clearTimeout(timer)
    }
  }, [placeId])

  if (!placeId) return null
  const result = checked?.placeId === placeId ? checked.result : null
  if (!result) return <p style={{ margin: '4px 0 0' }}>Checking with Google…</p>

  if (!result.ok) {
    return (
      <p role="alert" style={{ margin: '4px 0 0', color: 'var(--theme-error-500)' }}>
        {describe(result)}
      </p>
    )
  }
  return (
    <p role="status" style={{ margin: '4px 0 0', color: 'var(--theme-success-500)' }}>
      ✓ Found on Google: {[result.title, result.address].filter(Boolean).join(', ')}
    </p>
  )
}
