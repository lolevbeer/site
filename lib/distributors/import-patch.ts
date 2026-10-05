/**
 * Diff for distributor re-import. A field is only patched when the caller
 * passes it, so the Encompass importer (which has no customer-type or
 * website column) never touches those fields. Callers must not
 * set `active` or `customerType` on update unless the source file explicitly
 * provides them — the CSV importer passes them only for non-blank cells.
 */
import { countrySuffix } from '@/lib/utils/country-names'
import type { CustomerType, StateCode } from './fields'

const PATCH_STRINGS = ['address', 'city', 'state', 'zip', 'country', 'phone', 'website'] as const

export type DistributorRegion = StateCode

export type DistributorImportFields = {
  address?: string | null
  city?: string | null
  state?: string | null
  zip?: string | null
  country?: string | null
  phone?: string | null
  website?: string | null
  customerType?: CustomerType | null
  region?: DistributorRegion | null
  active?: boolean | null
}

export type DistributorImportPatch = Partial<{
  address: string
  city: string
  state: string
  zip: string
  country: string
  phone: string
  website: string
  customerType: CustomerType
  region: DistributorRegion
  active: boolean
  location: [number, number]
}>

export function distributorImportPatch(
  current: DistributorImportFields,
  next: {
    address?: string
    city?: string
    state?: string
    zip?: string
    country?: string
    phone?: string
    website?: string
    customerType?: CustomerType
    region?: DistributorRegion
    active?: boolean
  },
): DistributorImportPatch | null {
  const patch: DistributorImportPatch = {}
  for (const field of PATCH_STRINGS) {
    if (next[field] === undefined) continue
    const incoming = (next[field] ?? '').trim()
    const previous = (current[field] || '').trim()
    if (incoming !== previous) patch[field] = incoming
  }
  if (next.customerType !== undefined && next.customerType !== current.customerType) {
    patch.customerType = next.customerType
  }
  if (next.region !== undefined) {
    const incoming = next.region
    const previous = current.region || undefined
    if (incoming !== previous) patch.region = incoming
  }
  if (typeof next.active === 'boolean' && current.active !== next.active) {
    patch.active = next.active
  }
  return Object.keys(patch).length > 0 ? patch : null
}

export function addressFieldsChanged(patch: DistributorImportPatch): boolean {
  return (
    patch.address !== undefined ||
    patch.city !== undefined ||
    patch.state !== undefined ||
    patch.zip !== undefined ||
    patch.country !== undefined
  )
}

/**
 * The geocoder query line. The country name is appended outside the US so an
 * address like "47 High Street, Penge" cannot resolve to the wrong country.
 */
export function formatFullAddress(parts: {
  address?: string | null
  city?: string | null
  state?: string | null
  zip?: string | null
  country?: string | null
}): string {
  const street = parts.address?.trim() || ''
  const city = parts.city?.trim() || ''
  const state = parts.state?.trim() || ''
  const zip = parts.zip?.trim() || ''
  return [street, [city, state, zip].filter(Boolean).join(' '), countrySuffix(parts.country)]
    .filter(Boolean)
    .join(', ')
}

export function indexDocsByName<T extends { name: string }>(docs: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const doc of docs) {
    const list = map.get(doc.name)
    if (list) list.push(doc)
    else map.set(doc.name, [doc])
  }
  return map
}
