/**
 * HeroSection renders the server-projected cans beers in order, links each to its beer page,
 * and drops a beer whose image fails to load in the browser. Only external animation, carousel,
 * tooltip and image primitives are stubbed.
 */
import type { ReactNode } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/image', () => ({
  default: ({ src, alt, onError }: { src: string; alt: string; onError?: () => void }) => (
    // eslint-disable-next-line @next/next/no-img-element -- test stub for next/image
    <img src={src} alt={alt} onError={onError} />
  ),
}))
vi.mock('@/components/motion', () => ({
  BlurFade: ({ children }: { children: ReactNode }) => <>{children}</>,
}))
vi.mock('@/components/ui/carousel', () => {
  const Pass = ({ children }: { children?: ReactNode }) => <div>{children}</div>
  return {
    Carousel: Pass,
    CarouselContent: Pass,
    CarouselItem: Pass,
    CarouselNext: () => null,
    CarouselPrevious: () => null,
  }
})
vi.mock('@/components/ui/tooltip', () => {
  const Pass = ({ children }: { children?: ReactNode }) => <>{children}</>
  return { Tooltip: Pass, TooltipContent: Pass, TooltipProvider: Pass, TooltipTrigger: Pass }
})

import { HeroSection } from '@/components/home/hero-section'

const heroBeers = [
  { id: 'b', slug: 'beta', name: 'Beta', imageUrl: '/thumb/b.png' },
  { id: 'a', slug: 'alpha', name: 'Alpha', imageUrl: '/thumb/a.png' },
  { id: 'c', slug: 'gamma', name: 'Gamma', imageUrl: '/thumb/c.png' },
]

afterEach(cleanup)

const beerLinks = () =>
  screen.getAllByRole('link').filter((link) => link.getAttribute('href')?.startsWith('/beer/'))

describe('HeroSection', () => {
  it('links each projected beer in the given order with its thumbnail and name', () => {
    render(<HeroSection heroBeers={heroBeers} />)
    expect(beerLinks().map((link) => link.getAttribute('href'))).toEqual([
      '/beer/beta',
      '/beer/alpha',
      '/beer/gamma',
    ])
    const image = screen.getByAltText('Beta beer can')
    expect(image.getAttribute('src')).toBe('/thumb/b.png')
    expect(screen.getAllByText('Alpha')).toHaveLength(1)
  })

  it('removes only the beer whose image errors and keeps the order of the rest', () => {
    render(<HeroSection heroBeers={heroBeers} />)
    fireEvent.error(screen.getByAltText('Alpha beer can'))
    expect(screen.queryByAltText('Alpha beer can')).toBeNull()
    expect(beerLinks().map((link) => link.getAttribute('href'))).toEqual([
      '/beer/beta',
      '/beer/gamma',
    ])
  })
})
