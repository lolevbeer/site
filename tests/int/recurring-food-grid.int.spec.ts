/**
 * Recurring Food grid: switching location tabs must not keep the previous
 * location's fetched dates, and a slower prior request must not overwrite
 * the tab that is now visible.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createElement, useSyncExternalStore, type ReactNode } from 'react'
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
  // Minimal stand-ins that keep roles/labels identical to the real components.
  Button: ({
    children,
    onClick,
    disabled,
  }: {
    children?: unknown
    onClick?: () => void
    disabled?: boolean
  }) => createElement('button', { type: 'button', onClick, disabled }, children as ReactNode),
  Pill: ({ children }: { children?: unknown }) =>
    createElement('span', null, children as ReactNode),
  ShimmerEffect: () => null,
  useAuth: () => ({
    user: { id: 'u1', roles: ['food-manager'], email: 'food@example.com' },
  }),
  useModal: () => ({ openModal, closeModal, isModalOpen }),
}))

vi.mock('@/src/actions/admin-data', () => ({
  getActiveLocations: vi.fn(),
  getRecurringFoodData: vi.fn(),
  getFoodForLocationYear: vi.fn(),
  getFoodVendorsByIds: vi.fn(),
  setRecurringFoodExclusion: vi.fn(),
  setRecurringFoodSchedule: vi.fn(),
}))

import {
  getActiveLocations,
  getFoodForLocationYear,
  getFoodVendorsByIds,
  getRecurringFoodData,
  setRecurringFoodExclusion,
} from '@/src/actions/admin-data'
import { RecurringFoodGrid, toDateKey } from '@/src/components/RecurringFoodGrid'

const getActiveLocationsMock = vi.mocked(getActiveLocations)
const getRecurringFoodDataMock = vi.mocked(getRecurringFoodData)
const getFoodForLocationYearMock = vi.mocked(getFoodForLocationYear)
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
  it('loads an independent schedule when the selected year changes', async () => {
    const currentYear = new Date().getFullYear()
    getActiveLocationsMock.mockResolvedValue([
      { id: 'loc-a', name: 'Lawrenceville', slug: 'lawrenceville' },
    ])
    getRecurringFoodDataMock.mockImplementation(async (year) => {
      const scheduleYear = year ?? currentYear
      const schedules: Record<
        string,
        Record<string, Record<string, string | null>>
      > = scheduleYear === currentYear ? { 'loc-a': { sunday: { first: 'vendor-a' } } } : {}
      return {
        year: scheduleYear,
        schedules,
        exclusions: {},
      }
    })
    getFoodForLocationYearMock.mockResolvedValue([])
    getFoodVendorsByIdsMock.mockResolvedValue({ 'vendor-a': 'Current Year Truck' })

    render(createElement(RecurringFoodGrid))
    expect((await screen.findAllByText(/Current Year Truck/)).length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('button', { name: 'Next year' }))

    await waitFor(() => {
      expect(getRecurringFoodDataMock).toHaveBeenCalledWith(currentYear + 1)
      expect(screen.queryAllByText(/Current Year Truck/)).toHaveLength(0)
    })
  })

  it('ignores a slower previous location fetch after switching tabs', async () => {
    const firstLocationFood =
      deferred<{ id: string; date: string; vendorId: string; vendorName: string }[]>()
    getActiveLocationsMock.mockResolvedValue([
      { id: 'loc-a', name: 'Lawrenceville', slug: 'lawrenceville' },
      { id: 'loc-b', name: 'Zelienople', slug: 'zelienople' },
    ])
    getRecurringFoodDataMock.mockResolvedValue({ year: 2026, schedules: {}, exclusions: {} })
    getFoodForLocationYearMock.mockImplementation((locationId: string) => {
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
      year: 2026,
      schedules: { 'loc-a': { sunday: { first: 'vendor-a' } } },
      exclusions: {},
    })
    getFoodForLocationYearMock.mockResolvedValue([])
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

  it('locks only the date being saved, leaving the rest of the list clickable', async () => {
    // A grid-wide lock meant a second edit could never be started, so the save
    // queue stayed one deep and every selection cost a server round trip.
    const pendingSave = deferred<void>()
    getActiveLocationsMock.mockResolvedValue([
      { id: 'loc-a', name: 'Lawrenceville', slug: 'lawrenceville' },
    ])
    getRecurringFoodDataMock.mockResolvedValue({
      year: 2026,
      schedules: { 'loc-a': { sunday: { first: 'vendor-a' } } },
      exclusions: {},
    })
    getFoodForLocationYearMock.mockResolvedValue([])
    getFoodVendorsByIdsMock.mockResolvedValue({ 'vendor-a': 'Lawrenceville Recurring' })
    setRecurringFoodExclusionMock.mockReturnValue(pendingSave.promise)

    render(createElement(RecurringFoodGrid))
    const dates = await screen.findAllByRole('button', {
      name: /Exclude Lawrenceville Recurring on/i,
    })
    expect(dates.length).toBeGreaterThan(1)

    fireEvent.click(dates[0])
    await screen.findByRole('button', { name: 'confirm-exclusion' })
    const onConfirm = confirmationModalProps.at(-1)?.onConfirm
    if (!onConfirm) throw new Error('Expected a confirmation handler')

    // Leave the write in flight.
    await act(async () => {
      void onConfirm()
      await Promise.resolve()
    })

    await waitFor(() => {
      expect((dates[0] as HTMLButtonElement).disabled).toBe(true)
    })
    expect((dates[1] as HTMLButtonElement).disabled).toBe(false)

    await act(async () => {
      pendingSave.resolve()
      await Promise.resolve()
    })
    await waitFor(() => {
      expect((dates[0] as HTMLButtonElement).disabled).toBe(false)
    })
  })

  it('ignores a slower previous vendor-name fetch after switching tabs', async () => {
    const firstLocationVendors = deferred<Record<string, string>>()
    getActiveLocationsMock.mockResolvedValue([
      { id: 'loc-a', name: 'Lawrenceville', slug: 'lawrenceville' },
      { id: 'loc-b', name: 'Zelienople', slug: 'zelienople' },
    ])
    getRecurringFoodDataMock.mockResolvedValue({
      year: 2026,
      schedules: {
        'loc-a': { sunday: { first: 'vendor-a' } },
        'loc-b': { sunday: { first: 'vendor-b' } },
      },
      exclusions: {},
    })
    getFoodForLocationYearMock.mockResolvedValue([])
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

  it('offers a jump to the previous year when the selected year is empty', async () => {
    const currentYear = new Date().getFullYear()
    getActiveLocationsMock.mockResolvedValue([
      { id: 'loc-a', name: 'Lawrenceville', slug: 'lawrenceville' },
    ])
    getRecurringFoodDataMock.mockImplementation(async (year) => {
      const schedules: Record<string, Record<string, Record<string, string | null>>> = year ===
      currentYear - 1
        ? { 'loc-a': { sunday: { first: 'vendor-a' } } }
        : {}
      return { year: year ?? currentYear, schedules, exclusions: {} }
    })
    getFoodForLocationYearMock.mockResolvedValue([])
    getFoodVendorsByIdsMock.mockResolvedValue({ 'vendor-a': 'Last Year Truck' })

    render(createElement(RecurringFoodGrid))

    const jump = await screen.findByRole('button', { name: `View ${currentYear - 1}` })
    expect(screen.getByText(new RegExp(`1 slot scheduled for ${currentYear - 1}`))).toBeTruthy()

    fireEvent.click(jump)
    expect((await screen.findAllByText(/Last Year Truck/)).length).toBeGreaterThan(0)
  })

  it('hides the empty fifth week row behind a toggle', async () => {
    getActiveLocationsMock.mockResolvedValue([
      { id: 'loc-a', name: 'Lawrenceville', slug: 'lawrenceville' },
    ])
    getRecurringFoodDataMock.mockResolvedValue({
      year: 2026,
      schedules: { 'loc-a': { sunday: { first: 'vendor-a' } } },
      exclusions: {},
    })
    getFoodForLocationYearMock.mockResolvedValue([])
    getFoodVendorsByIdsMock.mockResolvedValue({ 'vendor-a': 'Truck' })

    render(createElement(RecurringFoodGrid))
    await screen.findAllByText(/Truck/)

    expect(screen.queryByText('5')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Show 5th week' }))
    expect(screen.getByText('5')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Show 5th week' })).toBeNull()
  })

  it('always shows the fifth week row when it has data', async () => {
    getActiveLocationsMock.mockResolvedValue([
      { id: 'loc-a', name: 'Lawrenceville', slug: 'lawrenceville' },
    ])
    getRecurringFoodDataMock.mockResolvedValue({
      year: 2026,
      schedules: { 'loc-a': { sunday: { fifth: 'vendor-a' } } },
      exclusions: {},
    })
    getFoodForLocationYearMock.mockResolvedValue([])
    getFoodVendorsByIdsMock.mockResolvedValue({ 'vendor-a': 'Truck' })

    render(createElement(RecurringFoodGrid))
    await screen.findAllByText(/Truck/)

    expect(screen.getByText('5')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Show 5th week' })).toBeNull()
  })
})
