/**
 * Recurring Food grid: switching location tabs must not keep the previous
 * location's fetched dates, and a slower prior request must not overwrite
 * the tab that is now visible.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createElement, useSyncExternalStore } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const {
  confirmationModalProps,
  openModal,
  closeModal,
  isModalOpen,
  subscribeModal,
  getModalSnapshot,
  resetModalState,
} = vi.hoisted(() => {
  const openModalSlugs = new Set<string>()
  const listeners = new Set<() => void>()
  const confirmationModalProps: Array<{
    body?: unknown
    modalSlug: string
    onConfirm?: () => void | Promise<void>
  }> = []
  let version = 0
  const notify = () => {
    version += 1
    listeners.forEach((listener) => listener())
  }

  return {
    confirmationModalProps,
    openModalSlugs,
    openModal: vi.fn((slug: string) => {
      openModalSlugs.add(slug)
      notify()
    }),
    closeModal: vi.fn((slug: string) => {
      openModalSlugs.delete(slug)
      notify()
    }),
    isModalOpen: (slug: string) => openModalSlugs.has(slug),
    subscribeModal: (listener: () => void) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    getModalSnapshot: () => version,
    resetModalState: () => {
      openModalSlugs.clear()
      confirmationModalProps.length = 0
      version = 0
    },
  }
})

vi.mock('@payloadcms/ui', () => ({
  Banner: ({ children }: { children: unknown }) => children,
  ConfirmationModal: (props: {
    body?: unknown
    modalSlug: string
    onConfirm?: () => void | Promise<void>
  }) => {
    useSyncExternalStore(subscribeModal, getModalSnapshot, getModalSnapshot)
    confirmationModalProps.push(props)
    if (!isModalOpen(props.modalSlug)) return null
    return createElement(
      'button',
      { type: 'button', onClick: props.onConfirm },
      'confirm-exclusion',
    )
  },
  RelationshipInput: () => null,
  useAuth: () => ({
    user: { id: 'u1', roles: ['food-manager'], email: 'food@example.com' },
  }),
  useModal: () => ({ openModal, closeModal, isModalOpen }),
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
import { RecurringFoodGrid, toDateKey } from '@/src/components/RecurringFoodGrid'

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
  resetModalState()
})

describe('toDateKey', () => {
  it('keeps a local midnight on the same calendar day', () => {
    const previousTimeZone = process.env.TZ
    process.env.TZ = 'Pacific/Kiritimati'

    try {
      const localMidnight = new Date(2026, 8, 1)
      expect(localMidnight.toISOString().split('T')[0]).toBe('2026-08-31')
      expect(toDateKey(localMidnight)).toBe('2026-09-01')
    } finally {
      if (previousTimeZone === undefined) delete process.env.TZ
      else process.env.TZ = previousTimeZone
    }
  })
})

describe('RecurringFoodGrid location tabs', () => {
  it('ignores a slower previous location fetch after switching tabs', async () => {
    const firstLocationFood =
      deferred<{ id: string; date: string; vendorId: string; vendorName: string }[]>()
    getActiveLocationsMock.mockResolvedValue([
      { id: 'loc-a', name: 'Lawrenceville', slug: 'lawrenceville' },
      { id: 'loc-b', name: 'Zelienople', slug: 'zelienople' },
    ])
    getRecurringFoodDataMock.mockResolvedValue({ schedules: {}, exclusions: {} })
    getUpcomingFoodForLocationMock.mockImplementation((locationId: string) => {
      if (locationId === 'loc-a') return firstLocationFood.promise
      return Promise.resolve([
        {
          id: 'food-b',
          date: '2026-09-01T12:00:00.000Z',
          vendorId: 'vendor-b',
          vendorName: 'Zelie Truck',
        },
      ])
    })

    render(createElement(RecurringFoodGrid))
    await screen.findByRole('tab', { name: 'Zelienople' })

    fireEvent.click(screen.getByRole('tab', { name: 'Zelienople' }))
    expect(await screen.findByText(/Zelie Truck/)).toBeTruthy()

    await act(async () => {
      firstLocationFood.resolve([
        {
          id: 'food-a',
          date: '2026-09-02T12:00:00.000Z',
          vendorId: 'vendor-a',
          vendorName: 'Lawrenceville Truck',
        },
      ])
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
    const confirmButton = await screen.findByRole('button', { name: 'confirm-exclusion' })
    expect(confirmButton).toBeTruthy()
    const locAOnConfirm = confirmationModalProps.at(-1)?.onConfirm
    if (!locAOnConfirm) throw new Error('Expected loc-A confirmation handler')

    fireEvent.click(screen.getByRole('tab', { name: 'Zelienople' }))
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'confirm-exclusion' })).toBeNull()
    })

    await act(async () => {
      await locAOnConfirm()
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(setRecurringFoodExclusionMock).not.toHaveBeenCalled()
    expect(closeModal).toHaveBeenCalledWith('confirm-exclusion')
  })

  it('ignores a slower previous vendor-name fetch after switching tabs', async () => {
    const firstLocationVendors = deferred<Record<string, string>>()
    getActiveLocationsMock.mockResolvedValue([
      { id: 'loc-a', name: 'Lawrenceville', slug: 'lawrenceville' },
      { id: 'loc-b', name: 'Zelienople', slug: 'zelienople' },
    ])
    getRecurringFoodDataMock.mockResolvedValue({
      schedules: {
        'loc-a': { sunday: { first: 'vendor-a' } },
        'loc-b': { sunday: { first: 'vendor-b' } },
      },
      exclusions: {},
    })
    getUpcomingFoodForLocationMock.mockResolvedValue([])
    getFoodVendorsByIdsMock.mockImplementation((vendorIds: string[]) => {
      if (vendorIds.includes('vendor-a')) return firstLocationVendors.promise
      return Promise.resolve({ 'vendor-b': 'Zelie Recurring' })
    })

    render(createElement(RecurringFoodGrid))
    await screen.findByRole('tab', { name: 'Zelienople' })

    fireEvent.click(screen.getByRole('tab', { name: 'Zelienople' }))
    expect(
      (await screen.findAllByRole('button', { name: /Exclude Zelie Recurring on/i })).length,
    ).toBeGreaterThan(0)

    await act(async () => {
      firstLocationVendors.resolve({ 'vendor-a': 'Lawrenceville Recurring' })
      await firstLocationVendors.promise
    })
    expect(screen.queryAllByText(/Lawrenceville Recurring/)).toHaveLength(0)
    expect(screen.getAllByText(/Zelie Recurring/).length).toBeGreaterThan(0)
  })
})
