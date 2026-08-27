/**
 * Recurring Food grid: switching location tabs must not keep the previous
 * location's fetched dates, and a slower prior request must not overwrite
 * the tab that is now visible.
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const { openModal, closeModal } = vi.hoisted(() => ({
  openModal: vi.fn(),
  closeModal: vi.fn(),
}))

vi.mock('@payloadcms/ui', () => ({
  Banner: ({ children }: { children: unknown }) => children,
  ConfirmationModal: ({ onConfirm }: { onConfirm?: () => void }) =>
    createElement('button', { type: 'button', onClick: onConfirm }, 'confirm-exclusion'),
  RelationshipInput: () => null,
  useAuth: () => ({
    user: { id: 'u1', roles: ['food-manager'], email: 'food@example.com' },
  }),
  useModal: () => ({ openModal, closeModal }),
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
  getFoodVendorsByIds,
  getRecurringFoodData,
  getUpcomingFoodForLocation,
  setRecurringFoodExclusion,
} from '@/src/actions/admin-data'
import { RecurringFoodGrid } from '@/src/components/RecurringFoodGrid'

const getActiveLocationsMock = vi.mocked(getActiveLocations)
const getRecurringFoodDataMock = vi.mocked(getRecurringFoodData)
const getUpcomingFoodForLocationMock = vi.mocked(getUpcomingFoodForLocation)
const getFoodVendorsByIdsMock = vi.mocked(getFoodVendorsByIds)
const setRecurringFoodExclusionMock = vi.mocked(setRecurringFoodExclusion)

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
    await act(async () => {
      await firstLocationFood.promise
    })
    expect(screen.queryByText(/Lawrenceville Truck/)).toBeNull()
    expect(screen.getByText(/Zelie Truck/)).toBeTruthy()
  })

  it('does not apply a loc-A exclusion confirm after switching to loc-B', async () => {
    getActiveLocationsMock.mockResolvedValue([
      { id: 'loc-a', name: 'Lawrenceville', slug: 'lawrenceville' },
      { id: 'loc-b', name: 'Zelienople', slug: 'zelienople' },
    ])
    getRecurringFoodDataMock.mockResolvedValue({
      schedules: { 'loc-a': { sunday: { first: 'vendor-a' } } },
      exclusions: {},
    })
    getUpcomingFoodForLocationMock.mockResolvedValue([])
    getFoodVendorsByIdsMock.mockResolvedValue({ 'vendor-a': 'Lawrenceville Recurring' })

    render(createElement(RecurringFoodGrid))
    const exclude = await screen.findAllByRole('button', {
      name: /Exclude Lawrenceville Recurring on/i,
    })
    fireEvent.click(exclude[0])
    expect(openModal).toHaveBeenCalled()

    fireEvent.click(screen.getByRole('tab', { name: 'Zelienople' }))
    expect(closeModal).toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'confirm-exclusion' }))
    expect(setRecurringFoodExclusionMock).not.toHaveBeenCalled()
  })
})
