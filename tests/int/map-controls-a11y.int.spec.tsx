/** Map search exposes one combobox and a labeled map/list toggle. */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { MapControls } from '@/components/map/map-controls'
import { MapSearchField } from '@/components/map/map-search-field'
import type { PlaceSuggestion } from '@/lib/map/search'

afterEach(cleanup)

const props = {
  searchTerm: '',
  onSearchChange: () => undefined,
  isSearching: false,
  suggestions: [] as PlaceSuggestion[],
  onSelectSuggestion: () => undefined,
  onCommitSearch: () => undefined,
  locationCount: 0,
  locationTotal: 0,
  nearbyLocations: [],
  onNearMeClick: () => undefined,
  onNearbyLocationClick: () => undefined,
  mobileView: 'map' as const,
  onMobileViewChange: () => undefined,
}

describe('MapControls search', () => {
  it('labels a single city or ZIP combobox', () => {
    render(createElement(MapControls, props))

    const searches = screen.getAllByRole('combobox', { name: 'Search city or ZIP' })
    expect(searches).toHaveLength(1)
    expect(searches[0]?.getAttribute('placeholder')).toBe('City or ZIP')
  })

  it('does not show a retailer type filter', () => {
    render(createElement(MapControls, props))
    expect(screen.queryByRole('group', { name: 'Filter by place type' })).toBeNull()
  })

  it('exposes the map/list toggle as pressed state', () => {
    render(createElement(MapControls, props))
    expect(screen.getByRole('group', { name: 'Map or list' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Map' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'List' }).getAttribute('aria-pressed')).toBe('false')
  })
})

describe('MapSearchField', () => {
  const pittsburgh: PlaceSuggestion = {
    id: 'place.1',
    kind: 'place',
    label: 'Pittsburgh',
    latitude: 40.44,
    longitude: -80,
  }

  it('does not select a hidden suggestion on Enter', () => {
    let committed = 0
    let selected: PlaceSuggestion | null = null
    render(
      createElement(MapSearchField, {
        value: 'Pittsburgh',
        onValueChange: () => undefined,
        isSearching: false,
        suggestions: [pittsburgh],
        onSelect: (suggestion) => {
          selected = suggestion
        },
        onCommit: () => {
          committed += 1
        },
      }),
    )

    const input = screen.getByRole('combobox', { name: 'Search city or ZIP' })
    fireEvent.keyDown(input, { key: 'Escape' })
    fireEvent.submit(input.closest('form') as HTMLFormElement)
    expect(committed).toBe(1)
    expect(selected).toBeNull()
  })
})
