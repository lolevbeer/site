/**
 * Diff for distributor re-import. Type is ignored — the Encompass feed has no
 * customer-type column, and we do not infer one. Callers must not set `active`
 * on update unless the feed is explicitly the source of truth for visibility.
 */

const PATCH_STRINGS = ['address', 'city', 'state', 'zip', 'phone'] as const

export type DistributorRegion = 'NY' | 'OH' | 'PA' | 'WV'

export type DistributorImportFields = {
  address?: string | null
  city?: string | null
  state?: string | null
  zip?: string | null
  phone?: string | null
  region?: DistributorRegion | null
  active?: boolean | null
}

export type DistributorImportPatch = Partial<{
  address: string
  city: string
  state: string
  zip: string
  phone: string
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
