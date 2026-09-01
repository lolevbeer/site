/** Both responsive location searches expose the same accessible name. */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { MapControls } from '@/components/map/map-controls'

afterEach(cleanup)

describe('MapControls search', () => {
  it('labels both responsive search inputs', () => {
    render(
      createElement(MapControls, {
        searchTerm: '',
        onSearchChange: () => undefined,
        isSearching: false,
        hasSearchLocation: false,
        locationCount: 0,
        nearbyLocations: [],
        onNearMeClick: () => undefined,
        onNearbyLocationClick: () => undefined,
        mobileView: 'map',
        onMobileViewChange: () => undefined,
      }),
    )

    const searches = screen.getAllByRole('textbox', { name: 'Search locations' })
    expect(searches).toHaveLength(2)
    expect(searches.every((input) => input.getAttribute('placeholder') === 'Search location...')).toBe(true)
  })
})
