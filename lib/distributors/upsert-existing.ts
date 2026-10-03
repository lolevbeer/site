/**
 * Apply a re-import patch to an existing distributor. Geocodes when the
 * street address changes. Does not infer customer type.
 *
 * Runs as `user` (the admin the calling import endpoint authorized) with
 * `overrideAccess: false`, so the Distributors access rules apply.
 */

import type { Payload } from 'payload'
import type { Distributor, User } from '@/src/payload-types'
import {
  addressFieldsChanged,
  formatFullAddress,
  type DistributorImportPatch,
} from '@/lib/distributors/import-patch'

export async function applyExistingDistributorPatch(args: {
  payload: Payload
  user: User
  current: Distributor
  patch: DistributorImportPatch
  name: string
  geocode: (address: string) => Promise<[number, number] | null>
}): Promise<{ geocodeFailed: boolean; warning?: string }> {
  const { payload, user, current, patch, name, geocode } = args
  let geocodeFailed = false
  if (addressFieldsChanged(patch)) {
    const full = formatFullAddress({
      address: patch.address ?? current.address,
      city: patch.city ?? current.city,
      state: patch.state ?? current.state,
      zip: patch.zip ?? current.zip,
    })
    const coords = await geocode(full)
    if (coords) patch.location = coords
    else geocodeFailed = true
  }

  await payload.update({
    collection: 'distributors',
    id: current.id,
    data: patch,
    overrideAccess: false,
    user,
  })

  return {
    geocodeFailed,
    warning: geocodeFailed
      ? `Warning: Could not geocode "${name}"; address updated, pin unchanged`
      : undefined,
  }
}
