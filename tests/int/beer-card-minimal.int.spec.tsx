/**
 * The minimal beer tile (/beer grid, taproom "Cans to go"): ABV is visible so
 * beers compare without opening each page, the whole tile is one link with no
 * extra "View Details" button, and the image asks for a two-column width on
 * phones (#336).
 */
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { BeerCard } from '@/components/beer/beer-card'
import { GlassType, type Beer } from '@/lib/types/beer'

const imageProps = vi.hoisted(() => ({ sizes: '' }))
vi.mock('@/components/location/location-provider', () => ({
  useLocationContext: () => ({ currentLocation: 'lawrenceville' }),
}))
vi.mock('@/components/motion', () => ({
  MotionCard: ({ children }: { children: React.ReactNode }) => children,
}))
vi.mock('@/components/beer/beer-image', () => ({
  BeerImage: ({ sizes }: { sizes: string }) => {
    imageProps.sizes = sizes
    return null
  },
}))
afterEach(cleanup)

const beer = {
  variant: 'lupula',
  name: 'Lupula',
  type: 'Hazy IPA',
  abv: 7,
  glass: GlassType.PINT,
  description: '',
  pricing: {},
  availability: {},
} as Beer

it('shows style and ABV, with the tile as its only link', () => {
  render(<BeerCard beer={beer} variant="minimal" />)
  expect(screen.getByText('7.0%')).toBeTruthy()
  expect(screen.getByText('Hazy IPA')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'View Details' })).toBeNull()
  expect(screen.getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual(['/beer/lupula'])
})

it('sizes the image for the two-column phone grid', () => {
  render(<BeerCard beer={beer} variant="minimal" />)
  expect(imageProps.sizes).toMatch(/^\(max-width: 768px\) 50vw/)
})
