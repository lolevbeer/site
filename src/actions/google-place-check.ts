'use server'

/**
 * The check beside a Location's "Google place ID" field. Admins only. Asks
 * Google Business Profile, with the same sign-in the nightly hours check uses,
 * for the profile that has this place ID, so a match means the hours check can
 * read that taproom.
 *
 * Result: `ok` true with the profile's name and address. Otherwise `reason`
 * says why: `forbidden` (not an admin), `not-configured` (no `GOOGLE_BUSINESS_*`
 * on this server), `rejected` (Google refused the request; `detail` is its own
 * reason), `not-found` (the signed-in account manages no profile with this
 * place ID), `no-hours` (the profile has no regular hours, so the nightly check
 * would skip it), or `unreachable` (Google is down or timed out).
 */

import { getPayload } from 'payload'
import { headers } from 'next/headers'
import config from '@payload-config'
import { isAdmin } from '@/src/access/roles'
import type { User } from '@/src/payload-types'
import { businessCredentials, fetchProfiles } from '@/src/jobs/check-google-hours'

export type GooglePlaceCheck =
  | { ok: true; title: string; address: string }
  | { ok: false; reason: 'forbidden' | 'not-configured' | 'not-found' | 'no-hours' | 'unreachable' }
  | { ok: false; reason: 'rejected'; detail: string }

export async function checkGooglePlaceId(placeId: string): Promise<GooglePlaceCheck> {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await headers() })
  if (!isAdmin(user as User | null)) return { ok: false, reason: 'forbidden' }

  const credentials = businessCredentials()
  if (!credentials) return { ok: false, reason: 'not-configured' }

  let google: Awaited<ReturnType<typeof fetchProfiles>>
  try {
    google = await fetchProfiles(credentials)
  } catch {
    return { ok: false, reason: 'unreachable' }
  }
  if ('rejected' in google) {
    const detail = [`HTTP ${google.rejected}`, google.detail].filter(Boolean).join(': ')
    return { ok: false, reason: 'rejected', detail }
  }

  const wanted = typeof placeId === 'string' ? placeId.trim() : ''
  const profile = google.profiles.find((p) => p.metadata?.placeId === wanted)
  if (!profile) return { ok: false, reason: 'not-found' }
  if (!profile.regularHours?.periods?.length) return { ok: false, reason: 'no-hours' }

  const { addressLines = [], locality } = profile.storefrontAddress ?? {}
  return {
    ok: true,
    title: profile.title ?? '',
    address: [...addressLines, locality].filter(Boolean).join(', '),
  }
}
