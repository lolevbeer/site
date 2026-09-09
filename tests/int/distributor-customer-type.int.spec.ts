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

describe('addressFieldsChanged', () => {
  it('is true only when street/city/state/zip are in the patch', () => {
    expect(addressFieldsChanged({ phone: '(412) 555-0199' })).toBe(false)
    expect(addressFieldsChanged({ address: '2 Main' })).toBe(true)
    expect(addressFieldsChanged({ zip: '' })).toBe(true)
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
    const sleep = vi.fn().mockResolvedValue(undefined)
    const patch = { address: '2 Main' }
    await applyExistingDistributorPatch({
      payload: { update } as never,
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
      sleep,
    })
    expect(geocode).toHaveBeenCalled()
    expect(sleep).toHaveBeenCalledWith(1100)
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'distributors',
        id: '1',
        data: expect.objectContaining({ address: '2 Main', location: [-80, 40.4] }),
      }),
    )
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
