import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { User } from '@/src/payload-types'

const auth = vi.fn()
const find = vi.fn()
const findByID = vi.fn()
const findGlobal = vi.fn()
const create = vi.fn()
const update = vi.fn()
const updateGlobal = vi.fn()
const deleteDocument = vi.fn()

vi.mock('payload', () => ({
  getPayload: vi.fn(async () => ({
    auth,
    find,
    findByID,
    findGlobal,
    create,
    update,
    updateGlobal,
    delete: deleteDocument,
  })),
}))

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => new Headers()),
}))

vi.mock('@payload-config', () => ({ default: {} }))

import {
  getActiveLocations,
  getEventsOnDate,
  setRecurringFoodExclusion,
  setRecurringFoodSchedule,
} from '@/src/actions/admin-data'

function userWith(roles: User['roles']): User {
  return {
    id: 'user-id',
    collection: 'users',
    email: 'user@example.com',
    roles,
    locations: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

beforeEach(() => {
  auth.mockReset()
  find.mockReset()
  findByID.mockReset()
  findGlobal.mockReset()
  create.mockReset()
  update.mockReset()
  updateGlobal.mockReset()
  deleteDocument.mockReset()
})

describe('admin data server actions', () => {
  it('rejects unauthenticated requests before querying data', async () => {
    auth.mockResolvedValue({ user: null })

    await expect(getActiveLocations()).rejects.toThrow('Unauthorized')
    expect(find).not.toHaveBeenCalled()
  })

  it('rejects authenticated users without the action role', async () => {
    auth.mockResolvedValue({ user: userWith(['bartender']) })

    await expect(getEventsOnDate('2026-08-26', 'location-1')).rejects.toThrow('Unauthorized')
    expect(find).not.toHaveBeenCalled()
  })

  it('runs authorized queries as the user with access control enabled', async () => {
    const user = userWith(['food-manager'])
    auth.mockResolvedValue({ user })
    find.mockResolvedValue({ docs: [] })

    await expect(getActiveLocations()).resolves.toEqual([])
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'locations',
        overrideAccess: false,
        user,
      }),
    )
  })

  it('writes normalized recurring grid changes as the food manager', async () => {
    const user = userWith(['food-manager'])
    auth.mockResolvedValue({ user })
    findGlobal.mockResolvedValue({ normalizedAt: '2026-08-26T00:00:00.000Z' })
    find.mockResolvedValue({ docs: [] })
    create.mockResolvedValue({})

    await setRecurringFoodSchedule(2027, 'location-1', 'monday', 'first', 'vendor-1')

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'recurring-food-schedules',
        data: expect.objectContaining({
          location: 'location-1',
          vendor: 'vendor-1',
          year: 2027,
          day: 'monday',
          occurrence: 'first',
        }),
        overrideAccess: false,
        user,
      }),
    )
  })

  it('rejects invalid recurring grid coordinates before querying schedule rows', async () => {
    auth.mockResolvedValue({ user: userWith(['food-manager']) })

    await expect(
      setRecurringFoodSchedule(2027, 'location-1', 'funday', 'first', 'vendor-1'),
    ).rejects.toThrow('Invalid recurring day')
    expect(findGlobal).not.toHaveBeenCalled()
    expect(find).not.toHaveBeenCalled()
  })

  it('rejects years outside the supported management range', async () => {
    auth.mockResolvedValue({ user: userWith(['food-manager']) })

    await expect(
      setRecurringFoodSchedule(1999, 'location-1', 'monday', 'first', 'vendor-1'),
    ).rejects.toThrow('Invalid year')
    expect(findGlobal).not.toHaveBeenCalled()
    expect(find).not.toHaveBeenCalled()
  })

  it('rejects impossible calendar dates before querying exclusion rows', async () => {
    auth.mockResolvedValue({ user: userWith(['food-manager']) })

    await expect(setRecurringFoodExclusion('location-1', '2026-02-31', true)).rejects.toThrow(
      'Invalid date',
    )
    expect(findGlobal).not.toHaveBeenCalled()
    expect(find).not.toHaveBeenCalled()
  })
})
