'use server'

/**
 * The check beside a Location's "Google place ID" field. Admins only. Asks
 * Google Business Profile, with the same sign-in the nightly hours check uses,
 * for the profile that has this place ID, so a match means the hours check can
 * read that taproom.
 *
 * Result: `ok` true with the profile's name and one-line address, its address
 * and phone as the Location fields hold them (`details`, for copying into the
 * form), and Google's regular hours for each weekday (`week`, shown beside
 * the weekly hours). Otherwise `reason`
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
import type { Weekday } from '@/lib/types/location'
import { getTodayEST } from '@/lib/utils/date'
import { businessCredentials, fetchProfiles, googleWeek } from '@/src/jobs/check-google-hours'

/** A Google listing's address and phone, keyed like the Location fields they fill. */
export interface GoogleListingDetails {
  street: string
  city: string
  state: string
  zip: string
  phone: string
}

export type GooglePlaceCheck =
  | {
      ok: true
      title: string
      address: string
      details: GoogleListingDetails
      week: Record<Weekday, string>
    }
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

  const {
    addressLines = [],
    locality,
    administrativeArea,
    postalCode,
  } = profile.storefrontAddress ?? {}
  const street = addressLines.filter(Boolean).join(', ')
  return {
    ok: true,
    title: profile.title ?? '',
    address: [street, locality].filter(Boolean).join(', '),
    details: {
      street,
      city: locality ?? '',
      state: administrativeArea ?? '',
      zip: postalCode ?? '',
      phone: profile.phoneNumbers?.primaryPhone ?? '',
    },
    week: googleWeek(profile, getTodayEST()),
  }
}
