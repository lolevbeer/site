/**
 * Diff for distributor re-import. A field is only patched when the caller
 * passes it, so the Encompass and Lake Beverage importers (which have no
 * customer-type or website column) never touch those fields. Callers must not
 * set `active` or `customerType` on update unless the source file explicitly
 * provides them — the CSV importer passes them only for non-blank cells.
 */
import type { StateCode } from './states'

const PATCH_STRINGS = ['address', 'city', 'state', 'zip', 'phone', 'website'] as const

export type DistributorRegion = StateCode

export type DistributorCustomerType = 'Retail' | 'On Premise' | 'Home-D'

export type DistributorImportFields = {
  address?: string | null
  city?: string | null
  state?: string | null
  zip?: string | null
  phone?: string | null
  website?: string | null
  customerType?: DistributorCustomerType | null
  region?: DistributorRegion | null
  active?: boolean | null
}

export type DistributorImportPatch = Partial<{
  address: string
  city: string
  state: string
  zip: string
  phone: string
  website: string
  customerType: DistributorCustomerType
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
    phone?: string
    website?: string
    customerType?: DistributorCustomerType
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
    patch.zip !== undefined
  )
}

export function formatFullAddress(parts: {
  address?: string | null
  city?: string | null
  state?: string | null
  zip?: string | null
}): string {
  const street = parts.address?.trim() || ''
  const city = parts.city?.trim() || ''
  const state = parts.state?.trim() || ''
  const zip = parts.zip?.trim() || ''
  return [street, [city, state, zip].filter(Boolean).join(' ')].filter(Boolean).join(', ')
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
