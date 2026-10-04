/**
 * Re-import patches address fields, never invents a customer type, and does
 * not reactivate CMS-hidden stores unless the caller passes `active`.
 */
import { describe, expect, it, vi } from 'vitest'
import {
  addressFieldsChanged,
  distributorImportPatch,
  formatFullAddress,
  indexDocsByName,
} from '@/lib/distributors/import-patch'
import { applyExistingDistributorPatch } from '@/lib/distributors/upsert-existing'

describe('distributorImportPatch', () => {
  const current = {
    address: '1 Main',
    city: 'Pittsburgh',
    state: 'PA',
    zip: '15201',
    phone: '(412) 555-0100',
    region: 'PA' as const,
    active: false,
  }

  it('updates when address changed and skips when nothing changed', () => {
    expect(
      distributorImportPatch(current, {
        address: '1 Main',
        city: 'Pittsburgh',
        state: 'PA',
        zip: '15201',
      }),
    ).toBeNull()
    expect(
      distributorImportPatch(current, {
        address: '2 Main',
        city: 'Pittsburgh',
        state: 'PA',
        zip: '15201',
      }),
    ).toEqual({ address: '2 Main' })
  })

  it('never writes customerType', () => {
    const patch = distributorImportPatch(current, {
      address: '2 Main',
      city: 'Pittsburgh',
      state: 'PA',
      zip: '15201',
    })
    expect(patch).not.toHaveProperty('customerType')
  })

  it('does not reactivate a hidden store unless active is passed', () => {
    expect(
      distributorImportPatch(current, {
        address: '1 Main',
        city: 'Pittsburgh',
        state: 'PA',
        zip: '15201',
      }),
    ).toBeNull()
    expect(
      distributorImportPatch(current, {
        address: '1 Main',
        city: 'Pittsburgh',
        state: 'PA',
        zip: '15201',
        active: true,
      }),
    ).toEqual({ active: true })
  })

  it('writes an empty zip when the feed sends a blank value', () => {
    expect(
      distributorImportPatch(current, {
        address: '1 Main',
        city: 'Pittsburgh',
        state: 'PA',
        zip: '',
      }),
    ).toEqual({ zip: '' })
  })

  it('skips keys the caller omitted', () => {
    expect(
      distributorImportPatch(current, {
        address: '1 Main',
        city: 'Pittsburgh',
        state: 'PA',
        zip: '15201',
      }),
    ).toBeNull()
  })
})

describe('distributorImportPatch: country', () => {
  const stored = { address: '47 High Street', city: 'Penge', country: 'GB' }

  it('patches a changed country', () => {
    expect(distributorImportPatch(stored, { country: 'IE' })).toEqual({ country: 'IE' })
  })

  it('skips an unchanged country', () => {
    expect(distributorImportPatch(stored, { country: 'GB' })).toBeNull()
  })

  it('treats a stored blank country as unchanged when the row says nothing', () => {
    expect(distributorImportPatch({ address: '1 Main' }, { address: '1 Main' })).toBeNull()
  })

  it('fills a stored blank country when the row supplies one', () => {
    expect(distributorImportPatch({ address: '1 Main' }, { country: 'NL' })).toEqual({
      country: 'NL',
    })
  })

  it('never clears a stored country when the row leaves it out', () => {
    expect(distributorImportPatch(stored, { address: '47 High Street' })).toBeNull()
  })

  it('does not require a region, so a non-US row can be patched', () => {
    expect(distributorImportPatch({ ...stored }, { city: 'London' })).toEqual({ city: 'London' })
  })
})

describe('addressFieldsChanged', () => {
  it('is true only when street/city/state/zip/country are in the patch', () => {
    expect(addressFieldsChanged({ phone: '(412) 555-0199' })).toBe(false)
    expect(addressFieldsChanged({ address: '2 Main' })).toBe(true)
    expect(addressFieldsChanged({ zip: '' })).toBe(true)
    expect(addressFieldsChanged({ country: 'NL' })).toBe(true)
  })
})

describe('formatFullAddress', () => {
  it('joins the geocode line', () => {
    expect(
      formatFullAddress({
        address: '1 Main',
        city: 'Pittsburgh',
        state: 'PA',
        zip: '15201',
      }),
    ).toBe('1 Main, Pittsburgh PA 15201')
  })
})

describe('applyExistingDistributorPatch', () => {
  it('geocodes and writes location when the address changes', async () => {
    const update = vi.fn().mockResolvedValue({})
    const geocode = vi.fn().mockResolvedValue([-80, 40.4] as [number, number])
    const patch = { address: '2 Main' }
    await applyExistingDistributorPatch({
      payload: { update } as never,
      user: { id: 'admin-id', roles: ['admin'] } as never,
      current: {
        id: '1',
        address: '1 Main',
        city: 'Pittsburgh',
        state: 'PA',
        zip: '15201',
      } as never,
      patch,
      name: 'Store',
      geocode,
    })
    expect(geocode).toHaveBeenCalledWith({
      address: '2 Main',
      city: 'Pittsburgh',
      state: 'PA',
      zip: '15201',
    })
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'distributors',
        id: '1',
        data: expect.objectContaining({ address: '2 Main', location: [-80, 40.4] }),
        overrideAccess: false,
        user: { id: 'admin-id', roles: ['admin'] },
      }),
    )
  })
})

describe('applyExistingDistributorPatch: country', () => {
  const user = { id: 'admin-id', roles: ['admin'] } as never

  it('re-geocodes with the new country when only the country changes', async () => {
    const update = vi.fn().mockResolvedValue({})
    const geocode = vi.fn().mockResolvedValue([4.9, 52.37] as [number, number])
    await applyExistingDistributorPatch({
      payload: { update } as never,
      user,
      current: { id: '1', address: '1 Main', city: 'Springfield', country: 'US' } as never,
      patch: { country: 'NL' },
      name: 'Store',
      geocode,
    })
    expect(geocode).toHaveBeenCalledWith(expect.objectContaining({ country: 'NL' }))
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ country: 'NL', location: [4.9, 52.37] }),
      }),
    )
  })

  it('passes the stored country when the patch changes something else', async () => {
    const update = vi.fn().mockResolvedValue({})
    const geocode = vi.fn().mockResolvedValue([-0.06, 51.41] as [number, number])
    await applyExistingDistributorPatch({
      payload: { update } as never,
      user,
      current: { id: '1', address: '47 High Street', city: 'Penge', country: 'GB' } as never,
      patch: { city: 'London' },
      name: 'Store',
      geocode,
    })
    expect(geocode).toHaveBeenCalledWith(expect.objectContaining({ city: 'London', country: 'GB' }))
  })

  it('leaves the pin alone and warns when the geocode fails', async () => {
    const update = vi.fn().mockResolvedValue({})
    const geocode = vi.fn().mockResolvedValue(null)
    const result = await applyExistingDistributorPatch({
      payload: { update } as never,
      user,
      current: { id: '1', address: '1 Main', country: 'GB' } as never,
      patch: { country: 'IE' },
      name: 'Store',
      geocode,
    })
    expect(result.geocodeFailed).toBe(true)
    expect(update.mock.calls[0][0].data).not.toHaveProperty('location')
  })
})

describe('indexDocsByName', () => {
  it('groups collisions so importers can refuse a name-only overwrite', () => {
    const map = indexDocsByName([
      { id: 'pa', name: 'Sheetz', region: 'PA' },
      { id: 'oh', name: 'Sheetz', region: 'OH' },
    ])
    expect(map.get('Sheetz')).toHaveLength(2)
  })
})
