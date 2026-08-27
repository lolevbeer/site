/**
 * Recurring Food grid: switching location tabs must not keep the previous
 * location's fetched dates, and a slower prior request must not overwrite
 * the tab that is now visible.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@payloadcms/ui', () => ({
  Banner: ({ children }: { children: unknown }) => children,
  ConfirmationModal: () => null,
  RelationshipInput: () => null,
  useAuth: () => ({
    user: { id: 'u1', roles: ['food-manager'], email: 'food@example.com' },
  }),
  useModal: () => ({ openModal: vi.fn(), closeModal: vi.fn() }),
}))

vi.mock('@/src/actions/admin-data', () => ({
  getActiveLocations: vi.fn(),
  getRecurringFoodData: vi.fn(),
  getUpcomingFoodForLocation: vi.fn(),
  getFoodVendorsByIds: vi.fn(),
  setRecurringFoodExclusion: vi.fn(),
  setRecurringFoodSchedule: vi.fn(),
}))

import {
  getActiveLocations,
  getRecurringFoodData,
  getUpcomingFoodForLocation,
} from '@/src/actions/admin-data'
import { RecurringFoodGrid } from '@/src/components/RecurringFoodGrid'

const getActiveLocationsMock = vi.mocked(getActiveLocations)
const getRecurringFoodDataMock = vi.mocked(getRecurringFoodData)
const getUpcomingFoodForLocationMock = vi.mocked(getUpcomingFoodForLocation)

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((next) => {
    resolve = next
  })
  return { promise, resolve }
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('RecurringFoodGrid location tabs', () => {
  it('ignores a slower previous location fetch after switching tabs', async () => {
    const firstLocationFood = deferred<
      { id: string; date: string; vendorId: string; vendorName: string }[]
    >()
    getActiveLocationsMock.mockResolvedValue([
      { id: 'loc-a', name: 'Lawrenceville', slug: 'lawrenceville' },
      { id: 'loc-b', name: 'Zelienople', slug: 'zelienople' },
    ])
    getRecurringFoodDataMock.mockResolvedValue({ schedules: {}, exclusions: {} })
    getUpcomingFoodForLocationMock.mockImplementation(async (locationId: string) => {
      if (locationId === 'loc-a') return firstLocationFood.promise
      return [
        {
          id: 'food-b',
          date: '2026-09-01T12:00:00.000Z',
          vendorId: 'vendor-b',
          vendorName: 'Zelie Truck',
        },
      ]
    })

    render(createElement(RecurringFoodGrid))
    await screen.findByRole('tab', { name: 'Zelienople' })

    fireEvent.click(screen.getByRole('tab', { name: 'Zelienople' }))
    expect(await screen.findByText(/Zelie Truck/)).toBeTruthy()

    firstLocationFood.resolve([
      {
        id: 'food-a',
        date: '2026-09-02T12:00:00.000Z',
        vendorId: 'vendor-a',
        vendorName: 'Lawrenceville Truck',
      },
    ])
    await waitFor(() => {
      expect(screen.queryByText(/Lawrenceville Truck/)).toBeNull()
    })
    expect(screen.getByText(/Zelie Truck/)).toBeTruthy()
  })
})
