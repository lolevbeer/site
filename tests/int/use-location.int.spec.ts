import { act, renderHook } from '@testing-library/react'
import { withNuqsTestingAdapter } from 'nuqs/adapters/testing'
import { afterEach, describe, expect, it } from 'vitest'
import { useLocation } from '@/lib/hooks/use-location'
import { LOCATION_STORAGE_KEY } from '@/lib/config/locations'
import type { PayloadLocation } from '@/lib/types/location'

const locations = [
  { id: 'lawrenceville', slug: 'lawrenceville', name: 'Lawrenceville', active: true },
  { id: 'zelienople', slug: 'zelienople', name: 'Zelienople', active: true },
] as PayloadLocation[]

afterEach(() => localStorage.clear())

describe('useLocation', () => {
  it('lets a direct selection replace a location preset from the URL', () => {
    const { result } = renderHook(() => useLocation(locations), {
      wrapper: withNuqsTestingAdapter({ searchParams: '?loc=lawrenceville', hasMemory: true }),
    })

    act(() => result.current.setLocation('zelienople'))

    expect(result.current.currentLocation).toBe('zelienople')
    expect(localStorage.getItem(LOCATION_STORAGE_KEY)).toBe('zelienople')
  })
})
